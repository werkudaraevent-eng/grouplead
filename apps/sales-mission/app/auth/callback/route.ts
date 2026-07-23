import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { resolveProviderDisplayName } from "@/lib/auth"
import { getSalesMissionAccess } from "@/lib/sales-mission-access"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const origin = requestUrl.origin

  if (!code) {
    const providerError = requestUrl.searchParams.get("error_description")
    const query = new URLSearchParams({ error: "auth_callback_missing_code" })
    if (providerError) query.set("error_description", providerError)
    return NextResponse.redirect(`${origin}/login?${query.toString()}`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    const query = new URLSearchParams({ error: "auth_callback_failed", error_description: error.message })
    return NextResponse.redirect(`${origin}/login?${query.toString()}`)
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed&error_description=Session%20user%20was%20not%20created`)
  }

  const fullName = resolveProviderDisplayName(user.user_metadata ?? {})
  if (fullName !== "New User" && fullName.toLowerCase() !== user.email?.trim().toLowerCase()) {
    await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id)
  }

  const access = await getSalesMissionAccess()
  if (!access) {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/login?error=access_not_provisioned`)
  }

  return NextResponse.redirect(`${origin}/`)
}
