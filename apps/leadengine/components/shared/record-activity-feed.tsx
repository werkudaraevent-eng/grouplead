"use client"

import { useMemo, useRef, useState, type ReactNode } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { InitialsAvatar } from "@/components/shared/initials-avatar"
import { cn } from "@/lib/utils"
import { ExternalLink, Loader2, MoreVertical, Paperclip, Pencil, Trash2 } from "@/components/icons"
import {
    buildFeed, buildUpcoming, dueLabel, feedByline, feedFilterOptions, filterFeed, formatDayTime, shortPersonName, websiteLabel,
    type FeedFilter, type FeedItem, type NoteRow, type PeopleById, type UpcomingItem,
} from "@/lib/record-page"
import {
    activityKind, canCompleteFollowUp, canManageActivity, canManageNote, composerKind, draftFromActivity, emptyDraft,
    type ActivityRow, type ComposerDraft, type ComposerInput, type ComposerKind, type LoggedInput,
} from "@/lib/record-activity"
import { ActivityComposer, ChoiceChips, type ComposerEnv } from "./record-composer"
import { ActivityIcon, ActivityWhen, RecordCard } from "./record-page"

/** What the feed asks of `useRecordActivity`. */
export interface RecordActivityActions {
    editNote: (noteId: string, text: string) => Promise<boolean>
    editActivity: (activityId: string, input: LoggedInput) => Promise<boolean>
    deleteNote: (noteId: string) => Promise<boolean>
    deleteActivity: (activityId: string, noun: string) => Promise<boolean>
    setFollowUpDone: (activityId: string, done: boolean) => Promise<boolean>
}

interface Editing {
    key: string
    initial: { kind: ComposerKind; draft: ComposerDraft }
    save: (input: ComposerInput) => Promise<boolean>
}

interface PendingDelete {
    noun: string
    run: () => Promise<boolean>
}

const NO_OVERRIDES: Readonly<Record<string, string | null>> = {}

/**
 * A record's Upcoming and History, under the composer on its Activity tab
 * (DESIGN.md, "Record pages"; HubSpot's upcoming and history, Pipedrive's
 * planned and done). **Upcoming**: the open follow-ups, the one due first
 * on top, each with a checkbox that marks it done, its title, when it is
 * due ("Overdue · 20 Sep" in the danger ink) and who it is for; hidden
 * when there are none. **History**: everything that happened, newest
 * first by when it happened, filtered by choice chips (only the kinds it
 * holds are offered); a done follow-up sits here at the time it was done,
 * its checkbox ticked, and unticking reopens it. A row a person logged has
 * a ⋮ with Edit (the composer's own fields, in place) and Delete (asks
 * first) for its author or an admin, what row security allows; the rows the
 * database and the app wrote for themselves have none. A tick shows at
 * once and holds until the page's data catches up; its toast offers Undo.
 */
