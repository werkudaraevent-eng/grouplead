import { createClient } from "@/utils/supabase/server"

export interface SalesMissionAccess {
  userId: string
  companyId: string
  displayName: string
  /** Same `profiles.avatar_url` LeadEngine shows; the bucket is public. */
  avatarUrl: string | null
  /** Bypasses mission-level ownership checks. Sourced from `profiles.role`. */
  isSuperAdmin: boolean
}

/**
 * Authenticates and authorizes access to Sales Mission.
 *
 * Authentication comes from shared Supabase Auth. App access comes from the
 * existing `sales_mission` permission module, so a valid sign-in alone never
 * grants access to this app — the session is shared with LeadEngine, the
 * authorization is not.
 */
export async function getSalesMissionAccess(): Promise<SalesMissionAccess | null> {
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
  if (isSuperAdmin) {
    return { userId: user.id, companyId: membership.company_id, displayName, avatarUrl, isSuperAdmin }
  }

  let permission: { can_read: string } | null = null
  if (profile.role_id) {
    const { data } = await supabase
      .from("role_permissions")
      .select("can_read")
      .eq("role_id", profile.role_id)
      .eq("company_id", membership.company_id)
      .eq("module_id", "sales_mission")
      .maybeSingle()
    permission = data
  }

  // Only a profile with no role at all consults the legacy user_type grants.
  // Falling back whenever the role happened to lack a row let a configured role
  // inherit access the permission matrix never showed and could not revoke.
  // Mirrors leadengine's require-permission.ts.
  if (!permission && !profile.role_id) {
    const userType = membership.user_type ?? globalRole
    if (userType) {
      const { data } = await supabase
        .from("role_permissions")
        .select("can_read")
        .eq("user_type", userType)
        .eq("company_id", membership.company_id)
        .eq("module_id", "sales_mission")
        .maybeSingle()
      permission = data
    }
  }

  return permission?.can_read && permission.can_read !== "none"
    ? { userId: user.id, companyId: membership.company_id, displayName, avatarUrl, isSuperAdmin }
    : null
}

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
 */
export async function canPerform(
  access: SalesMissionAccess,
  moduleId: SalesMissionModule,
  action: ModuleAction
): Promise<boolean> {
  if (access.isSuperAdmin) return true

  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return false

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, role_id")
    .eq("id", auth.user.id)
    .maybeSingle()

  const columns = "can_create, can_read, can_update, can_delete"
  let permission: Record<string, unknown> | null = null

  if (profile?.role_id) {
    const { data } = await supabase
      .from("role_permissions")
      .select(columns)
      .eq("role_id", profile.role_id)
      .eq("company_id", access.companyId)
      .eq("module_id", moduleId)
      .maybeSingle()
    permission = data
  }

  // Same rule as the app gate above: a role answers for itself.
  if (!permission && !profile?.role_id) {
    const { data: membership } = await supabase
      .from("company_members")
      .select("user_type")
      .eq("user_id", auth.user.id)
      .eq("company_id", access.companyId)
      .maybeSingle()

    const userType = membership?.user_type ?? (profile?.role ?? "").toLowerCase().replace(/\s+/g, "_")
    if (userType) {
      const { data } = await supabase
        .from("role_permissions")
        .select(columns)
        .eq("user_type", userType)
        .eq("company_id", access.companyId)
        .eq("module_id", moduleId)
        .maybeSingle()
      permission = data
    }
  }

  // Unconfigured module — see the note above.
  if (!permission) return true

  if (action === "read") {
    const scope = permission.can_read as string | null
    return Boolean(scope) && scope !== "none"
  }

  return permission[`can_${action}`] === true
}