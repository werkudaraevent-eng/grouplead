import { cache } from "react"
import { createClient } from "@/utils/supabase/server"

export interface SalesMissionAccess {
  userId: string
  companyId: string
  displayName: string
  /** Same `profiles.avatar_url` LeadEngine shows; the bucket is public. */
  avatarUrl: string | null
  /** Bypasses mission-level ownership checks. Sourced from `profiles.role`. */
  isSuperAdmin: boolean
  /**
   * What `canPerform` looks permissions up by, carried here so a sub-permission
   * check is one query rather than a fresh sign-in check plus a profile read.
   * `roleId` wins; `userType` is the legacy grant consulted only when there is
   * no role at all.
   */
  roleId: string | null
  userType: string | null
}

/**
 * Authenticates and authorizes access to Sales Mission.
 *
 * Authentication comes from shared Supabase Auth. App access comes from the
 * existing `sales_mission` permission module, so a valid sign-in alone never
 * grants access to this app — the session is shared with LeadEngine, the
 * authorization is not.
 *
 * Memoised per request with React `cache`. A page calls this once at the top
 * and then several helpers call it again; each call used to be a round trip to
 * the auth server plus two table reads, so a detail page paid for the same
 * answer four or five times before drawing anything.
 */
export const getSalesMissionAccess = cache(async (): Promise<SalesMissionAccess | null> => {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth.user
  if (!user) return null

  const [profileResult, membershipResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("is_active, role, role_id, full_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("company_members")
      .select("company_id, user_type")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle(),
  ])

  const profile = profileResult.data
  const membership = membershipResult.data
  if (profileResult.error || membershipResult.error || profile?.is_active !== true || !membership?.company_id) {
    return null
  }

  // The profile row is the only source for a person's name. Provider claims are
  // not used: a handed-down account would keep overwriting the corrected name
  // with the previous holder's.
  const displayName = profile.full_name?.trim() || user.email?.trim() || "Unknown user"
  const avatarUrl = profile.avatar_url?.trim() || null

  const globalRole = (profile.role ?? "").toLowerCase().replace(/\s+/g, "_")
  const isSuperAdmin = globalRole === "super_admin"
  const roleId = (profile.role_id as string | null) ?? null
  // Only a profile with no role at all consults the legacy user_type grants.
  // Falling back whenever the role happened to lack a row let a configured role
  // inherit access the permission matrix never showed and could not revoke.
  // Mirrors leadengine's require-permission.ts.
  const userType = roleId ? null : ((membership.user_type as string | null) ?? globalRole ?? null) || null

  const access: SalesMissionAccess = {
    userId: user.id,
    companyId: membership.company_id,
    displayName,
    avatarUrl,
    isSuperAdmin,
    roleId,
    userType,
  }
  if (isSuperAdmin) return access

  const permission = await loadModulePermission(access.companyId, roleId, userType, "sales_mission")
  return permission?.can_read && permission.can_read !== "none" ? access : null
})

/**
 * What each module governs, so the admin matrix and the code agree:
 *
 *   mission  — the mission record and its team. Every write in
 *              assignment-actions asks for `update`; only creating a mission
 *              asks for `create`.
 *   result   — the visit report on all four of its surfaces: the detail page,
 *              the reporting screen, the CSV export, and the LeadEngine push.
 *   contact  — reading client people: the appointment block and the "ketemu
 *              siapa" list. Writing them is deliberately NOT separate: contacts
 *              are collected inside the visit report, which requires at least
 *              one, so a role that could write reports but not contacts could
 *              never submit anything. Report writes answer to `result`.
 *   settings — the Pengaturan screen.
 */
export type SalesMissionModule =
  | "sales_mission_mission"
  | "sales_mission_result"
  | "sales_mission_contact"
  | "sales_mission_settings"

export type ModuleAction = "create" | "read" | "update" | "delete"

interface ModulePermission {
  can_create: boolean | null
  can_read: string | null
  can_update: boolean | null
  can_delete: boolean | null
}

/**
 * The one row that answers a permission question, memoised per request.
 *
 * A role answers for itself: with a role_id only that role's row is read,
 * and the legacy user_type row is consulted only for a profile with no role.
 * Keyed on primitives so React's cache dedupes the detail page's several
 * `canPerform` calls for the same module into one read.
 */
const loadModulePermission = cache(
  async (
    companyId: string,
    roleId: string | null,
    userType: string | null,
    moduleId: string
  ): Promise<ModulePermission | null> => {
    const supabase = await createClient()
    const columns = "can_create, can_read, can_update, can_delete"

    if (roleId) {
      const { data } = await supabase
        .from("role_permissions")
        .select(columns)
        .eq("role_id", roleId)
        .eq("company_id", companyId)
        .eq("module_id", moduleId)
        .maybeSingle()
      return (data as ModulePermission | null) ?? null
    }

    if (userType) {
      const { data } = await supabase
        .from("role_permissions")
        .select(columns)
        .eq("user_type", userType)
        .eq("company_id", companyId)
        .eq("module_id", moduleId)
        .maybeSingle()
      return (data as ModulePermission | null) ?? null
    }

    return null
  }
)

/**
 * Fine-grained permission inside Sales Mission.
 *
 * These are sub-permissions of an app the user already holds — they passed the
 * `sales_mission` gate to get here. So an unconfigured module means "not
 * restricted", not "denied": a tenant that has never opened the permission
 * matrix must not find the app broken. Admins tighten from there.
 *
 * Note this is deliberately weaker than the `sales_mission` gate itself, which
 * denies by default. Losing app access should lock you out; losing a
 * sub-permission that nobody has configured should not.
 *
 * Trusts the `access` it is handed. It used to re-verify the session and
 * re-read the profile on every call, three round trips to answer a question
 * the caller had already paid to answer; a screen with four checks spent more
 * time on permissions than on its own data.
 */
export async function canPerform(
  access: SalesMissionAccess,
  moduleId: SalesMissionModule,
  action: ModuleAction
): Promise<boolean> {
  if (access.isSuperAdmin) return true

  const permission = await loadModulePermission(access.companyId, access.roleId, access.userType, moduleId)

  // Unconfigured module — see the note above.
  if (!permission) return true

  if (action === "read") {
    const scope = permission.can_read
    return Boolean(scope) && scope !== "none"
  }

  return permission[`can_${action}`] === true
}
