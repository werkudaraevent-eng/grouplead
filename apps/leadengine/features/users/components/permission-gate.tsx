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
