"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { createServiceClient } from "@/utils/supabase/service"
import { logAuditEvent } from "@/app/actions/audit-actions"
import { requirePermission } from "@/lib/require-permission"
import type { ActionResult } from "@/types"

interface ProvisionUserData {
    email: string
    full_name: string
    role: string
    role_id: string | null
    department: string | null
    business_unit: string | null
    /** Business units the account belongs to. At least one is required. */
    companyIds: string[]
    /**
     * Set a password directly instead of emailing an invite.
     *
     * ADR-003 prefers the invite: a recovery link means nobody but the account
     * holder ever knows the credential. This path exists because onboarding
     * sometimes happens face to face, or the person has no working mailbox yet.
     * Which method was used is recorded in the audit log.
     */
    password?: string | null
}

/**
 * `company_members.user_type` has a CHECK constraint. A custom role name like
 * "Sales" would be rejected outright, so anything outside the set falls back to
 * the least-privileged value.
 *
 * Note the consequence: `staff` is denied the `sales_mission` module by default,
 * so a custom role relying on this fallback loses Sales Mission access unless it
 * also has a `role_id` grant. Kept deliberate and visible rather than silently
 * widening the fallback.
 */
const VALID_USER_TYPES = ["staff", "leader", "executive", "admin", "super_admin"] as const

function toUserType(roleSlug: string): string {
    return (VALID_USER_TYPES as readonly string[]).includes(roleSlug) ? roleSlug : "staff"
}

/**
 * Create an account and everything it needs to actually be usable.
 *
 * Membership used to be inserted by the browser after this action returned. When
 * that second call failed the user was left with an auth row and no
 * `company_members` record — able to sign in, but stopped by "No company context
 * available" in LeadEngine and `access_not_provisioned` in Sales Mission. Three
 * such accounts exist in production, which is why the whole sequence now happens
 * here and rolls back rather than reporting a warning.
 *
 * Two ways in. By default Supabase emails an invite and the person chooses their
 * own password, so no admin ever holds someone else's credential (ADR-003). An
 * admin can instead set one directly for face-to-face onboarding; that choice is
 * recorded in the audit log.
 */
export async function provisionUserAction(
    data: ProvisionUserData
): Promise<ActionResult<{ userId: string }>> {
    try {
        const guard = await requirePermission('members', 'create')
        if (!guard.allowed) return guard.error

        // Refuse rather than create the orphan this function exists to prevent.
        const companyIds = [...new Set((data.companyIds ?? []).filter(Boolean))]
        if (companyIds.length === 0) {
            return { success: false, error: "Pick at least one business unit for this user." }
        }

        const password = data.password?.trim() || null
        // Matches the reset-password screen and adminResetUserPassword, so the
        // same account cannot have two different minimums depending on which
        // door set the password.
        if (password !== null && password.length < 8) {
            return { success: false, error: "Password must be at least 8 characters" }
        }

        const supabase = createServiceClient()

        // 1. Create the auth user, either with a password or via an invite.
        const { data: authData, error: authError } = password
            ? await supabase.auth.admin.createUser({
                  email: data.email,
                  password,
                  // No mailbox is required on this path, and the admin has
                  // already vouched for the address by typing it.
                  email_confirm: true,
                  user_metadata: { full_name: data.full_name },
              })
            : await (async () => {
                  // The invite lands on the shared reset-password screen, which
                  // already handles a token_hash of any type.
                  const requestHeaders = await headers()
                  const origin =
                      requestHeaders.get("origin") ??
                      (requestHeaders.get("host") ? `https://${requestHeaders.get("host")}` : null)

                  return supabase.auth.admin.inviteUserByEmail(data.email, {
                      data: { full_name: data.full_name },
                      redirectTo: origin ? `${origin}/reset-password` : undefined,
                  })
              })()

        if (authError) {
            if (authError.message?.includes("already been registered")) {
                return { success: false, error: "A user with this email already exists" }
            }
            return { success: false, error: authError.message }
        }

        if (!authData.user) {
            return { success: false, error: "User creation returned no user object" }
        }

        const userId = authData.user.id

        /** Undo the auth user so a half-created account never lingers. */
        const rollback = async (reason: string): Promise<ActionResult<{ userId: string }>> => {
            await supabase.auth.admin.deleteUser(userId)
            return { success: false, error: reason }
        }

        // 2. Fill in the profile row created by the fn_handle_new_user trigger.
        const { error: profileError } = await supabase
            .from("profiles")
            .update({
                full_name: data.full_name,
                role: data.role,
                role_id: data.role_id,
                department: data.department,
                business_unit: data.business_unit,
            })
            .eq("id", userId)

        if (profileError) {
            return rollback(`Could not set up the profile: ${profileError.message}`)
        }

        // 3. Business unit membership — the gate both apps read.
        const { error: memberError } = await supabase.from("company_members").insert(
            companyIds.map((companyId) => ({
                company_id: companyId,
                user_id: userId,
                user_type: toUserType(data.role),
            }))
        )

        if (memberError) {
            return rollback(`Could not assign business units: ${memberError.message}`)
        }

        // Audit log — await so the row is durable.
        await logAuditEvent({
            action: "create",
            resource_type: "user",
            resource_id: userId,
            resource_name: data.full_name,
            description: password
                ? `created user "${data.full_name}" (${data.email}) with an admin-set password`
                : `invited user "${data.full_name}" (${data.email})`,
            // Which door was used matters later: an admin-set password means
            // someone other than the account holder knew it at least once.
            metadata: { role: data.role, companyIds, method: password ? "admin_set_password" : "invite" },
        })

        revalidatePath("/settings/users")
        return { success: true, data: { userId } }
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
        }
    }
}

