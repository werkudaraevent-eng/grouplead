"use server"

/**
 * Task (lead checklist) server actions with dual activity logging.
 *
 * Every mutation:
 *   1. Writes to `lead_checklists`
 *   2. Writes to `lead_activities` (per-lead Timeline)
 *   3. Writes to `audit_logs` for the events that matter at audit scope
 *      (add / complete / reopen / delete / assign / due_set).
 *      Rename and quick toggle-spam stay out of /history to keep the
 *      audit trail signal strong.
 */

import { createClient } from "@/utils/supabase/server"
import { createServiceClient } from "@/utils/supabase/service"
import { logAuditEvent } from "@/app/actions/audit-actions"
import { revalidatePath } from "next/cache"
import type { ActionResult } from "@/types/action-result"

interface ChecklistRow {
    id: string
    lead_id: number
    title: string
    is_completed: boolean
    sort_order: number
    completed_at: string | null
    created_at: string
    assignee_id: string | null
    due_date: string | null
}

interface TaskContext {
    supabase: Awaited<ReturnType<typeof createClient>>
    userId: string | null
    userName: string
    leadName: string
}

async function loadContext(leadId: number): Promise<TaskContext> {
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

async function getAssigneeName(
    supabase: Awaited<ReturnType<typeof createClient>>,
    assigneeId: string | null,
): Promise<string | null> {
    if (!assigneeId) return null
    const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", assigneeId)
        .single()
    return data?.full_name ?? null
}

// ───────────────────────────────────────────────────────────────────────────
// Create task
// ───────────────────────────────────────────────────────────────────────────

export interface CreateTaskInput {
    leadId: number
    title: string
    sortOrder: number
    assigneeId?: string | null
    dueDate?: string | null
}

export async function createTaskAction(
    input: CreateTaskInput,
): Promise<ActionResult<{ id: string }>> {
    try {
        const trimmedTitle = input.title.trim()
        if (!trimmedTitle) {
            return { success: false, error: "Title is required" }
        }

        const ctx = await loadContext(input.leadId)

        const { data: created, error } = await ctx.supabase
            .from("lead_checklists")
            .insert({
                lead_id: input.leadId,
                title: trimmedTitle,
                is_completed: false,
                sort_order: input.sortOrder,
                assignee_id: input.assigneeId ?? null,
                due_date: input.dueDate ?? null,
            })
            .select("id")
            .single()

        if (error) return { success: false, error: error.message }

        // Build a richer description if PIC/due are set up-front.
        const assigneeName = await getAssigneeName(ctx.supabase, input.assigneeId ?? null)
        const extras: string[] = []
        if (assigneeName) extras.push(`assigned to ${assigneeName}`)
        if (input.dueDate) extras.push(`due ${input.dueDate}`)
        const suffix = extras.length > 0 ? ` (${extras.join(", ")})` : ""

        await ctx.supabase.from("lead_activities").insert({
            lead_id: input.leadId,
            user_id: ctx.userId,
            action_type: "Task Added",
            description: `${ctx.userName} added task "${trimmedTitle}"${suffix}`,
        })

        await logAuditEvent({
            action: "create",
            resource_type: "lead",
            resource_id: String(input.leadId),
            resource_name: ctx.leadName,
            description: `added task "${trimmedTitle}" to lead "${ctx.leadName}"${suffix}`,
            metadata: {
                kind: "task_added",
                task_id: created.id,
                title: trimmedTitle,
                assignee_id: input.assigneeId ?? null,
                due_date: input.dueDate ?? null,
            },
        })

        revalidatePath(`/leads/${input.leadId}`)
        return { success: true, data: { id: created.id } }
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
        }
    }
}

// ───────────────────────────────────────────────────────────────────────────
// Toggle complete / reopen
// ───────────────────────────────────────────────────────────────────────────

