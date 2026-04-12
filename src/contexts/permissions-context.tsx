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

  useEffect(() => {
    if (!activeCompany) {
      setPermissions([])
      setUserType(null)
      setLoading(false)
      return
    }

    const fetchPermissions = async () => {
      setLoading(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id) { setPermissions([]); setUserType(null); setLoading(false); return }

      // Global super_admin bypass via profiles.role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, role_id')
        .eq('id', user.id)
        .maybeSingle()

      const globalRole = (profile?.role ?? '').toLowerCase().replace(/\s+/g, '_')

      if (globalRole === 'super_admin') {
        setUserType('super_admin')
        setPermissions([])
        setLoading(false)
        return
      }

      // Resolve the user's role_id (from profiles → roles table)
      const roleId = profile?.role_id ?? null

      if (!roleId) {
        console.error(`[Permissions] No role_id set for user ${user.id}. Failing closed.`)
        setPermissions([]); setUserType(globalRole || null); setLoading(false); return
      }

      // Also resolve user_type for backward compatibility (used by some legacy components)
      const { data: membership } = await supabase
        .from('company_members')
        .select('user_type')
        .eq('user_id', user.id)
        .eq('company_id', activeCompany.id)
        .maybeSingle()

      setUserType(membership?.user_type ?? globalRole ?? null)

      // Fetch permissions by role_id + company_id (this is what the Permissions page writes to)
      const { data: perms } = await supabase
        .from('role_permissions')
        .select('*')
        .eq('role_id', roleId)
        .eq('company_id', activeCompany.id)

      if (!perms || perms.length === 0) {
        console.warn(`[Permissions] No role_permissions found for role_id=${roleId}, company_id=${activeCompany.id}. Trying user_type fallback.`)
        // Fallback: try legacy user_type-based lookup
        const resolvedUserType = membership?.user_type ?? globalRole
        if (resolvedUserType) {
          const { data: legacyPerms } = await supabase
            .from('role_permissions')
            .select('*')
            .eq('user_type', resolvedUserType)
            .eq('company_id', activeCompany.id)
          setPermissions(legacyPerms ?? [])
        }
      } else {
        setPermissions(perms)
      }

      setLoading(false)
    }

    fetchPermissions()
  }, [activeCompany?.id])

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