export async function deactivateUserAction(
    userId: string
): Promise<ActionResult> {
    try {
        const guard = await requirePermission('members', 'update')
        if (!guard.allowed) return guard.error

        const supabase = createServiceClient()

        // Soft-delete: ban the user in Supabase Auth (prevents login)
        const { error: banError } = await supabase.auth.admin.updateUserById(
            userId,
            { ban_duration: "876600h" } // ~100 years = effectively permanent
        )

        if (banError) {
            return { success: false, error: banError.message }
        }

        // Mark profile as deactivated
        const { error: profileError } = await supabase
            .from("profiles")
            .update({ is_active: false })
            .eq("id", userId)

        if (profileError) {
            return {
                success: false,
                error: `Auth banned but profile update failed: ${profileError.message}`,
            }
        }

        // Audit log — await so the row is durable.
        await logAuditEvent({
            action: "user_management",
            resource_type: "user",
            resource_id: userId,
            description: `deactivated user account`,
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

export async function activateUserAction(
    userId: string
): Promise<ActionResult> {
    try {
        const guard = await requirePermission('members', 'update')
        if (!guard.allowed) return guard.error

        const supabase = createServiceClient()

        // Lift the auth ban so the user can log in again
        const { error: banError } = await supabase.auth.admin.updateUserById(
            userId,
            { ban_duration: "none" }
        )

        if (banError) {
            return { success: false, error: banError.message }
        }

        // Mark profile as active
        const { error: profileError } = await supabase
            .from("profiles")
            .update({ is_active: true })
            .eq("id", userId)

        if (profileError) {
            return {
                success: false,
                error: `Auth unbanned but profile update failed: ${profileError.message}`,
            }
        }

        // Audit log — await so the row is durable.
        await logAuditEvent({
            action: "user_management",
            resource_type: "user",
            resource_id: userId,
            description: `reactivated user account`,
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

export async function deleteUserAction(
    userId: string
): Promise<ActionResult> {
    try {
        const guard = await requirePermission('members', 'delete')
        if (!guard.allowed) return guard.error

        const supabase = createServiceClient()

        // Hard delete: remove from Supabase Auth (cascades to profiles via trigger/FK)
        const { error: authError } = await supabase.auth.admin.deleteUser(userId)

        if (authError) {
            return { success: false, error: authError.message }
        }

        // Clean up profile row if it wasn't cascade-deleted
        await supabase.from("profiles").delete().eq("id", userId)

        // Clean up company memberships
        await supabase.from("company_members").delete().eq("user_id", userId)

        revalidatePath("/settings/users")
        return { success: true }
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
        }
    }
}
