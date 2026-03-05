'use client'

import { usePermissions } from '@/contexts/permissions-context'
import { useCompany } from '@/contexts/company-context'

interface PermissionGateProps {
  resource: string
  action: string
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function PermissionGate({ resource, action, children, fallback = null }: PermissionGateProps) {
  const { activeCompany } = useCompany()
  const { can, loading } = usePermissions()

  // If no company context is resolved (migration not run, no membership, etc.)
  // allow everything through — don't block the pre-existing UI
  if (!activeCompany) return <>{children}</>

  // Show children while loading to avoid blank UI flash
  if (loading) return <>{children}</>

  if (can(resource, action)) {
    return <>{children}</>
  }

  return <>{fallback}</>
}
