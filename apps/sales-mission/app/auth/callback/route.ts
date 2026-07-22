import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { resolveProviderDisplayName } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const origin = requestUrl.origin

  if (!code) return NextResponse.redirect(`${origin}/login?error=auth_callback_missing_code`)

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)

  const fullName = resolveProviderDisplayName(user.user_metadata ?? {})
  if (fullName !== "New User" && fullName.toLowerCase() !== user.email?.trim().toLowerCase()) {
    await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id)
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("id", user.id)
    .maybeSingle()
  const { data: membership, error: membershipError } = await supabase
    .from("company_members")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)

  if (profileError || membershipError || profile?.is_active !== true || membership.length === 0) {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/login?error=access_not_provisioned`)
  }

  return NextResponse.redirect(`${origin}/`)
}
