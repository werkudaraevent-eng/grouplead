import { createClient } from "@/utils/supabase/server"

export interface SalesMissionAccess {
  userId: string
  companyId: string
  displayName: string
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
  if (globalRole === "super_admin") {
    return { userId: user.id, companyId: membership.company_id, displayName }
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
    ? { userId: user.id, companyId: membership.company_id, displayName }
    : null
}