export async function toggleTaskAction(
    taskId: string,
    nextCompleted: boolean,
): Promise<ActionResult> {
    try {
        const supabase = await createClient()

        const { data: existing, error: fetchError } = await supabase
            .from("lead_checklists")
            .select("id, lead_id, title, is_completed")
            .eq("id", taskId)
            .single()

        if (fetchError || !existing) {
            return { success: false, error: fetchError?.message ?? "Task not found" }
        }

        // No-op if state matches — avoid noise in activity logs.
        if (existing.is_completed === nextCompleted) {
            return { success: true }
        }

        const completedAt = nextCompleted ? new Date().toISOString() : null
        const { error: updateError } = await supabase
            .from("lead_checklists")
            .update({ is_completed: nextCompleted, completed_at: completedAt })
            .eq("id", taskId)

        if (updateError) return { success: false, error: updateError.message }

        const ctx = await loadContext(existing.lead_id)
        const verb = nextCompleted ? "completed" : "reopened"
        const actionType = nextCompleted ? "Task Completed" : "Task Reopened"

        await ctx.supabase.from("lead_activities").insert({
            lead_id: existing.lead_id,
            user_id: ctx.userId,
            action_type: actionType,
            description: `${ctx.userName} ${verb} task "${existing.title}"`,
        })

        await logAuditEvent({
            action: "update",
            resource_type: "lead",
            resource_id: String(existing.lead_id),
            resource_name: ctx.leadName,
            description: `${verb} task "${existing.title}" on lead "${ctx.leadName}"`,
            metadata: {
                kind: nextCompleted ? "task_completed" : "task_reopened",
                task_id: existing.id,
                title: existing.title,
            },
        })

        revalidatePath(`/leads/${existing.lead_id}`)
        return { success: true }
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
        }
    }
}

// ───────────────────────────────────────────────────────────────────────────
// Rename — Timeline only, no /history (too noisy)
// ───────────────────────────────────────────────────────────────────────────

export async function renameTaskAction(
    taskId: string,
    newTitle: string,
): Promise<ActionResult> {
    try {
        const trimmed = newTitle.trim()
        if (!trimmed) return { success: false, error: "Title is required" }

        const supabase = await createClient()

        const { data: existing, error: fetchError } = await supabase
            .from("lead_checklists")
            .select("id, lead_id, title")
            .eq("id", taskId)
            .single()

        if (fetchError || !existing) {
            return { success: false, error: fetchError?.message ?? "Task not found" }
        }

        if (existing.title === trimmed) return { success: true }

        const { error: updateError } = await supabase
            .from("lead_checklists")
            .update({ title: trimmed })
            .eq("id", taskId)

        if (updateError) return { success: false, error: updateError.message }

        const ctx = await loadContext(existing.lead_id)
        await ctx.supabase.from("lead_activities").insert({
            lead_id: existing.lead_id,
            user_id: ctx.userId,
            action_type: "Task Updated",
            description: `${ctx.userName} renamed task "${existing.title}" to "${trimmed}"`,
        })

        revalidatePath(`/leads/${existing.lead_id}`)
        return { success: true }
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
        }
    }
}

// ───────────────────────────────────────────────────────────────────────────
// Assign / unassign PIC
// ───────────────────────────────────────────────────────────────────────────

