"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { InitialsAvatar } from "@/components/shared/initials-avatar"
import { Loader2, Pencil, Trash2 } from "@/components/icons"
import { formatRelativeTime } from "@/lib/relative-time"

interface ContactNote {
    id: string
    content: string
    author_name: string | null
    created_at: string
    user_id: string | null
}

function fullDateTime(iso: string): string {
    return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

/**
 * The contact's notes: the composer first (Ctrl+Enter or Save note), then
 * the notes, newest first, each with its author and when. A note is its
 * author's: only they see Edit and Delete on it, which is what the
 * database allows (`contact_notes` updates and deletes are the author's
 * own); a Delete asks first, since a note cannot be brought back.
 */
export function ContactNotesSection({ contactId, currentUserId, headingId, onCountChange }: {
    contactId: string
    currentUserId: string | null
    headingId: string
    onCountChange: (count: number) => void
}) {
    const [notes, setNotes] = useState<ContactNote[]>([])
    const [loading, setLoading] = useState(true)
    const [draft, setDraft] = useState("")
    const [saving, setSaving] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editText, setEditText] = useState("")
    const [savingEdit, setSavingEdit] = useState(false)
    const [pendingDelete, setPendingDelete] = useState<ContactNote | null>(null)
    const [deleting, setDeleting] = useState(false)
    const editRef = useRef<HTMLTextAreaElement>(null)

    // The note being edited takes the focus where it already is on screen.
    useEffect(() => {
        if (editingId) editRef.current?.focus({ preventScroll: true })
    }, [editingId])

    const fetchNotes = useCallback(async () => {
        const supabase = createClient()
        const { data } = await supabase
            .from("contact_notes")
            .select("*")
            .eq("contact_id", contactId)
            .order("created_at", { ascending: false })
        const rows = (data ?? []) as ContactNote[]
        setNotes(rows)
        onCountChange(rows.length)
        setLoading(false)
    }, [contactId, onCountChange])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchNotes()
    }, [fetchNotes])

    const saveNote = async () => {
        const content = draft.trim()
        if (!content || saving) return
        setSaving(true)
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user?.id ?? "").single()
        const { error } = await supabase.from("contact_notes").insert({
            contact_id: contactId,
            user_id: user?.id ?? null,
            author_name: profile?.full_name ?? "Unknown",
            content,
        })
        setSaving(false)
        if (error) { toast.error("Failed to save note"); return }
        setDraft("")
        toast.success("Note saved")
        fetchNotes()
    }

    const saveEdit = async (note: ContactNote) => {
        const content = editText.trim()
        if (!content) { toast.error("A note can't be empty"); return }
        if (content === note.content) { setEditingId(null); return }
        setSavingEdit(true)
        const { data, error } = await createClient().from("contact_notes").update({ content }).eq("id", note.id).select("id")
        setSavingEdit(false)
        if (error || !data?.length) { toast.error("Failed to update note"); return }
        setEditingId(null)
        toast.success("Note updated")
        fetchNotes()
    }

    const deleteNote = async (note: ContactNote) => {
        setDeleting(true)
        const { data, error } = await createClient().from("contact_notes").delete().eq("id", note.id).select("id")
        setDeleting(false)
        setPendingDelete(null)
        if (error || !data?.length) { toast.error("Failed to delete note"); return }
        toast.success("Note deleted")
        fetchNotes()
    }

    return (
        <>
            <h2 id={headingId} className="mb-3 text-base font-semibold text-foreground">Notes</h2>
            <div className="overflow-hidden rounded-xl border bg-card">
                <div className="border-b p-4">
                    <label htmlFor={`${headingId}-draft`} className="sr-only">Add a note</label>
                    <Textarea
                        id={`${headingId}-draft`}
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                                event.preventDefault()
                                saveNote()
                            }
                        }}
                        placeholder="Add a note…"
                        className="min-h-20 resize-none text-sm"
                    />
                    <div className="mt-2 flex items-center justify-between gap-3">
                        <span className="text-xs text-muted-foreground pointer-coarse:invisible">Ctrl+Enter to save</span>
                        <Button size="sm" disabled={!draft.trim() || saving} onClick={saveNote} className="h-9 max-md:h-10">
                            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            Save note
                        </Button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading notes…
                    </div>
                ) : notes.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-muted-foreground sm:px-5">No notes yet. A note you add shows here, newest first.</p>
                ) : (
                    <ul className="divide-y">
                        {notes.map((note) => {
                            const own = !!currentUserId && note.user_id === currentUserId
                            const editing = editingId === note.id
                            const author = note.author_name ?? "Unknown"
                            return (
                                <li key={note.id} className="group/note px-4 py-3 sm:px-5">
                                    <div className="flex items-center gap-2">
                                        <InitialsAvatar name={author} size="xs" />
                                        <span className="truncate text-sm font-medium text-foreground">{author}</span>
                                        <span className="shrink-0 text-xs text-muted-foreground" title={fullDateTime(note.created_at)} suppressHydrationWarning>
                                            {formatRelativeTime(note.created_at) ?? fullDateTime(note.created_at)}
                                        </span>
                                        {own && !editing && (
                                            <span className="ml-auto flex shrink-0 items-center opacity-0 transition-opacity group-hover/note:opacity-100 group-focus-within/note:opacity-100 pointer-coarse:opacity-100">
                                                <Button variant="ghost" size="icon-sm" className="text-muted-foreground pointer-coarse:size-10" aria-label="Edit note" onClick={() => { setEditingId(note.id); setEditText(note.content) }}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive pointer-coarse:size-10" aria-label="Delete note" onClick={() => setPendingDelete(note)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </span>
                                        )}
                                    </div>
                                    {editing ? (
                                        <div className="mt-2 pl-7">
                                            <label htmlFor={`note-edit-${note.id}`} className="sr-only">Edit note</label>
                                            <Textarea
                                                id={`note-edit-${note.id}`}
                                                ref={editRef}
                                                value={editText}
                                                onChange={(event) => setEditText(event.target.value)}
                                                onKeyDown={(event) => {
                                                    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); saveEdit(note) }
                                                    if (event.key === "Escape") setEditingId(null)
                                                }}
                                                className="min-h-20 resize-none text-sm"
                                            />
                                            <div className="mt-2 flex justify-end gap-2">
                                                <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} disabled={savingEdit}>Cancel</Button>
                                                <Button size="sm" onClick={() => saveEdit(note)} disabled={savingEdit || !editText.trim()}>
                                                    {savingEdit && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                                    Save
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="mt-1 whitespace-pre-wrap break-words pl-7 text-sm leading-relaxed text-foreground">{note.content}</p>
                                    )}
                                </li>
                            )
                        })}
                    </ul>
                )}
            </div>

            <AlertDialog open={!!pendingDelete} onOpenChange={(open) => { if (!open && !deleting) setPendingDelete(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this note?</AlertDialogTitle>
                        <AlertDialogDescription>The note is removed for everyone and can&apos;t be brought back.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={deleting}
                            onClick={(event) => { event.preventDefault(); if (pendingDelete) deleteNote(pendingDelete) }}
                            className="bg-destructive text-white hover:bg-destructive/90"
                        >
                            {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
