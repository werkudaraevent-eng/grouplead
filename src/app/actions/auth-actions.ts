"use server"

import { revalidatePath } from "next/cache"
import { createServiceClient } from "@/utils/supabase/service"
import type { ActionResult } from "@/types"

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

        const supabase = createServiceClient()

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