export async function assignTaskAction(
    taskId: string,
    assigneeId: string | null,
): Promise<ActionResult> {
    try {
        const supabase = await createClient()

        const { data: existing, error: fetchError } = await supabase
            .from("lead_checklists")
            .select("id, lead_id, title, assignee_id")
            .eq("id", taskId)
            .single()

        if (fetchError || !existing) {
            return { success: false, error: fetchError?.message ?? "Task not found" }
        }

        if ((existing.assignee_id ?? null) === (assigneeId ?? null)) {
            return { success: true }
        }

        const { error: updateError } = await supabase
            .from("lead_checklists")
            .update({ assignee_id: assigneeId })
            .eq("id", taskId)

        if (updateError) return { success: false, error: updateError.message }

        const ctx = await loadContext(existing.lead_id)
        const [prevName, nextName] = await Promise.all([
            getAssigneeName(ctx.supabase, existing.assignee_id),
            getAssigneeName(ctx.supabase, assigneeId),
        ])

        let description: string
        let auditDescription: string
        let kind: string
        if (assigneeId === null) {
            description = `${ctx.userName} unassigned task "${existing.title}"`
            auditDescription = `unassigned task "${existing.title}" on lead "${ctx.leadName}"`
            kind = "task_unassigned"
        } else if (existing.assignee_id === null) {
            description = `${ctx.userName} assigned task "${existing.title}" to ${nextName ?? "user"}`
            auditDescription = `assigned task "${existing.title}" to ${nextName ?? "user"} on lead "${ctx.leadName}"`
            kind = "task_assigned"
        } else {
            description = `${ctx.userName} reassigned task "${existing.title}" from ${prevName ?? "previous"} to ${nextName ?? "user"}`
            auditDescription = `reassigned task "${existing.title}" from ${prevName ?? "previous"} to ${nextName ?? "user"} on lead "${ctx.leadName}"`
            kind = "task_reassigned"
        }

        await ctx.supabase.from("lead_activities").insert({
            lead_id: existing.lead_id,
            user_id: ctx.userId,
            action_type: "Task Updated",
            description,
        })

        await logAuditEvent({
            action: "update",
            resource_type: "lead",
            resource_id: String(existing.lead_id),
            resource_name: ctx.leadName,
            description: auditDescription,
            metadata: {
                kind,
                task_id: existing.id,
                title: existing.title,
                from_assignee_id: existing.assignee_id,
                to_assignee_id: assigneeId,
            },
        })

        revalidatePath(`/leads/${existing.lead_id}`)
        return { success: true }
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
        }
    }
}

// ───────────────────────────────────────────────────────────────────────────
// Set / clear due date
// ───────────────────────────────────────────────────────────────────────────

export async function setTaskDueDateAction(
    taskId: string,
    dueDate: string | null,
): Promise<ActionResult> {
    try {
        const supabase = await createClient()

        const { data: existing, error: fetchError } = await supabase
            .from("lead_checklists")
            .select("id, lead_id, title, due_date")
            .eq("id", taskId)
            .single()

        if (fetchError || !existing) {
            return { success: false, error: fetchError?.message ?? "Task not found" }
        }

        const prevDue = existing.due_date ?? null
        const nextDue = dueDate ?? null
        if (prevDue === nextDue) return { success: true }

        const { error: updateError } = await supabase
            .from("lead_checklists")
            .update({ due_date: nextDue })
            .eq("id", taskId)

        if (updateError) return { success: false, error: updateError.message }

        const ctx = await loadContext(existing.lead_id)

        let description: string
        let auditDescription: string
        let kind: string
        if (nextDue === null) {
            description = `${ctx.userName} cleared due date on task "${existing.title}"`
            auditDescription = `cleared due date on task "${existing.title}" on lead "${ctx.leadName}"`
            kind = "task_due_cleared"
        } else if (prevDue === null) {
            description = `${ctx.userName} set due date ${nextDue} on task "${existing.title}"`
            auditDescription = `set due date ${nextDue} on task "${existing.title}" on lead "${ctx.leadName}"`
            kind = "task_due_set"
        } else {
            description = `${ctx.userName} changed due date on task "${existing.title}" from ${prevDue} to ${nextDue}`
            auditDescription = `changed due date on task "${existing.title}" from ${prevDue} to ${nextDue} on lead "${ctx.leadName}"`
            kind = "task_due_changed"
        }

        await ctx.supabase.from("lead_activities").insert({
            lead_id: existing.lead_id,
            user_id: ctx.userId,
            action_type: "Task Updated",
            description,
        })

        await logAuditEvent({
            action: "update",
            resource_type: "lead",
            resource_id: String(existing.lead_id),
            resource_name: ctx.leadName,
            description: auditDescription,
            metadata: {
                kind,
                task_id: existing.id,
                title: existing.title,
                from_due: prevDue,
                to_due: nextDue,
            },
        })

        revalidatePath(`/leads/${existing.lead_id}`)
        return { success: true }
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
        }
    }
}

// ───────────────────────────────────────────────────────────────────────────
// Delete task
// ───────────────────────────────────────────────────────────────────────────