export function RecordActivityFeed({ activities, notes, people, env, actions }: {
    activities: readonly ActivityRow[]
    notes: readonly NoteRow[]
    people: PeopleById
    env: ComposerEnv
    actions: RecordActivityActions
}) {
    const { viewer } = env
    const [filter, setFilter] = useState<FeedFilter>("all")
    const [editing, setEditing] = useState<Editing | null>(null)
    const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
    const [deleting, setDeleting] = useState(false)
    // A follow-up ticked (or reopened) shows so at once, until the page's
    // own data, refreshed after the write, arrives in its place.
    const [override, setOverride] = useState<{ source: readonly ActivityRow[]; done: Readonly<Record<string, string | null>> }>({ source: activities, done: NO_OVERRIDES })
    const doneNow = override.source === activities ? override.done : NO_OVERRIDES

    const everyone = useMemo<PeopleById>(
        () => (viewer.id && env.viewerName ? { ...people, [viewer.id]: { full_name: env.viewerName } } : people),
        [people, viewer.id, env.viewerName],
    )
    const rows = useMemo(
        () => activities.map((row) => (row.id in doneNow ? { ...row, completed_at: doneNow[row.id], completed_by: doneNow[row.id] ? viewer.id : null } : row)),
        [activities, doneNow, viewer.id],
    )
    const upcoming = useMemo(() => buildUpcoming(rows, everyone), [rows, everyone])
    const feed = useMemo(() => buildFeed(rows, notes, everyone), [rows, notes, everyone])
    const options = useMemo(() => feedFilterOptions(feed), [feed])
    const current = options.some((option) => option.id === filter) ? filter : "all"
    const shown = useMemo(() => filterFeed(feed, current), [feed, current])

    const markDone = (id: string, value: string | null | undefined) => {
        setOverride((prev) => {
            const next = { ...(prev.source === activities ? prev.done : NO_OVERRIDES) }
            if (value === undefined) delete next[id]
            else next[id] = value
            return { source: activities, done: next }
        })
    }

    const toggle = async (row: ActivityRow, done: boolean) => {
        markDone(row.id, done ? new Date().toISOString() : null)
        const saved = await actions.setFollowUpDone(row.id, done)
        if (!saved) { markDone(row.id, undefined); return }
        if (done) toast.success("Follow-up done", { action: { label: "Undo", onClick: () => { void toggle(row, false) } } })
        else toast.success("Follow-up reopened")
    }

    const startEdit = (key: string, initial: Editing["initial"] | null, save: Editing["save"]) => {
        if (initial) setEditing({ key, initial, save })
    }

    const editNote = (item: FeedItem) => {
        const note = item.note
        if (!note) return
        startEdit(item.key, { kind: "note", draft: { ...emptyDraft(new Date(), viewer.id), text: note.content } }, (input) =>
            input.kind === "note" ? actions.editNote(note.id, input.text) : Promise.resolve(false),
        )
    }

    const editRow = (key: string, row: ActivityRow) => {
        startEdit(key, draftFromActivity(row, viewer.id), (input) =>
            input.kind === "note" ? Promise.resolve(false) : actions.editActivity(row.id, input),
        )
    }

    const nounOf = (row: ActivityRow) => {
        const kind = activityKind(row.action_type)
        if (kind === "follow_up" && !row.due_at) return "task"
        return kind === "call" || kind === "meeting" || kind === "email" || kind === "follow_up" ? composerKind(kind).noun : "activity"
    }

    const confirmDelete = async () => {
        if (!pendingDelete) return
        setDeleting(true)
        await pendingDelete.run()
        setDeleting(false)
        setPendingDelete(null)
    }

    const editor = (entry: Editing) => (
        <ActivityComposer
            variant="inline"
            env={env}
            initial={entry.initial}
            submitLabel="Save changes"
            onSubmit={entry.save}
            onDone={() => setEditing(null)}
            onCancel={() => setEditing(null)}
            className="mt-1"
        />
    )

    const menu = (label: string, onEdit: (() => void) | null, onDelete: () => void) => (
        <RowMenu label={label} onEdit={onEdit} onDelete={onDelete} />
    )

    return (
        <>
            {upcoming.length > 0 && (
                <RecordCard title="Upcoming" headingId="record-upcoming-heading">
                    <ul className="divide-y divide-border lg:pt-1">
                        {upcoming.map((item) => (
                            <UpcomingRow
                                key={item.key}
                                item={item}
                                canToggle={canCompleteFollowUp(item.row, viewer)}
                                onToggle={() => toggle(item.row, true)}
                                menu={canManageActivity(item.row, viewer) ? menu(
                                    `Actions for “${item.title}”`,
                                    () => editRow(item.key, item.row),
                                    () => setPendingDelete({ noun: "follow-up", run: () => actions.deleteActivity(item.row.id, "follow-up") }),
                                ) : null}
                                editor={editing?.key === item.key ? editor(editing) : null}
                            />
                        ))}
                    </ul>
                </RecordCard>
            )}

            <RecordCard title="History" headingId="record-history-heading">
                {options.length > 1 && (
                    <div className="pb-3 pt-1 lg:pt-3">
                        <ChoiceChips options={options} value={current} onChange={setFilter} label="Show" scroll className="px-4" />
                    </div>
                )}
                {shown.length === 0 ? (
                    <p className="px-4 pb-5 pt-1 text-[13px] text-muted-foreground lg:pt-3.5">
                        No activity yet. Notes, calls, meetings, emails and changes to this record show here as they happen.
                    </p>
                ) : (
                    <ul className={cn("divide-y divide-border", options.length > 1 && "border-t border-border")}>
                        {shown.map((item) => {
                            const row = item.row
                            const canEditRow = !!row && canManageActivity(row, viewer)
                            const noteOwn = !!item.note && canManageNote(item.note, viewer)
                            const oldTask = !!row && activityKind(row.action_type) === "follow_up" && !row.due_at
                            const itemMenu = noteOwn
                                ? menu(`Actions for this note`, () => editNote(item), () => setPendingDelete({ noun: "note", run: () => actions.deleteNote(item.note!.id) }))
                                : canEditRow && row
                                    ? menu(
                                        `Actions for “${item.title}”`,
                                        oldTask ? null : () => editRow(item.key, row),
                                        () => setPendingDelete({ noun: nounOf(row), run: () => actions.deleteActivity(row.id, nounOf(row)) }),
                                    )
                                    : null
                            const done = !!row && activityKind(row.action_type) === "follow_up" && !!row.due_at && !!row.completed_at
                            return (
                                <HistoryRow
                                    key={item.key}
                                    item={item}
                                    leading={done && row && canCompleteFollowUp(row, viewer)
                                        ? <FollowUpCheck checked label={`Reopen “${row.subject?.trim() || "follow-up"}”`} onChange={() => toggle(row, false)} />
                                        : <ActivityIcon kind={item.kind} />}
                                    menu={editing?.key === item.key ? null : itemMenu}
                                    editor={editing?.key === item.key ? editor(editing) : null}
                                />
                            )
                        })}
                    </ul>
                )}
            </RecordCard>

            <AlertDialog open={!!pendingDelete} onOpenChange={(open) => { if (!open && !deleting) setPendingDelete(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this {pendingDelete?.noun ?? "activity"}?</AlertDialogTitle>
                        <AlertDialogDescription>It is removed for everyone and can&apos;t be brought back.</AlertDialogDescription>
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

/**
 * A row's ⋮: Edit (when the row can be edited) and Delete, on hover or
 * focus with a pointer and always to a finger, a 48dp target. Edit puts
 * the focus in the editor's first field, so the menu does not hand it back
 * to its button when it closes.
 */
function RowMenu({ label, onEdit, onDelete }: { label: string; onEdit: (() => void) | null; onDelete: () => void }) {
    const editing = useRef(false)
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={label}
                    className="relative -my-1.5 size-8 rounded-full text-muted-foreground opacity-0 transition-opacity before:absolute before:-inset-2 before:content-[''] hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover/item:opacity-100 group-focus-within/item:opacity-100 data-[state=open]:opacity-100 pointer-coarse:opacity-100"
                >
                    <MoreVertical className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                className="w-40"
                onCloseAutoFocus={(event) => {
                    if (editing.current) { event.preventDefault(); editing.current = false }
                }}
            >
                {onEdit && (
                    <DropdownMenuItem onSelect={() => { editing.current = true; onEdit() }}>
                        <Pencil className="h-4 w-4" /> Edit
                    </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
                    <Trash2 className="h-4 w-4" /> Delete
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

/**
 * M3's checkbox for a follow-up: 18dp, a 2dp outline in the on-surface
 * variant, the primary when ticked, a 48dp target; in the row's leading
 * slot, where History puts its icon. Greyed (M3's 38%) for whoever may not
 * tick it.
 */
function FollowUpCheck({ checked, disabled = false, label, onChange }: { checked: boolean; disabled?: boolean; label: string; onChange: () => void }) {
    return (
        <span className="grid size-5 shrink-0 place-items-center lg:size-8">
            <Checkbox
                checked={checked}
                disabled={disabled}
                aria-label={label}
                onCheckedChange={onChange}
                className="relative size-[18px] rounded-[3px] border-2 border-muted-foreground shadow-none before:absolute before:-inset-3.5 before:content-[''] data-[state=checked]:border-primary disabled:border-foreground/38 disabled:opacity-100"
            />
        </span>
    )
}

function UpcomingRow({ item, canToggle, onToggle, menu, editor }: {
    item: UpcomingItem
    canToggle: boolean
    onToggle: () => void
    menu: ReactNode
    editor: ReactNode
}) {
    const due = dueLabel(item.dueAt)
    return (
        <li className="group/item flex gap-3 px-4 py-3">
            <FollowUpCheck checked={false} disabled={!canToggle} label={`Mark “${item.title}” done`} onChange={onToggle} />
            <div className="min-w-0 flex-1 lg:pt-1.5">
                {editor ?? (
                    <>
                        <div className="flex items-start justify-between gap-3">
                            <p className="min-w-0 break-words text-sm font-semibold text-foreground">{item.title}</p>
                            {menu}
                        </div>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" title={formatDayTime(item.dueAt) ?? undefined}>
                            <span suppressHydrationWarning className={due.overdue ? "font-semibold text-[var(--danger-foreground)]" : "text-muted-foreground"}>{due.text}</span>
                            {item.assignee && (
                                <>
                                    <span aria-hidden="true" className="text-muted-foreground">·</span>
                                    <span className="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground">
                                        <InitialsAvatar name={item.assignee.name} src={item.assignee.avatarUrl} size="xs" />
                                        <span className="sr-only">Assigned to </span>
                                        <span className="truncate lg:hidden">{shortPersonName(item.assignee.name)}</span>
                                        <span className="truncate max-lg:hidden">{item.assignee.name}</span>
                                    </span>
                                </>
                            )}
                        </p>
                        {item.detail && <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-[13px] text-muted-foreground">{item.detail}</p>}
                    </>
                )}
            </div>
        </li>
    )
}

function HistoryRow({ item, leading, menu, editor }: { item: FeedItem; leading: ReactNode; menu: ReactNode; editor: ReactNode }) {
    const full = feedByline(item)
    const short = feedByline(item, true)
    return (
        <li className="group/item flex gap-3 px-4 py-3">
            {leading}
            <div className="min-w-0 flex-1 lg:pt-1.5">
                <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 break-words text-sm text-foreground">
                        <span className="font-semibold">{item.title}</span>
                        {full && (
                            <span className="text-muted-foreground">
                                {" · "}
                                <span className="lg:hidden">{short}</span>
                                <span className="max-lg:hidden">{full}</span>
                            </span>
                        )}
                    </p>
                    <span className="flex shrink-0 items-center gap-1" title={formatDayTime(item.at) ?? undefined} suppressHydrationWarning>
                        <ActivityWhen at={item.at} />
                        {/* Every row keeps the ⋮'s place, so the times line up. */}
                        {menu ?? <span aria-hidden="true" className="-my-1.5 size-8 shrink-0" />}
                    </span>
                </div>
                {editor ?? (
                    <>
                        {item.detail && <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-5 text-muted-foreground">{item.detail}</p>}
                        {item.link && (
                            <a
                                href={item.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="relative mt-1 inline-flex max-w-full items-center gap-1 rounded-sm text-[13px] font-semibold text-primary outline-none before:absolute before:-inset-y-3 before:inset-x-0 before:content-[''] hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                            >
                                <span className="truncate">{websiteLabel(item.link)}</span>
                                <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            </a>
                        )}
                        {item.attachment && (
                            <p className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-[6px] bg-muted px-2 py-1 text-xs text-foreground">
                                <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                                <span className="truncate">{item.attachment}</span>
                            </p>
                        )}
                    </>
                )}
            </div>
        </li>
    )
}
