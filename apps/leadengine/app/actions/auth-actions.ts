"use server"

import { revalidatePath } from "next/cache"
import { createServiceClient } from "@/utils/supabase/service"
import { logAuditEvent } from "@/app/actions/audit-actions"
import { requirePermission } from "@/lib/require-permission"
import type { ActionResult } from "@/types"

/**
 * Force-reset a user's password by UUID, using the service role.
 *
 * This used to carry an "Admin-only" comment and no check of any kind. A Server
 * Action is a public endpoint, so any signed-in user could call it with any
 * user id — including a super admin's — set a password, and sign in as them.
 * The guards below are what make the comment true.
 */
export async function adminResetUserPassword(
    userId: string,
    newPassword: string
): Promise<ActionResult> {
    try {
        const guard = await requirePermission("members", "update")
        if (!guard.allowed) return guard.error

        if (!newPassword || newPassword.length < 8) {
            return { success: false, error: "Password must be at least 8 characters" }
        }

        // Resetting your own password belongs in the profile screen, which
        // requires knowing the current one. Routing it through here would let a
        // `members.update` grant become a way to skip that.
        if (userId === guard.userId) {
            return { success: false, error: "Use your own profile settings to change your password." }
        }

        const service = createServiceClient()

        // An admin must not be able to take over an account that outranks them.
        // Read the target with the service client: the caller's own RLS may hide
        // the row, and a hidden row must not read as "not a super admin".
        const { data: target } = await service
            .from("profiles")
            .select("role, full_name, email")
            .eq("id", userId)
            .maybeSingle()

        const targetIsSuperAdmin =
            (target?.role ?? "").toLowerCase().replace(/\s+/g, "_") === "super_admin"

        if (targetIsSuperAdmin) {
            const { data: actor } = await service
                .from("profiles")
                .select("role")
                .eq("id", guard.userId)
                .maybeSingle()

            const actorIsSuperAdmin =
                (actor?.role ?? "").toLowerCase().replace(/\s+/g, "_") === "super_admin"

            if (!actorIsSuperAdmin) {
                return { success: false, error: "Only a super admin can reset another super admin's password." }
            }
        }

        const { error } = await service.auth.admin.updateUserById(userId, {
            password: newPassword,
        })

        if (error) {
            return { success: false, error: error.message }
        }

        // Someone other than the account holder now knows this password, so the
        // event is worth a durable record even though the value never is.
        await logAuditEvent({
            action: "update",
            resource_type: "user",
            resource_id: userId,
            resource_name: target?.full_name ?? target?.email ?? userId,
            description: `reset the password for "${target?.full_name ?? target?.email ?? userId}"`,
            metadata: { method: "admin_set_password" },
        })

        revalidatePath("/settings/users")
        return { success: true }
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
        }
    }
}
