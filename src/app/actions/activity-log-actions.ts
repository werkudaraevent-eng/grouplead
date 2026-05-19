"use server"

/**
 * Unified activity logging for client-component actions (files, notes, manual
 * timeline entries). Every call dual-writes:
 *
 *   1) `lead_activities` — drives the per-lead Timeline tab
 *   2) `audit_logs`      — drives the global /history page (via logAuditEvent)
 *
 * Without this wrapper, client components were inserting into
 * `lead_activities` directly and the global history page silently missed those
 * events (file uploads, notes, manual activity logs).
 */

import { createClient } from "@/utils/supabase/server"
import { logAuditEvent } from "@/app/actions/audit-actions"
import { revalidatePath } from "next/cache"
import type { ActionResult } from "@/types/action-result"

// ───────────────────────────────────────────────────────────────────────────
// Internal helper — fetch user + lead context once per action
// ───────────────────────────────────────────────────────────────────────────

interface ActivityContext {
    supabase: Awaited<ReturnType<typeof createClient>>
    userId: string | null
    userName: string
    leadName: string
}

async function loadContext(leadId: number): Promise<ActivityContext> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let userName = "User"
    if (user?.id) {
        const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", user.id)
            .single()
        if (profile?.full_name) userName = profile.full_name
    }

    const { data: lead } = await supabase
        .from("leads")
        .select("project_name")
        .eq("id", leadId)
        .single()

    return {
        supabase,
        userId: user?.id ?? null,
        userName,
        leadName: lead?.project_name ?? "Untitled",
    }
}

// ───────────────────────────────────────────────────────────────────────────
// File events
// ───────────────────────────────────────────────────────────────────────────

export async function logFileUploadAction(
    leadId: number,
    fileName: string,
): Promise<ActionResult> {
    try {
        const ctx = await loadContext(leadId)

        await ctx.supabase.from("lead_activities").insert({
            lead_id: leadId,
            user_id: ctx.userId,
            action_type: "File Uploaded",
            description: `${ctx.userName} uploaded "${fileName}"`,
        })

        await logAuditEvent({
            action: "create",
            resource_type: "lead",
            resource_id: String(leadId),
            resource_name: ctx.leadName,
            description: `uploaded file "${fileName}" to lead "${ctx.leadName}"`,
            metadata: { file_name: fileName, kind: "file_upload" },
        })

        revalidatePath(`/leads/${leadId}`)
        return { success: true }
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
        }
    }
}

export async function logFileDeleteAction(
    leadId: number,
    fileName: string,
): Promise<ActionResult> {
    try {
        const ctx = await loadContext(leadId)

        await ctx.supabase.from("lead_activities").insert({
            lead_id: leadId,
            user_id: ctx.userId,
            action_type: "File Deleted",
            description: `${ctx.userName} removed "${fileName}"`,
        })

        await logAuditEvent({
            action: "delete",
            resource_type: "lead",
            resource_id: String(leadId),
            resource_name: ctx.leadName,
            description: `removed file "${fileName}" from lead "${ctx.leadName}"`,
            metadata: { file_name: fileName, kind: "file_delete" },
        })

        revalidatePath(`/leads/${leadId}`)
        return { success: true }
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
        }
    }
}

// ───────────────────────────────────────────────────────────────────────────
// Note added (Notes tab)
// ───────────────────────────────────────────────────────────────────────────

export async function logNoteAddedAction(
    leadId: number,
    snippet?: string,
): Promise<ActionResult> {
    try {
        const ctx = await loadContext(leadId)
        const trimmed = (snippet ?? "").trim().slice(0, 120)

        await ctx.supabase.from("lead_activities").insert({
            lead_id: leadId,
            user_id: ctx.userId,
            action_type: "Note Added",
            description: `${ctx.userName} added a note`,
        })

        await logAuditEvent({
            action: "create",
            resource_type: "lead",
            resource_id: String(leadId),
            resource_name: ctx.leadName,
            description: `added a note on lead "${ctx.leadName}"`,
            metadata: trimmed ? { snippet: trimmed, kind: "note_added" } : { kind: "note_added" },
        })

        revalidatePath(`/leads/${leadId}`)
        return { success: true }
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
        }
    }
}

// ───────────────────────────────────────────────────────────────────────────
// Manual activity log (Timeline tab "Log Activity" dialog)
// ───────────────────────────────────────────────────────────────────────────

export type ManualActivityType = "Note" | "Email" | "Meeting" | "Task"

export async function logManualActivityAction(
    leadId: number,
    type: ManualActivityType,
    description: string,
): Promise<ActionResult> {
    try {
        const trimmedDesc = description.trim()
        if (!trimmedDesc) {
            return { success: false, error: "Description is required" }
        }

        const ctx = await loadContext(leadId)

        await ctx.supabase.from("lead_activities").insert({
            lead_id: leadId,
            user_id: ctx.userId,
            action_type: type,
            description: trimmedDesc,
        })

        await logAuditEvent({
            action: "create",
            resource_type: "lead",
            resource_id: String(leadId),
            resource_name: ctx.leadName,
            description: `logged ${type.toLowerCase()} on lead "${ctx.leadName}"`,
            metadata: {
                kind: "manual_activity",
                activity_type: type,
                snippet: trimmedDesc.slice(0, 200),
            },
        })

        revalidatePath(`/leads/${leadId}`)
        return { success: true }
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
        }
    }
}
