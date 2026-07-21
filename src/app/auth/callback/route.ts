import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get("code")
    const origin = requestUrl.origin

    if (!code) {
        return NextResponse.redirect(`${origin}/login?error=auth_callback_missing_code`)
    }

    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
        return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
    }

    // Azure can authenticate any user allowed by the Entra application, but
    // LeadEngine access requires local provisioning too. A Supabase profile
    // created by the auth trigger is not enough: the user must be active and
    // belong to at least one internal tenant.
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
    }

    const [profileResult, membershipResult] = await Promise.all([
        supabase
            .from("profiles")
            .select("is_active")
            .eq("id", user.id)
            .maybeSingle(),
        supabase
            .from("company_members")
            .select("id")
            .eq("user_id", user.id)
            .limit(1),
    ])

    const isActive = profileResult.data?.is_active === true
    const hasMembership = (membershipResult.data?.length ?? 0) > 0

    if (profileResult.error || membershipResult.error || !isActive || !hasMembership) {
        await supabase.auth.signOut()
        return NextResponse.redirect(`${origin}/login?error=access_not_provisioned`)
    }

    return NextResponse.redirect(`${origin}/`)
}