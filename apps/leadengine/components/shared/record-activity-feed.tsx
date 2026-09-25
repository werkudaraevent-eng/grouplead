"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useEdgeFade } from "@/hooks/use-edge-fade"
import { cn } from "@/lib/utils"
import { Check, Loader2, Paperclip, Pencil, Trash2 } from "@/components/icons"
import { feedFilterOptions, feedHeadline, filterFeed, formatDayTime, type FeedFilter, type FeedItem } from "@/lib/record-page"
import { ActivityIcon, ActivityWhen, RecordCard } from "./record-page"

/**
 * A record's Activity tab: every note, call, email, meeting, task, file
 * and change, newest first, as the Overview's Recent activity rows but
 * whole. Choice chips narrow it to one kind (only the kinds it holds are
 * offered; on a phone the row scrolls sideways and fades at its edges). A
 * note is its author's: only they see Edit and Delete on it, which is what
 * the database allows, and Delete asks first. The caller puts the
 * composer above it.
 */
export function RecordActivityFeed({ feed, currentUserId, onEditNote, onDeleteNote }: {
    feed: readonly FeedItem[]
    currentUserId: string | null
    onEditNote: (noteId: string, text: string) => Promise<boolean>
    onDeleteNote: (noteId: string) => Promise<boolean>
}) {
    const [filter, setFilter] = useState<FeedFilter>("all")
    const [editingKey, setEditingKey] = useState<string | null>(null)
    const [editText, setEditText] = useState("")
    const [savingEdit, setSavingEdit] = useState(false)
    const [pendingDelete, setPendingDelete] = useState<FeedItem | null>(null)
    const [deleting, setDeleting] = useState(false)
    const editRef = useRef<HTMLTextAreaElement>(null)
    const fade = useEdgeFade<HTMLDivElement>()

    const options = useMemo(() => feedFilterOptions(feed), [feed])
    const current = options.some((option) => option.id === filter) ? filter : "all"
    const shown = useMemo(() => filterFeed(feed, current), [feed, current])

    // The note being edited takes the focus where it already is on screen.
    useEffect(() => {
        if (editingKey) editRef.current?.focus({ preventScroll: true })
    }, [editingKey])

    const saveEdit = async (item: FeedItem) => {
        if (!item.note) return
        if (editText.trim() === item.note.content.trim()) { setEditingKey(null); return }
        setSavingEdit(true)
        const saved = await onEditNote(item.note.id, editText)
        setSavingEdit(false)
        if (saved) setEditingKey(null)
    }

    const confirmDelete = async () => {
        if (!pendingDelete?.note) return
        setDeleting(true)
        await onDeleteNote(pendingDelete.note.id)
        setDeleting(false)
        setPendingDelete(null)
    }

    return (
        <>
            {options.length > 1 && (
                <div ref={fade} role="radiogroup" aria-label="Show" className="edge-fade no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">
                    {options.map((option) => {
                        const active = option.id === current
                        return (
                            <button
                                key={option.id}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                onClick={() => setFilter(option.id)}
                                className={cn(
                                    "relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] border px-3 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
                                    "before:absolute before:inset-x-0 before:-inset-y-2 before:content-['']",
                                    active
                                        ? "border-transparent bg-[var(--tonal)] text-[var(--tonal-foreground)]"
                                        : "border-border bg-card text-foreground hover:bg-muted",
                                )}
                            >
                                {active && <Check className="h-4 w-4" aria-hidden="true" />}
                                {option.label}
                            </button>
                        )
                    })}
                </div>
            )}

            <RecordCard>
                {shown.length === 0 ? (
                    <p className="px-4 py-5 text-[13px] text-muted-foreground">No activity yet. Notes, calls, meetings and changes to this record show here as they happen.</p>
                ) : (
                    <ul className="divide-y divide-border">
                        {shown.map((item) => {
                            const own = !!item.note && !!currentUserId && item.note.userId === currentUserId
                            const editing = editingKey === item.key
                            return (
                                <li key={item.key} className="group/item flex gap-3 px-4 py-3">
                                    <ActivityIcon kind={item.kind} />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-start justify-between gap-3">
                                            <p className="min-w-0 text-sm font-semibold text-foreground">{feedHeadline(item)}</p>
                                            <span className="flex shrink-0 items-center gap-1" title={formatDayTime(item.at) ?? undefined} suppressHydrationWarning>
                                                {own && !editing && (
                                                    <span className="flex items-center gap-3 opacity-0 transition-opacity group-hover/item:opacity-100 group-focus-within/item:opacity-100 pointer-coarse:opacity-100">
                                                        <Button variant="ghost" size="icon-sm" aria-label="Edit note" className="relative -my-1.5 text-muted-foreground before:absolute before:-inset-2 before:content-[''] hover:bg-muted" onClick={() => { setEditingKey(item.key); setEditText(item.note?.content ?? "") }}>
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon-sm" aria-label="Delete note" className="relative -my-1.5 text-muted-foreground before:absolute before:-inset-2 before:content-[''] hover:bg-muted hover:text-destructive" onClick={() => setPendingDelete(item)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </span>
                                                )}
                                                <ActivityWhen at={item.at} />
                                            </span>
                                        </div>
                                        {editing ? (
                                            <div className="mt-2">
                                                <label htmlFor={`edit-${item.key}`} className="sr-only">Edit note</label>
                                                <Textarea
                                                    id={`edit-${item.key}`}
                                                    ref={editRef}
                                                    value={editText}
                                                    onChange={(event) => setEditText(event.target.value)}
                                                    onKeyDown={(event) => {
                                                        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); saveEdit(item) }
                                                        if (event.key === "Escape") setEditingKey(null)
                                                    }}
                                                    className="max-h-60 min-h-20 resize-none rounded-[8px] text-sm shadow-none md:text-sm"
                                                />
                                                <div className="mt-2 flex justify-end gap-2">
                                                    <Button variant="ghost" onClick={() => setEditingKey(null)} disabled={savingEdit} className="h-9 rounded-[8px] hover:bg-muted">Cancel</Button>
                                                    <Button onClick={() => saveEdit(item)} disabled={savingEdit || !editText.trim()} className="h-9 rounded-[8px] px-4 font-semibold">
                                                        {savingEdit && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                                                        Save
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            item.detail && <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-5 text-muted-foreground">{item.detail}</p>
                                        )}
                                        {item.attachment && (
                                            <p className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-[6px] bg-muted px-2 py-1 text-xs text-foreground">
                                                <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                                                <span className="truncate">{item.attachment}</span>
                                            </p>
                                        )}
                                    </div>
                                </li>
                            )
                        })}
                    </ul>
                )}
            </RecordCard>

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
                            onClick={(event) => { event.preventDefault(); confirmDelete() }}
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
