'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useCompany } from '@/contexts/company-context'
import type { RolePermission } from '@/types/company'

type CanReadLevel = 'none' | 'own' | 'company' | 'all'

interface PermissionsState {
  permissions: RolePermission[]
  loading: boolean
  userType: string | null
  /** Legacy-compatible: can(module, 'create' | 'read' | 'update' | 'delete') */
  can: (module: string, action: string) => boolean
  /** Granular read level check */
  canRead: (module: string) => CanReadLevel
}

const PermissionsCtx = createContext<PermissionsState | null>(null)

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const { activeCompany } = useCompany()
  const [permissions, setPermissions] = useState<RolePermission[]>([])
  const [userType, setUserType] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchPermissions = useCallback(async (showLoading = true) => {
    if (!activeCompany?.id) {
      setPermissions([])
      setUserType(null)
      setLoading(false)
      return
    }

    if (showLoading) setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) { setPermissions([]); setUserType(null); setLoading(false); return }

    // Parallel fetch: profile + membership (eliminates waterfall)
    const [profileResult, membershipResult] = await Promise.all([
      supabase.from('profiles').select('role, role_id').eq('id', user.id).maybeSingle(),
      supabase.from('company_members').select('user_type').eq('user_id', user.id).eq('company_id', activeCompany.id).maybeSingle(),
    ])

    const profile = profileResult.data
    const membership = membershipResult.data
    const globalRole = (profile?.role ?? '').toLowerCase().replace(/\s+/g, '_')

    // Global super_admin bypass
    if (globalRole === 'super_admin') {
      setUserType('super_admin')
      setPermissions([])
      setLoading(false)
      return
    }

    setUserType(membership?.user_type ?? globalRole ?? null)

    const roleId = profile?.role_id ?? null

    // Try role_id-based permissions first
    if (roleId) {
      const { data: perms } = await supabase
        .from('role_permissions')
        .select('*')
        .eq('role_id', roleId)
        .eq('company_id', activeCompany.id)

      if (perms && perms.length > 0) {
        setPermissions(perms)
        setLoading(false)
        return
      }
    }

    // Fallback: user_type-based lookup (covers sales users without role_id)
    const resolvedUserType = membership?.user_type ?? globalRole
    if (resolvedUserType) {
      const { data: legacyPerms } = await supabase
        .from('role_permissions')
        .select('*')
        .eq('user_type', resolvedUserType)
        .eq('company_id', activeCompany.id)
      setPermissions(legacyPerms ?? [])
    } else {
      console.warn(`[Permissions] No role_id or user_type for user ${user.id}. No permissions granted.`)
      setPermissions([])
    }

    setLoading(false)
  }, [activeCompany?.id])

  useEffect(() => {
    fetchPermissions(true)
  }, [fetchPermissions])

  useEffect(() => {
    if (!activeCompany?.id) return

    const supabase = createClient()
    let timeout: ReturnType<typeof setTimeout> | null = null
    let channel: ReturnType<typeof supabase.channel> | null = null

    const refreshSoon = () => {
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(() => {
        fetchPermissions(false)
      }, 250)
    }

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id) return

      channel = supabase
        .channel(`permissions:${activeCompany.id}:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'role_permissions',
            filter: `company_id=eq.${activeCompany.id}`,
          },
          refreshSoon,
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${user.id}`,
          },
          refreshSoon,
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'company_members',
            filter: `user_id=eq.${user.id}`,
          },
          refreshSoon,
        )
        .subscribe()
    }

    setupRealtime()

    return () => {
      if (timeout) clearTimeout(timeout)
      if (channel) supabase.removeChannel(channel)
    }
  }, [activeCompany?.id, fetchPermissions])

  const can = useCallback((module: string, action: string): boolean => {
    if (userType === 'super_admin') return true

    // Case-insensitive module matching
    const matchingPerms = permissions.filter(p => p.module_id.toLowerCase() === module.toLowerCase())
    if (matchingPerms.length === 0) return false

    // If duplicates exist, log warning and use the MOST RESTRICTIVE row (fail-secure)
    if (matchingPerms.length > 1) {
      console.warn(`[RBAC] Duplicate permission rows for module "${module}" user_type "${userType}". Using most restrictive.`)
    }

    // For duplicates, pick the row with least access
    const perm = matchingPerms.length === 1
      ? matchingPerms[0]
      : matchingPerms.reduce((most, curr) => {
          // Prefer the row with fewer grants
          const score = (p: typeof curr) =>
            (p.can_create ? 1 : 0) + (p.can_update ? 1 : 0) + (p.can_delete ? 1 : 0) +
            (p.can_read === 'all' ? 3 : p.can_read === 'company' ? 2 : p.can_read === 'own' ? 1 : 0)
          return score(curr) < score(most) ? curr : most
        })

    switch (action) {
      case 'create': return perm.can_create
      case 'read': {
        const scope = (perm.can_read ?? 'none').toLowerCase()
        return scope !== 'none' && scope !== 'no access'
      }
      case 'update': return perm.can_update
      case 'delete': return perm.can_delete
      default:       return false
    }
  }, [permissions, userType])

  const canRead = useCallback((module: string): CanReadLevel => {
    if (userType === 'super_admin') return 'all'
    const perm = permissions.find(p => p.module_id === module)
    return perm?.can_read ?? 'none'
  }, [permissions, userType])

  return (
    <PermissionsCtx.Provider value={{ permissions, loading, userType, can, canRead }}>
      {children}
    </PermissionsCtx.Provider>
  )
}

export function usePermissions(): PermissionsState {
  const ctx = useContext(PermissionsCtx)
  if (!ctx) throw new Error('usePermissions must be used within a PermissionsProvider')
  return ctx
}
