"use server"

import { createClient } from "@/utils/supabase/server"

export type LeadTab = "scope" | "notes" | "timeline" | "tasks"

export interface LeadTabUnreadState {
    scope: boolean
    notes: boolean
    timeline: boolean
    tasks: boolean
}

const BRIEF_FIELDS = ["general_brief", "production_sow", "special_remarks"]

/**
 * Returns unread flag for each tab of a lead, relative to the current user's
 * last_viewed_at. An activity/item counts as "unread" if it was created AFTER
 * the user last viewed that tab AND was performed by someone else.
 * If the user has never viewed a tab, falls back to lead.created_at so
 * fresh leads don't spam dots.
 */
export async function fetchLeadTabUnreadStateAction(
    leadId: number
): Promise<LeadTabUnreadState> {
    const defaultState: LeadTabUnreadState = {
        scope: false,
        notes: false,
        timeline: false,
        tasks: false,
    }

    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return defaultState

        // Fetch all last_viewed_at rows for this user+lead in one query
        const { data: viewRows } = await supabase
            .from("lead_tab_views")
            .select("tab, last_viewed_at")
            .eq("user_id", user.id)
            .eq("lead_id", leadId)

        const viewedMap: Record<string, string> = {}
        for (const row of viewRows ?? []) {
            viewedMap[row.tab] = row.last_viewed_at
        }

        // Fallback baseline for never-viewed tabs: lead.created_at
        // (prevents badges flashing on every lead a user has never opened)
        let fallbackBaseline: string | null = null
        if (Object.keys(viewedMap).length < 4) {
            const { data: leadRow } = await supabase
                .from("leads")
                .select("created_at")
                .eq("id", leadId)
                .maybeSingle()
            fallbackBaseline = leadRow?.created_at ?? null
        }

        const cutoff = (tab: LeadTab): string | null =>
            viewedMap[tab] ?? fallbackBaseline

        // Helper: count > 0 check (we only need existence, limit(1))
        const hasSince = async (
            table: string,
            cutoffTs: string | null,
            extraFilter?: (q: ReturnType<typeof supabase.from>) => ReturnType<typeof supabase.from>
        ): Promise<boolean> => {
            if (!cutoffTs) return false
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let q: any = supabase.from(table).select("id", { count: "exact", head: true })
            q = q.eq("lead_id", leadId).gt("created_at", cutoffTs)
            if (extraFilter) q = extraFilter(q)
            const { count } = await q
            return (count ?? 0) > 0
        }

        // Scope & Brief: lead_activities with field_update for brief fields, by OTHER users
        const scopeCutoff = cutoff("scope")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const scopeUnread = await (async (): Promise<boolean> => {
            if (!scopeCutoff) return false
            const { count } = await supabase
                .from("lead_activities")
                .select("id", { count: "exact", head: true })
                .eq("lead_id", leadId)
                .eq("action_type", "field_update")
                .in("field_name", BRIEF_FIELDS)
                .gt("created_at", scopeCutoff)
                .neq("user_id", user.id)
            return (count ?? 0) > 0
        })()

        // Notes: lead_notes by OTHER users
        const notesCutoff = cutoff("notes")
        const notesUnread = await (async (): Promise<boolean> => {
            if (!notesCutoff) return false
            const { count } = await supabase
                .from("lead_notes")
                .select("id", { count: "exact", head: true })
                .eq("lead_id", leadId)
                .gt("created_at", notesCutoff)
                .neq("user_id", user.id)
            return (count ?? 0) > 0
        })()

        // Timeline: any lead_activities by OTHER users (broad scope)
        const timelineCutoff = cutoff("timeline")
        const timelineUnread = await (async (): Promise<boolean> => {
            if (!timelineCutoff) return false
            const { count } = await supabase
                .from("lead_activities")
                .select("id", { count: "exact", head: true })
                .eq("lead_id", leadId)
                .gt("created_at", timelineCutoff)
                .neq("user_id", user.id)
            return (count ?? 0) > 0
        })()

        // Tasks: lead_checklists (no user_id column, so we can't exclude self —
        // use created_at > cutoff as proxy)
        const tasksCutoff = cutoff("tasks")
        const tasksUnread = await hasSince("lead_checklists", tasksCutoff)

        return {
            scope: scopeUnread,
            notes: notesUnread,
            timeline: timelineUnread,
            tasks: tasksUnread,
        }
    } catch {
        return defaultState
    }
}

/**
 * Mark a tab as viewed NOW by the current user. Upserts into lead_tab_views.
 */
export async function markLeadTabViewedAction(
    leadId: number,
    tab: LeadTab
): Promise<{ success: boolean }> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false }

        await supabase
            .from("lead_tab_views")
            .upsert(
                {
                    user_id: user.id,
                    lead_id: leadId,
                    tab,
                    last_viewed_at: new Date().toISOString(),
                },
                { onConflict: "user_id,lead_id,tab" }
            )

        return { success: true }
    } catch {
        return { success: false }
    }
}
