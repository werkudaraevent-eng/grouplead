import { createClient } from "@/utils/supabase/server"
import type { SalesMissionAccess } from "@/lib/sales-mission-access"

export interface MyProfile {
  fullName: string
  email: string
  phone: string
  jobTitle: string
  avatarUrl: string | null
  /** The role's name as the admin set it in LeadEngine; read-only here. */
  roleName: string | null
}

/**
 * The signed-in person's own profile, as LeadEngine's Settings › Account › Profile
 * reads it: `public.profiles` under the person's session (every profile is
 * readable; only their own is writable), the email from the sign-in, the
 * role's name from `roles`.
 */
export async function getMyProfile(access: SalesMissionAccess): Promise<MyProfile> {
  const supabase = await createClient()
  const [{ data: auth }, { data: profile }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("profiles")
      .select("full_name, email, phone, job_title, avatar_url, role, assigned_role:roles(name)")
      .eq("id", access.userId)
      .maybeSingle(),
  ])
  const assigned = (profile as { assigned_role?: { name?: string | null } | { name?: string | null }[] | null } | null)?.assigned_role
  const roleName = (Array.isArray(assigned) ? assigned[0]?.name : assigned?.name) ?? (profile?.role as string | null) ?? null
  return {
    fullName: (profile?.full_name as string | null)?.trim() || access.displayName,
    email: auth.user?.email ?? (profile?.email as string | null) ?? "",
    phone: (profile?.phone as string | null) ?? "",
    jobTitle: (profile?.job_title as string | null) ?? "",
    avatarUrl: (profile?.avatar_url as string | null)?.trim() || null,
    roleName,
  }
}
