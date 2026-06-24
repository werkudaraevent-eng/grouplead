'use client'

import { usePermissions } from '@/contexts/permissions-context'
import { useCompany } from '@/contexts/company-context'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface PermissionMenuItemProps {
  resource: string
  action: string
  onClick?: () => void
  children: ReactNode
  className?: string
  /** Tooltip shown when the user lacks the permission. */
  deniedHint?: string
}

/**
 * A DropdownMenuItem that is ALWAYS rendered but becomes disabled (greyed out,
 * non-interactive) with an explanatory tooltip when the user lacks the
 * required permission. Unlike PermissionGate (which hides the item entirely),
 * this keeps the action discoverable — the user sees the feature exists but
 * learns they don't have access.
 *
 * Security note: this is purely cosmetic. The real enforcement lives in the
 * server actions (requirePermission) and RLS. Disabling here only improves UX;
 * a user editing the DOM still cannot perform the action.
 */
export function PermissionMenuItem({
  resource,
  action,
  onClick,
  children,
  className,
  deniedHint = "You don't have permission for this",
}: PermissionMenuItemProps) {
  const { activeCompany } = useCompany()
  const { can, loading } = usePermissions()

  // No company context (login/migration) — allow through, parent decides.
  const allowed = !activeCompany ? true : (!loading && can(resource, action))

  if (allowed) {
    return (
      <DropdownMenuItem className={className} onClick={onClick}>
        {children}
      </DropdownMenuItem>
    )
  }

  // Disabled state — greyed, non-interactive, with a tooltip explaining why.
  return (
    <Tooltip content={deniedHint} position="left">
      <div
        aria-disabled
        className={cn(
          'flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm select-none',
          'cursor-not-allowed opacity-45',
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </Tooltip>
  )
}
