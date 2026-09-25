"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createClient } from "@/utils/supabase/client"
import { COMPOSER_KINDS, type ComposerKind } from "@/lib/record-page"

/**
 * Where a record's notes and timeline live: a contact's in `contact_notes`
 * and `contact_activities` by `contact_id`, a company's in `company_notes`
 * and `company_activities` by `client_company_id`.
 */
export interface RecordActivityTarget {
    notesTable: "contact_notes" | "company_notes"
    activitiesTable: "contact_activities" | "company_activities"
    foreignKey: "contact_id" | "client_company_id"
    id: string
}

export const contactActivityTarget = (id: string): RecordActivityTarget => ({
    notesTable: "contact_notes", activitiesTable: "contact_activities", foreignKey: "contact_id", id,
})

export const companyActivityTarget = (id: string): RecordActivityTarget => ({
    notesTable: "company_notes", activitiesTable: "company_activities", foreignKey: "client_company_id", id,
})

/**
 * Writes a record's activity the way its pages always have: a note to the
 * notes table (the database copies it to the timeline), a call, an email,
 * a meeting or a task straight to the timeline with that `action_type`.
 * A note is its author's to edit or delete, which is what the database
 * allows. Every write refreshes the page, whose server render reads the
 * feed, the counts and "Last activity" again. Each returns whether it
 * worked; a failure is said in a toast.
 */
export function useRecordActivity(target: RecordActivityTarget) {
    const router = useRouter()
    const { notesTable, activitiesTable, foreignKey, id } = target

    const log = useCallback(async (kind: ComposerKind, text: string): Promise<boolean> => {
        const content = text.trim()
        if (!content) return false
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (kind === "note") {
            const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user?.id ?? "").single()
            const { error } = await supabase.from(notesTable).insert({
                [foreignKey]: id,
                user_id: user?.id ?? null,
                author_name: profile?.full_name ?? "Unknown",
                content,
            })
            if (error) { toast.error("Failed to save the note"); return false }
            toast.success("Note saved")
        } else {
            const actionType = COMPOSER_KINDS.find((entry) => entry.id === kind)?.actionType ?? "Note"
            const { error } = await supabase.from(activitiesTable).insert({
                [foreignKey]: id,
                user_id: user?.id ?? null,
                action_type: actionType,
                description: content,
            })
            if (error) { toast.error(`Failed to log the ${actionType.toLowerCase()}`); return false }
            toast.success(`${actionType} logged`)
        }
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

    const deleteNote = useCallback(async (noteId: string): Promise<boolean> => {
        const { data, error } = await createClient().from(notesTable).delete().eq("id", noteId).select("id")
        if (error || !data?.length) { toast.error("Failed to delete the note"); return false }
        toast.success("Note deleted")
        router.refresh()
        return true
    }, [notesTable, router])

    return { log, editNote, deleteNote }
}
