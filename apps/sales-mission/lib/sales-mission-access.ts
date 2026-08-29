import { createClient } from "@/utils/supabase/server"

export interface SalesMissionAccess {
  userId: string
  companyId: string
  displayName: string
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
      .select("is_active, role, role_id, full_name")
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

  const globalRole = (profile.role ?? "").toLowerCase().replace(/\s+/g, "_")
  const isSuperAdmin = globalRole === "super_admin"
  if (isSuperAdmin) {
    return { userId: user.id, companyId: membership.company_id, displayName, isSuperAdmin }
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

  if (!permission) {
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
    ? { userId: user.id, companyId: membership.company_id, displayName, isSuperAdmin }
    : null
}

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

  if (!permission) {
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