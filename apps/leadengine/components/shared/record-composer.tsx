"use client"

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { DatePickerField } from "@/components/shared/date-picker-field"
import { SearchableSelect } from "@/components/shared/searchable-select"
import { useEdgeFade } from "@/hooks/use-edge-fade"
import { cn } from "@/lib/utils"
import { Check, Loader2 } from "@/components/icons"
import type { AssignableUser } from "@/lib/assignable-users"
import {
    CALL_OUTCOMES, COMPOSER_KINDS, composerKind, emptyDraft, localDay, MEETING_MODES, notePlaceholder, parseDraft,
    visibleErrors, withCurrentTime, type ActivityViewer, type ComposerDraft, type ComposerInput, type ComposerKind,
    type DraftField,
} from "@/lib/record-activity"
import { FILLED_BUTTON, RECORD_TYPE } from "./record-page"

/**
 * The composer of a contact's and a company's Activity tab (DESIGN.md,
 * "Record pages"; HubSpot's, Pipedrive's and Salesforce's logging with
 * M3's rules): one card, the type pills (Note · Call · Meeting · Email ·
 * Follow-up) and under them the fields that kind asks for, as M3 filled
 * fields with sentence-case labels over them (a red * on what is
 * required), then "Ctrl + Enter to save" beside the filled button that
 * says what it will do (Save note, Log call, Log meeting, Log email, Add
 * follow-up), greyed until the required fields are valid. What each kind
 * needs and how it is saved is `lib/record-activity.ts`.
 */

/** What every composer on a record's page shares. */
export interface ComposerEnv {
    /** Named in the note's prompt: the contact's first name, the company's name. */
    subject: string
    viewer: ActivityViewer
    /** The viewer's own name, for a follow-up they tick before the page catches up. */
    viewerName: string | null
    /** Who a follow-up can be assigned to; null until loaded. */
    assignees: readonly AssignableUser[] | null
    loadAssignees: () => void
}

/** The time now, moving on every half minute, so a "when" nobody chose keeps saying now. */
function useNow(stepMs = 30_000): Date {
    const [now, setNow] = useState(() => new Date())
    useEffect(() => {
        const timer = window.setInterval(() => setNow(new Date()), stepMs)
        return () => window.clearInterval(timer)
    }, [stepMs])
    return now
}

// ═══════════════════════════════════════════════════════════════
//  CHOICE CHIPS
// ═══════════════════════════════════════════════════════════════

/**
 * M3 filter chips choosing one of a few (a call's outcome, a meeting's
 * where, History's kinds): 32dp, 8dp corners, outlined at rest, the chosen
 * one tonal with a leading check; a 48dp target around each. One radio
 * group: arrow keys, Home and End move and choose. `scroll` keeps them on
 * one row that scrolls sideways and fades at its edges below `lg` and wraps
 * from `lg`; otherwise they wrap.
 */
