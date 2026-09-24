'use client'

import { usePermissions } from '@/contexts/permissions-context'
import { useCompany } from '@/contexts/company-context'

interface PermissionGateProps {
  resource: string
  action: string
  children: React.ReactNode
  fallback?: React.ReactNode
  /**
   * What to render while permissions are still loading. Defaults to `null` so
   * gated buttons don't flash visible then disappear once permissions resolve.
   * Pass `children` for optimistic rendering during load.
   */
  loadingPlaceholder?: React.ReactNode
}

export function PermissionGate({
  resource,
  action,
  children,
  fallback = null,
  loadingPlaceholder = null,
}: PermissionGateProps) {
  const { activeCompany } = useCompany()
  const { can, loading } = usePermissions()

  // No company context — let children through (login flow, migration not run).
  if (!activeCompany) return <>{children}</>

  // Avoid the "show then hide" flash. Default placeholder is null.
  if (loading) return <>{loadingPlaceholder}</>

  if (can(resource, action)) {
    return <>{children}</>
  }

  return <>{fallback}</>
}

/**
 * `PermissionGate`'s answer as a value, for what a gate cannot wrap: a page
 * announcing its phone menu, or leaving room at its foot for a FAB. False
 * while the grants load, like the gate's default placeholder.
 */
export function useCan(resource: string, action: string): boolean {
  const { activeCompany } = useCompany()
  const { can, loading } = usePermissions()
  if (!activeCompany) return true
  if (loading) return false
  return can(resource, action)
}
