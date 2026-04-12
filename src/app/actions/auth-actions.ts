"use server"

import { createClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"

type ActionResult = { success: boolean; error?: string }

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

/**
 * Admin-only: Force-reset a user's password by UUID.
 * Uses the Service Role Key to bypass RLS and auth restrictions.
 */
export async function adminResetUserPassword(
    userId: string,
    newPassword: string
): Promise<ActionResult> {
    try {
        if (!newPassword || newPassword.length < 8) {
            return { success: false, error: "Password must be at least 8 characters" }
        }

        const supabase = getAdminClient()

        const { error } = await supabase.auth.admin.updateUserById(userId, {
            password: newPassword,
        })

        if (error) {
            return { success: false, error: error.message }
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