export async function deleteTaskAction(
    taskId: string,
): Promise<ActionResult> {
    try {
        const supabase = await createClient()

        const { data: existing, error: fetchError } = await supabase
            .from("lead_checklists")
            .select("id, lead_id, title")
            .eq("id", taskId)
            .single()

        if (fetchError || !existing) {
            return { success: false, error: fetchError?.message ?? "Task not found" }
        }

        const { error: deleteError } = await supabase
            .from("lead_checklists")
            .delete()
            .eq("id", taskId)

        if (deleteError) return { success: false, error: deleteError.message }

        const ctx = await loadContext(existing.lead_id)

        await ctx.supabase.from("lead_activities").insert({
            lead_id: existing.lead_id,
            user_id: ctx.userId,
            action_type: "Task Deleted",
            description: `${ctx.userName} deleted task "${existing.title}"`,
        })

        await logAuditEvent({
            action: "delete",
            resource_type: "lead",
            resource_id: String(existing.lead_id),
            resource_name: ctx.leadName,
            description: `deleted task "${existing.title}" on lead "${ctx.leadName}"`,
            metadata: {
                kind: "task_deleted",
                task_id: existing.id,
                title: existing.title,
            },
        })

        revalidatePath(`/leads/${existing.lead_id}`)
        return { success: true }
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
        }
    }
}

// ───────────────────────────────────────────────────────────────────────────
// Assignable users — company-scoped via company_members
// ───────────────────────────────────────────────────────────────────────────

export interface AssignableUser {
    id: string
    full_name: string
    avatar_url: string | null
}

/**
 * Returns active profiles that are members of the lead's owning company.
 *
 * Uses a SECURITY DEFINER service-role client because RLS on
 * `company_members` only exposes the caller's own membership rows
 * (`user_id = auth.uid()`) — so a non-admin user calling this with the user
 * client would only ever see themselves as assignable. We still gate the
 * function behind an authenticated session before doing the elevated read.
 *
 * Falls back to all active profiles when:
 *   - the lead has no `company_id`
 *   - or the company has no `company_members` rows yet
 * so the assign popover never appears empty in setups where membership
 * hasn't been provisioned.
 */
export async function listAssignableUsersForLeadAction(
    leadId: number,
): Promise<AssignableUser[]> {
    // Authentication gate — only signed-in users can list assignable users.
    const userClient = await createClient()
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return []

    const admin = createServiceClient()

    const fetchAllActive = async (): Promise<AssignableUser[]> => {
        const { data, error } = await admin
            .from("profiles")
            .select("id, full_name, avatar_url")
            .eq("is_active", true)
            .order("full_name")
        if (error) {
            console.error("[task-actions] fetch all active profiles error:", error.message)
            return []
        }
        return (data ?? []).filter((u): u is AssignableUser => Boolean(u.full_name))
    }

    const { data: lead, error: leadErr } = await admin
        .from("leads")
        .select("company_id")
        .eq("id", leadId)
        .single()

    if (leadErr) {
        console.error("[task-actions] fetch lead error:", leadErr.message)
        return fetchAllActive()
    }

    if (!lead?.company_id) {
        return fetchAllActive()
    }

    const { data: members, error: memberErr } = await admin
        .from("company_members")
        .select("user_id")
        .eq("company_id", lead.company_id)

    if (memberErr) {
        console.error("[task-actions] fetch members error:", memberErr.message)
        return fetchAllActive()
    }

    const ids = (members ?? []).map((m) => m.user_id).filter(Boolean)
    if (ids.length === 0) {
        // No memberships provisioned for this company yet — degrade
        // gracefully instead of returning an empty list.
        return fetchAllActive()
    }

    const { data: profiles, error: profErr } = await admin
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", ids)
        .eq("is_active", true)
        .order("full_name")

    if (profErr) {
        console.error("[task-actions] fetch profiles error:", profErr.message)
        return fetchAllActive()
    }

    const scoped = (profiles ?? []).filter((u): u is AssignableUser => Boolean(u.full_name))
    // Defensive: if the join produced zero usable rows (e.g. all members
    // have null full_name), fall back to all active profiles.
    return scoped.length > 0 ? scoped : fetchAllActive()
}
