/**
 * Server-side permission enforcement for Server Actions.
 *
 * Use this in `src/app/actions/*` write functions to defend against direct
 * RPC bypass of the client-side `<PermissionGate />`. RLS handles row-level
 * access; this layer denies the action entirely when the role doesn't have
 * the matrix grant for the requested module.
 *
 * Usage:
 *   const guard = await requirePermission('leads', 'create')
 *   if (!guard.allowed) return guard.error  // ActionResult<never>
 *
 * The guard returns an early `ActionResult` with a 403-style message when
 * the user is signed out or lacks the grant, which mirrors the existing
 * `ActionResult<T>` pattern used across the actions layer.
 */

import { createClient } from '@/utils/supabase/server'
import type { ActionResult } from '@/types/action-result'

type Action = 'create' | 'read' | 'update' | 'delete'

interface PermissionGuardOk {
  allowed: true
  userId: string
  /** Resolved role id for the user's active membership, when available. */
  roleId: string | null
  /** Resolved company id used to evaluate the matrix grant. */
  companyId: string | null
}

interface PermissionGuardDenied {
  allowed: false
  /** Pre-built ActionResult — return directly from the server action. */
  error: ActionResult
}

export type PermissionGuard = PermissionGuardOk | PermissionGuardDenied

/**
 * Check whether the current user has the given matrix grant on `module`.
 *
 * Resolution order matches `permissions-context.tsx`:
 *   1. `profiles.role === 'super_admin'` → always allow.
 *   2. `profiles.role_id` + `role_permissions(role_id, company_id)` lookup.
 *   3. Legacy fallback: `company_members.user_type` + `role_permissions(user_type)`.
 *
 * @param module     The `app_modules.id` to check (e.g. 'leads', 'companies').
 * @param action     'create' | 'read' | 'update' | 'delete'.
 * @param companyId  Optional explicit company scope. Defaults to the user's
 *                   first company membership when omitted (matches the
 *                   client context's `activeCompany` heuristic).
 */
export async function requirePermission(
  module: string,
  action: Action,
  companyId?: string,
): Promise<PermissionGuard> {
  const supabase = await createClient()

  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user
  if (!user?.id) {
    return {
      allowed: false,
      error: { success: false, error: 'Not authenticated' },
    }
  }

  // 1. Super admin bypass.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, role_id')
    .eq('id', user.id)
    .maybeSingle()

  const globalRole = (profile?.role ?? '').toLowerCase().replace(/\s+/g, '_')
  if (globalRole === 'super_admin') {
    return { allowed: true, userId: user.id, roleId: profile?.role_id ?? null, companyId: companyId ?? null }
  }

  // 2. Resolve company scope.
  let scopedCompanyId = companyId ?? null
  if (!scopedCompanyId) {
    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id, user_type')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()
    scopedCompanyId = membership?.company_id ?? null
  }

  if (!scopedCompanyId) {
    return {
      allowed: false,
      error: { success: false, error: 'No company context available' },
    }
  }

  // 3. Role-based lookup, then legacy user_type fallback.
  const roleId = profile?.role_id ?? null
  let perm: {
    can_create: boolean
    can_read: string
    can_update: boolean
    can_delete: boolean
  } | null = null

  if (roleId) {
    const { data } = await supabase
      .from('role_permissions')
      .select('can_create, can_read, can_update, can_delete')
      .eq('role_id', roleId)
      .eq('company_id', scopedCompanyId)
      .eq('module_id', module)
      .maybeSingle()
    perm = data ?? null
  }

  if (!perm) {
    const { data: membership } = await supabase
      .from('company_members')
      .select('user_type')
      .eq('user_id', user.id)
      .eq('company_id', scopedCompanyId)
      .maybeSingle()
    const userType = membership?.user_type ?? globalRole
    if (userType) {
      const { data } = await supabase
        .from('role_permissions')
        .select('can_create, can_read, can_update, can_delete')
        .eq('user_type', userType)
        .eq('company_id', scopedCompanyId)
        .eq('module_id', module)
        .maybeSingle()
      perm = data ?? null
    }
  }

  const granted = (() => {
    if (!perm) return false
    switch (action) {
      case 'create': return perm.can_create === true
      case 'update': return perm.can_update === true
      case 'delete': return perm.can_delete === true
      case 'read':
        return perm.can_read != null && perm.can_read !== 'none'
    }
  })()

  if (!granted) {
    return {
      allowed: false,
      error: {
        success: false,
        error: `Forbidden: missing ${action} permission on ${module}`,
      },
    }
  }

  return {
    allowed: true,
    userId: user.id,
    roleId,
    companyId: scopedCompanyId,
  }
}