export function ChoiceChips<T extends string>({ options, value, onChange, label, labelledBy, scroll = false, className }: {
    options: readonly { id: T; label: string }[]
    value: T | null
    onChange: (next: T) => void
    /** The group's name when no visible label names it. */
    label?: string
    labelledBy?: string
    scroll?: boolean
    className?: string
}) {
    const buttons = useRef(new Map<T, HTMLButtonElement>())
    const fade = useEdgeFade<HTMLDivElement>()
    const focusIndex = Math.max(0, options.findIndex((option) => option.id === value))

    const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
        const index = options.findIndex((option) => option.id === value)
        const from = index < 0 ? 0 : index
        const next =
            event.key === "ArrowRight" || event.key === "ArrowDown" ? Math.min(options.length - 1, index < 0 ? 0 : from + 1)
            : event.key === "ArrowLeft" || event.key === "ArrowUp" ? Math.max(0, from - 1)
            : event.key === "Home" ? 0
            : event.key === "End" ? options.length - 1
            : null
        if (next === null) return
        event.preventDefault()
        const target = options[next].id
        onChange(target)
        buttons.current.get(target)?.focus({ preventScroll: true })
    }

    return (
        <div
            ref={scroll ? fade : undefined}
            role="radiogroup"
            aria-label={label}
            aria-labelledby={labelledBy}
            onKeyDown={onKey}
            className={cn(
                "flex gap-2",
                scroll ? "edge-fade no-scrollbar overflow-x-auto py-2 lg:flex-wrap" : "flex-wrap py-2",
                "-my-2",
                className,
            )}
        >
            {options.map((option, index) => {
                const active = option.id === value
                return (
                    <button
                        key={option.id}
                        ref={(el) => {
                            if (el) buttons.current.set(option.id, el)
                            else buttons.current.delete(option.id)
                        }}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        tabIndex={index === focusIndex ? 0 : -1}
                        onClick={() => onChange(option.id)}
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
    )
}

// ═══════════════════════════════════════════════════════════════
//  FIELDS
// ═══════════════════════════════════════════════════════════════

const LABEL = "inline-flex items-center gap-1.5 text-[13px] font-medium leading-none text-foreground/85"
const TEXTAREA = "max-h-60 min-h-[76px] resize-none rounded-[8px] px-3.5 py-3 text-sm shadow-none md:text-sm"
const FIELD_BUTTON = "h-9 border-input bg-field shadow-xs hover:bg-field"

/** A field's label (13px medium, sentence case, a red * when required), as `FormFieldLabel`, for a control or a group. */
function FieldLabel({ id, htmlFor, required, children }: { id?: string; htmlFor?: string; required?: boolean; children: ReactNode }) {
    const body = (
        <>
            <span>{children}</span>
            {required && <span className="text-destructive" aria-hidden="true">*</span>}
        </>
    )
    return htmlFor
        ? <label id={id} htmlFor={htmlFor} className={LABEL}>{body}</label>
        : <span id={id} className={LABEL}>{body}</span>
}

/** Why a field can't be saved as it is, in the danger ink, under it. */
function FieldError({ id, children }: { id: string; children?: string }) {
    if (!children) return null
    return <p id={id} className="text-xs font-medium text-[var(--danger-foreground)]">{children}</p>
}

type Patch = (next: Partial<ComposerDraft>) => void

function ComposerFields({ kind, draft, patch, touchWhen, errors, env, today }: {
    kind: ComposerKind
    draft: ComposerDraft
    patch: Patch
    touchWhen: Patch
    errors: Partial<Record<DraftField, string>>
    env: ComposerEnv
    today: string
}) {
    const uid = useId()
    const id = (name: string) => `${uid}-${name}`

    const when = (
        <div role="group" aria-labelledby={id("when-label")} className="grid gap-2">
            <FieldLabel id={id("when-label")} required>Date and time</FieldLabel>
            <div className="flex flex-wrap gap-2">
                <DatePickerField
                    id={id("date")}
                    aria-labelledby={`${id("when-label")} ${id("date")}`}
                    value={draft.date}
                    onChange={(date) => touchWhen({ date })}
                    maxDate={today}
                    clearable={false}
                    placeholder="Date"
                    className={cn(FIELD_BUTTON, "w-44")}
                />
                <Input
                    type="time"
                    aria-label="Time"
                    aria-invalid={!!errors.when}
                    aria-describedby={errors.when ? id("when-error") : undefined}
                    value={draft.time}
                    onChange={(event) => touchWhen({ time: event.target.value })}
                    className="h-9 w-36"
                />
            </div>
            <FieldError id={id("when-error")}>{errors.when}</FieldError>
        </div>
    )

    const notes = (label: string, placeholder: string) => (
        <div className="grid gap-2">
            <FieldLabel htmlFor={id("text")}>{label}</FieldLabel>
            <Textarea id={id("text")} value={draft.text} onChange={(event) => patch({ text: event.target.value })} placeholder={placeholder} className={TEXTAREA} />
            <FieldError id={id("text-error")}>{errors.text}</FieldError>
        </div>
    )

    switch (kind) {
        case "note":
            return (
                <div className="grid gap-2">
                    <label htmlFor={id("text")} className="sr-only">Note</label>
                    <Textarea
                        id={id("text")}
                        value={draft.text}
                        onChange={(event) => patch({ text: event.target.value })}
                        placeholder={notePlaceholder(env.subject)}
                        className={TEXTAREA}
                    />
                    <FieldError id={id("text-error")}>{errors.text}</FieldError>
                </div>
            )
        case "call":
            return (
                <>
                    <div className="grid gap-2">
                        <FieldLabel id={id("outcome")} required>Outcome</FieldLabel>
                        <ChoiceChips options={CALL_OUTCOMES} value={draft.outcome} onChange={(outcome) => patch({ outcome })} labelledBy={id("outcome")} />
                    </div>
                    {when}
                    {notes("Notes", "What was said, the next step…")}
                </>
            )
        case "meeting":
            return (
                <>
                    <div className="grid gap-2">
                        <FieldLabel id={id("mode")} required>Where</FieldLabel>
                        <ChoiceChips options={MEETING_MODES} value={draft.meetingMode} onChange={(meetingMode) => patch({ meetingMode })} labelledBy={id("mode")} />
                    </div>
                    {draft.meetingMode === "in_person" && (
                        <div className="grid gap-2">
                            <FieldLabel htmlFor={id("location")}>Location</FieldLabel>
                            <Input id={id("location")} value={draft.location} onChange={(event) => patch({ location: event.target.value })} placeholder="Their office, a venue, a café…" className="h-9" />
                            <FieldError id={id("location-error")}>{errors.location}</FieldError>
                        </div>
                    )}
                    {draft.meetingMode === "online" && (
                        <div className="grid gap-2">
                            <FieldLabel htmlFor={id("link")}>Meeting link</FieldLabel>
                            <Input
                                id={id("link")}
                                type="url"
                                inputMode="url"
                                value={draft.meetingUrl}
                                onChange={(event) => patch({ meetingUrl: event.target.value })}
                                placeholder="meet.google.com/…"
                                aria-invalid={!!errors.meetingUrl}
                                aria-describedby={errors.meetingUrl ? id("link-error") : undefined}
                                className="h-9"
                            />
                            <FieldError id={id("link-error")}>{errors.meetingUrl}</FieldError>
                        </div>
                    )}
                    {when}
                    {notes("Outcome or summary", "Who came, what was agreed…")}
                </>
            )
        case "email":
            return (
                <>
                    <div className="grid gap-2">
                        <FieldLabel htmlFor={id("subject")} required>Subject</FieldLabel>
                        <Input id={id("subject")} value={draft.subject} onChange={(event) => patch({ subject: event.target.value })} placeholder="The email's subject line" aria-required className="h-9" />
                        <FieldError id={id("subject-error")}>{errors.subject}</FieldError>
                    </div>
                    {when}
                    {notes("Summary", "What was sent or asked…")}
                </>
            )
        case "follow_up": {
            const options = (env.assignees ?? []).map((person) => ({ value: person.id, label: person.full_name }))
            return (
                <>
                    <div className="grid gap-2">
                        <FieldLabel htmlFor={id("title")} required>Title</FieldLabel>
                        <Input id={id("title")} value={draft.title} onChange={(event) => patch({ title: event.target.value })} placeholder="What needs doing" aria-required className="h-9" />
                        <FieldError id={id("title-error")}>{errors.title}</FieldError>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-4">
                        <div className="grid gap-2">
                            <FieldLabel id={id("due-label")} required>Due date</FieldLabel>
                            <DatePickerField
                                id={id("due")}
                                aria-labelledby={`${id("due-label")} ${id("due")}`}
                                value={draft.dueDate}
                                onChange={(dueDate) => patch({ dueDate })}
                                clearable={false}
                                placeholder="Choose a day"
                                className={cn(FIELD_BUTTON, "w-44")}
                            />
                        </div>
                        <div className="grid min-w-0 flex-1 basis-56 gap-2 sm:max-w-72">
                            <FieldLabel id={id("assignee-label")}>Assigned to</FieldLabel>
                            <SearchableSelect
                                id={id("assignee")}
                                aria-labelledby={`${id("assignee-label")} ${id("assignee")}`}
                                value={draft.assigneeId}
                                onChange={(assigneeId) => patch({ assigneeId })}
                                options={options}
                                loading={env.assignees === null}
                                placeholder="Nobody yet"
                                searchPlaceholder="Search people…"
                                emptyText="Nobody by that name"
                                className={FIELD_BUTTON}
                            />
                        </div>
                    </div>
                    {notes("Notes", "Anything that helps whoever does it…")}
                </>
            )
        }
    }
}

// ═══════════════════════════════════════════════════════════════
//  COMPOSER
// ═══════════════════════════════════════════════════════════════

/**
 * The composer. `card` on the Activity tab; `sheet` in the phone's bottom
 * sheet (the button row stays at the sheet's foot while the fields
 * scroll); `inline` edits a row of History or Upcoming in place, its kind
 * fixed, with Cancel beside Save changes. Ctrl + Enter (⌘ + Enter) saves
 * from any field. A "when" nobody chose follows the clock; the kind stays
 * after a save, the fields clear.
 */
export function ActivityComposer({ env, onSubmit, onDone, variant = "card", className, initial, submitLabel, onCancel }: {
    env: ComposerEnv
    onSubmit: (input: ComposerInput) => Promise<boolean>
    /** Called after a save that worked. */
    onDone?: () => void
    variant?: "card" | "sheet" | "inline"
    className?: string
    /** The row being edited, as its form. */
    initial?: { kind: ComposerKind; draft: ComposerDraft }
    submitLabel?: string
    onCancel?: () => void
}) {
    const now = useNow()
    const [kind, setKind] = useState<ComposerKind>(initial?.kind ?? "note")
    const [draft, setDraft] = useState<ComposerDraft>(() => initial?.draft ?? emptyDraft(new Date(), env.viewer.id))
    const [saving, setSaving] = useState(false)
    const rootRef = useRef<HTMLDivElement>(null)
    const inline = variant === "inline"
    const { loadAssignees } = env

    const shown = withCurrentTime(draft, now)
    const result = parseDraft(kind, shown, now)
    const errors = visibleErrors(result, shown)
    const choice = composerKind(kind)

    useEffect(() => {
        if (kind === "follow_up") loadAssignees()
    }, [kind, loadAssignees])

    // Editing in place: the first field takes the focus where it already
    // is on screen, the page not moving.
    useEffect(() => {
        if (!inline) return
        rootRef.current?.querySelector<HTMLElement>("input, textarea, [role=radio][tabindex='0'], button")?.focus({ preventScroll: true })
    }, [inline])

    const patch: Patch = (next) => setDraft((current) => ({ ...current, ...next }))
    // Choosing the day or the time fixes both, as they read at that moment.
    const touchWhen: Patch = (next) => setDraft((current) => ({ ...withCurrentTime(current, new Date()), ...next, whenTouched: true }))

    const save = async () => {
        if (saving) return
        const at = new Date()
        const fresh = parseDraft(kind, withCurrentTime(draft, at), at)
        if (!fresh.ok) return
        setSaving(true)
        const saved = await onSubmit(fresh.input)
        setSaving(false)
        if (!saved) return
        if (!inline) setDraft(emptyDraft(new Date(), env.viewer.id))
        onDone?.()
    }

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        // A picker's popover is portalled out of the composer, but its keys
        // still bubble here through React: they are the popover's own.
        if (!rootRef.current?.contains(event.target as Node)) return
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault()
            save()
        } else if (event.key === "Escape" && onCancel && !event.defaultPrevented) {
            onCancel()
        }
    }

    const pad = inline ? "" : variant === "sheet" ? "px-4" : "px-3"

    return (
        <div
            ref={rootRef}
            onKeyDown={onKeyDown}
            className={cn(variant === "card" && "rounded-[12px] border border-border bg-card", className)}
        >
            {!inline && (
                <>
                    <KindPills value={kind} onChange={setKind} className={pad} />
                    {kind === "meeting" && (
                        <p className={cn(pad, "-mt-1 pb-3 text-xs text-muted-foreground")}>
                            Planned visits are scheduled in Sales Activity; this logs a meeting that happened.
                        </p>
                    )}
                </>
            )}
            <div className={cn(pad, "flex flex-col gap-4 pb-3", inline && "pt-2")}>
                <ComposerFields kind={kind} draft={shown} patch={patch} touchWhen={touchWhen} errors={errors} env={env} today={localDay(now)} />
            </div>
            <div className={cn(pad, "flex items-center justify-between gap-3 pb-3", variant === "sheet" && "sticky bottom-0 z-10 border-t border-border bg-card pt-3")}>
                <span className="text-xs text-muted-foreground pointer-coarse:invisible">Ctrl + Enter to save</span>
                <div className="flex items-center gap-2">
                    {onCancel && (
                        <Button variant="ghost" onClick={onCancel} disabled={saving} className="h-9 rounded-[8px] px-3 font-semibold hover:bg-muted">
                            Cancel
                        </Button>
                    )}
                    <Button onClick={save} disabled={!result.ok || saving} className={FILLED_BUTTON}>
                        {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                        {submitLabel ?? choice.action}
                    </Button>
                </div>
            </div>
        </div>
    )
}

/**
 * What to log: tonal choices (13px semibold, 8dp corners, the chosen on
 * `--tonal`), one row that scrolls sideways and fades at its edges when
 * narrow; one radio group, arrow keys moving between them.
 */
function KindPills({ value, onChange, className }: { value: ComposerKind; onChange: (next: ComposerKind) => void; className?: string }) {
    const fade = useEdgeFade<HTMLDivElement>()
    const buttons = useRef(new Map<ComposerKind, HTMLButtonElement>())

    const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
        const index = COMPOSER_KINDS.findIndex((entry) => entry.id === value)
        const next =
            event.key === "ArrowRight" ? Math.min(COMPOSER_KINDS.length - 1, index + 1)
            : event.key === "ArrowLeft" ? Math.max(0, index - 1)
            : event.key === "Home" ? 0
            : event.key === "End" ? COMPOSER_KINDS.length - 1
            : null
        if (next === null) return
        event.preventDefault()
        const target = COMPOSER_KINDS[next].id
        onChange(target)
        buttons.current.get(target)?.focus({ preventScroll: true })
    }

    return (
        <div ref={fade} role="radiogroup" aria-label="What to log" onKeyDown={onKey} className={cn("edge-fade no-scrollbar flex gap-1 overflow-x-auto pb-2.5 pt-2.5", className)}>
            {COMPOSER_KINDS.map((entry) => {
                const active = entry.id === value
                return (
                    <button
                        key={entry.id}
                        ref={(el) => {
                            if (el) buttons.current.set(entry.id, el)
                            else buttons.current.delete(entry.id)
                        }}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        tabIndex={active ? 0 : -1}
                        onClick={() => onChange(entry.id)}
                        className={cn(
                            "relative shrink-0 rounded-[8px] px-3 py-1.5 text-[13px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 pointer-coarse:before:absolute pointer-coarse:before:-inset-y-2.5 pointer-coarse:before:inset-x-0 pointer-coarse:before:content-['']",
                            active ? "bg-[var(--tonal)] text-[var(--tonal-foreground)]" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                    >
                        {entry.label}
                    </button>
                )
            })}
        </div>
    )
}

/** The composer in a bottom sheet, for the phone's "Add a note…" and Note: the same kinds and fields. */
export function ComposerSheet({ open, onOpenChange, env, onSubmit }: {
    open: boolean
    onOpenChange: (open: boolean) => void
    env: ComposerEnv
    onSubmit: (input: ComposerInput) => Promise<boolean>
}) {
    return (
        <BottomSheet open={open} onOpenChange={onOpenChange} title="Log activity">
            <ActivityComposer variant="sheet" env={env} onSubmit={onSubmit} onDone={() => onOpenChange(false)} className={RECORD_TYPE} />
        </BottomSheet>
    )
}
