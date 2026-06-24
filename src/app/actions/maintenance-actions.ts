"use server"

import { createClient } from "@/utils/supabase/server"
import { createServiceClient } from "@/utils/supabase/service"
import { logAuditEvent } from "@/app/actions/audit-actions"
import { revalidatePath } from "next/cache"
import type { ActionResult } from "@/types/action-result"

export interface MaintenanceStatus {
    enabled: boolean
    message: string | null
    startedAt: string | null
}

/**
 * Read the current global maintenance status. Safe for any authenticated
 * user (used by the client kick-out poller and the Settings card).
 */
export async function getMaintenanceStatus(): Promise<MaintenanceStatus> {
    try {
        const supabase = await createClient()
        const { data } = await supabase
            .from("app_settings")
            .select("maintenance_enabled, maintenance_message, maintenance_started_at")
            .eq("id", 1)
            .maybeSingle()
        return {
            enabled: !!data?.maintenance_enabled,
            message: data?.maintenance_message ?? null,
            startedAt: data?.maintenance_started_at ?? null,
        }
    } catch {
        // Fail-open: treat as not in maintenance.
        return { enabled: false, message: null, startedAt: null }
    }
}

/**
 * Toggle global maintenance mode. SUPER ADMIN ONLY.
 *
 * Full-lockdown semantics: when enabled, middleware + requirePermission block
 * every non-super-admin from the app. The toggle, the custom message, and the
 * actor are all audit-logged.
 */
export async function toggleMaintenanceAction(
    enabled: boolean,
    message?: string,
): Promise<ActionResult> {
    try {
        const supabase = await createClient()
        const { data: auth } = await supabase.auth.getUser()
        const user = auth?.user
        if (!user?.id) {
            return { success: false, error: "Not authenticated" }
        }

        // Hard gate: super_admin only.
        const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .maybeSingle()
        const role = (profile?.role ?? "").toLowerCase().replace(/\s+/g, "_")
        if (role !== "super_admin") {
            return { success: false, error: "Only a Super Admin can change maintenance mode." }
        }

        const service = createServiceClient()
        const { error } = await service
            .from("app_settings")
            .update({
                maintenance_enabled: enabled,
                // Only overwrite the message when one is provided; keep the
                // existing copy otherwise.
                ...(message !== undefined ? { maintenance_message: message.trim() || null } : {}),
                maintenance_started_at: enabled ? new Date().toISOString() : null,
                updated_by: user.id,
                updated_at: new Date().toISOString(),
            })
            .eq("id", 1)

        if (error) {
            return { success: false, error: error.message }
        }

        // Audit — durable record of who flipped the switch and when.
        await logAuditEvent({
            action: enabled ? "maintenance_on" : "maintenance_off",
            resource_type: "app_settings",
            resource_id: "1",
            resource_name: "Maintenance Mode",
            description: enabled
                ? "enabled platform maintenance mode (full lockdown)"
                : "disabled platform maintenance mode",
            metadata: { enabled, message: message ?? null },
        })

        revalidatePath("/", "layout")
        return { success: true }
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Failed to toggle maintenance mode",
        }
    }
}
