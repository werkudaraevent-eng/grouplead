"use server"

import { createClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"

export type ActionResult = { success: boolean; error?: string }

function getAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) {
        throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL env vars")
    }
    return createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    })
}

interface ProvisionUserData {
    email: string
    password: string
    full_name: string
    role: string
    department: string | null
    role_tier: number
    business_unit: string | null
}

export async function provisionUserAction(
    data: ProvisionUserData
): Promise<ActionResult> {
    try {
        const supabase = getAdminClient()

        // 1. Create auth user via Admin API (bypasses email confirmation)
        const { data: authData, error: authError } =
            await supabase.auth.admin.createUser({
                email: data.email,
                password: data.password,
                email_confirm: true,
                user_metadata: { full_name: data.full_name },
            })

        if (authError) {
            if (authError.message?.includes("already been registered")) {
                return { success: false, error: "A user with this email already exists" }
            }
            return { success: false, error: authError.message }
        }

        if (!authData.user) {
            return { success: false, error: "User creation returned no user object" }
        }

        // 2. Update the profile row (auto-created by fn_handle_new_user trigger)
        //    with the assignment metadata
        const { error: profileError } = await supabase
            .from("profiles")
            .update({
                full_name: data.full_name,
                role: data.role,
                department: data.department,
                role_tier: data.role_tier,
                business_unit: data.business_unit,
            })
            .eq("id", authData.user.id)

        if (profileError) {
            return {
                success: false,
                error: `User created but profile update failed: ${profileError.message}`,
            }
        }

        revalidatePath("/settings/users")
        return { success: true }
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
        }
    }
}
