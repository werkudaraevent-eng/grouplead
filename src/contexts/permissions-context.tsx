'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useCompany } from '@/contexts/company-context'
import type { RolePermission } from '@/types/company'

interface PermissionsState {
  permissions: RolePermission[]
  loading: boolean
  userType: string | null
  can: (resource: string, action: string) => boolean
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
      if (!user) { setPermissions([]); setUserType(null); setLoading(false); return }

      const { data: membership } = await supabase
        .from('company_members')
        .select('user_type')
        .eq('user_id', user.id)
        .eq('company_id', activeCompany.id)
        .single()

      if (!membership) { setPermissions([]); setUserType(null); setLoading(false); return }
      setUserType(membership.user_type)

      if (membership.user_type === 'super_admin') { setPermissions([]); setLoading(false); return }

      const { data: perms } = await supabase
        .from('role_permissions')
        .select('*')
        .eq('company_id', activeCompany.id)
        .eq('user_type', membership.user_type)

      setPermissions(perms ?? [])
      setLoading(false)
    }

    fetchPermissions()
  }, [activeCompany?.id])

  const can = useCallback((resource: string, action: string): boolean => {
    if (userType === 'super_admin') return true
    const perm = permissions.find(p => p.resource === resource && p.action === action)
    return perm?.is_allowed ?? false
  }, [permissions, userType])

  return (
    <PermissionsCtx.Provider value={{ permissions, loading, userType, can }}>
      {children}
    </PermissionsCtx.Provider>
  )
}

export function usePermissions(): PermissionsState {
  const ctx = useContext(PermissionsCtx)
  if (!ctx) throw new Error('usePermissions must be used within a PermissionsProvider')
  return ctx
}
