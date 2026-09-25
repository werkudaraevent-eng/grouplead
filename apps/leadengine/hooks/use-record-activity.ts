"use client"

import { useCallback, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createClient } from "@/utils/supabase/client"
import { listRecordAssigneesAction } from "@/app/actions/record-activity-actions"
import type { AssignableUser } from "@/lib/assignable-users"
import { activityColumns, composerKind, composerSchema, type ComposerInput, type LoggedInput } from "@/lib/record-activity"

/**
 * Where a record's notes and timeline live: a contact's in `contact_notes`
 * and `contact_activities` by `contact_id`, a company's in `company_notes`
 * and `company_activities` by `client_company_id`.
 */
export interface RecordActivityTarget {
    kind: "contact" | "company"
    notesTable: "contact_notes" | "company_notes"
    activitiesTable: "contact_activities" | "company_activities"
    foreignKey: "contact_id" | "client_company_id"
    id: string
}

export const contactActivityTarget = (id: string): RecordActivityTarget => ({
    kind: "contact", notesTable: "contact_notes", activitiesTable: "contact_activities", foreignKey: "contact_id", id,
})

export const companyActivityTarget = (id: string): RecordActivityTarget => ({
    kind: "company", notesTable: "company_notes", activitiesTable: "company_activities", foreignKey: "client_company_id", id,
})

/**
 * Writes a record's activity: a note to the notes table (the database
 * copies it to the timeline), a call, a meeting, an email or a follow-up to
 * the timeline with its typed columns (`activityColumns`), each checked
 * against the composer's schema first. Row security decides who may write
 * what (the record visible to them; a change or a delete by the author or
 * an admin; a follow-up ticked by the person it is for too), so a write it
 * refuses (no row comes back) is said as such. Every write refreshes the
 * page, whose server render reads the feed, the counts and "Last activity"
 * again. Each returns whether it worked; a failure is said in a toast.
 */
export function useRecordActivity(target: RecordActivityTarget) {
    const router = useRouter()
    const { notesTable, activitiesTable, foreignKey, id } = target

    const log = useCallback(async (input: ComposerInput): Promise<boolean> => {
        const checked = composerSchema(new Date()).safeParse(input)
        if (!checked.success) { toast.error(checked.error.issues[0]?.message ?? "Check the form"); return false }
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { toast.error("You must be signed in"); return false }
        const kind = composerKind(input.kind)
        if (checked.data.kind === "note") {
            const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single()
            const { error } = await supabase.from(notesTable).insert({
                [foreignKey]: id,
                user_id: user.id,
                author_name: profile?.full_name ?? "Unknown",
                content: checked.data.text,
            })
            if (error) { toast.error("Failed to save the note"); return false }
        } else {
            const { error } = await supabase.from(activitiesTable).insert({
                [foreignKey]: id,
                user_id: user.id,
                ...activityColumns(checked.data),
            })
            if (error) { toast.error(`Failed to save the ${kind.noun}`); return false }
        }
        toast.success(kind.done)
        router.refresh()
        return true
    }, [activitiesTable, foreignKey, id, notesTable, router])

    const editNote = useCallback(async (noteId: string, text: string): Promise<boolean> => {
        const content = text.trim()
        if (!content) { toast.error("A note can't be empty"); return false }
        const { data, error } = await createClient().from(notesTable).update({ content }).eq("id", noteId).select("id")
        if (error || !data?.length) { toast.error("Failed to update the note"); return false }
        toast.success("Note updated")
        router.refresh()
        return true
    }, [notesTable, router])

    const editActivity = useCallback(async (activityId: string, input: LoggedInput): Promise<boolean> => {
        const checked = composerSchema(new Date()).safeParse(input)
        if (!checked.success || checked.data.kind === "note") { toast.error(checked.error?.issues[0]?.message ?? "Check the form"); return false }
        const noun = composerKind(input.kind).noun
        const { data, error } = await createClient().from(activitiesTable).update(activityColumns(checked.data)).eq("id", activityId).select("id")
        if (error || !data?.length) { toast.error(`Failed to update the ${noun}`); return false }
        toast.success(`${noun[0].toUpperCase()}${noun.slice(1)} updated`)
        router.refresh()
        return true
    }, [activitiesTable, router])

    const deleteNote = useCallback(async (noteId: string): Promise<boolean> => {
        const { data, error } = await createClient().from(notesTable).delete().eq("id", noteId).select("id")
        if (error || !data?.length) { toast.error("Failed to delete the note"); return false }
        toast.success("Note deleted")
        router.refresh()
        return true
    }, [notesTable, router])

    const deleteActivity = useCallback(async (activityId: string, noun: string): Promise<boolean> => {
        const { data, error } = await createClient().from(activitiesTable).delete().eq("id", activityId).select("id")
        if (error || !data?.length) { toast.error(`Failed to delete the ${noun}`); return false }
        toast.success(`${noun[0].toUpperCase()}${noun.slice(1)} deleted`)
        router.refresh()
        return true
    }, [activitiesTable, router])

    /**
     * Ticks a follow-up done (now, by whoever ticks it: the database sets
     * `completed_by` itself) or reopens it. The toast after a tick offers
     * Undo.
     */
    const setFollowUpDone = useCallback(async (activityId: string, done: boolean): Promise<boolean> => {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        const { data, error } = await supabase
            .from(activitiesTable)
            .update({ completed_at: done ? new Date().toISOString() : null, completed_by: done ? user?.id ?? null : null })
            .eq("id", activityId)
            .select("id")
        if (error || !data?.length) {
            toast.error(done ? "Failed to mark the follow-up done" : "Failed to reopen the follow-up")
            return false
        }
        router.refresh()
        return true
    }, [activitiesTable, router])

    return { log, editNote, editActivity, deleteNote, deleteActivity, setFollowUpDone }
}

/**
 * The people a follow-up on this record can be assigned to, loaded the
 * first time the picker is needed and kept (`listRecordAssigneesAction`).
 */
export function useRecordAssignees(target: Pick<RecordActivityTarget, "kind" | "id">) {
    const [assignees, setAssignees] = useState<AssignableUser[] | null>(null)
    const loading = useRef(false)
    const { kind, id } = target
    const load = useCallback(async () => {
        if (loading.current) return
        loading.current = true
        const result = await listRecordAssigneesAction(kind, id)
        if (result.success) {
            setAssignees(result.data ?? [])
        } else {
            loading.current = false
            setAssignees([])
        }
    }, [kind, id])
    return { assignees, loadAssignees: load }
}
