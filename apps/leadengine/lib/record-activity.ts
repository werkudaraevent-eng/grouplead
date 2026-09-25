import { z } from "zod"

/**
 * What a person logs on a contact's or a company's page, and how it is
 * stored (DESIGN.md, "Record pages"): the composer's five kinds, the fields
 * each asks for, the zod schema each is checked against before it is saved,
 * the columns it is saved into (`contact_activities` / `company_activities`,
 * migration `20260925120000_record_activity_fields.sql`; a note goes to the
 * notes table), and the way back from a saved row to the form that edits
 * it. The database is lenient (every column nullable, free text); the rules
 * live here.
 */

// ─── Rows ────────────────────────────────────────────────────────────

/** A row of a record's timeline, with the typed columns a person's log carries. */
export interface ActivityRow {
    id: string
    action_type: string
    description: string | null
    created_at: string
    user_id?: string | null
    /** Set on rows the app writes for itself (Sales Activity's visit: `sales_mission:<id>`) and on field changes. */
    field_name?: string | null
    attachment_name?: string | null
    occurred_at?: string | null
    outcome?: string | null
    meeting_mode?: string | null
    location?: string | null
    meeting_url?: string | null
    subject?: string | null
    due_at?: string | null
    assignee_id?: string | null
    completed_at?: string | null
    completed_by?: string | null
    updated_at?: string | null
    profile?: { full_name: string | null; avatar_url?: string | null } | null
}

export type ActivityKind =
    | "note" | "call" | "email" | "meeting" | "follow_up" | "file" | "stage" | "create" | "update" | "delete" | "other"

/**
 * What a timeline row is, from its free-text `action_type`, in any case:
 * the kinds a person logs ('call', 'meeting', 'email', 'follow_up' now;
 * 'Call', 'Meeting', 'Email', 'Task', 'Note' from the older dialog and
 * composer, where a task is a follow-up without a due date; a Sales
 * Activity visit is 'meeting'), the rows the app writes ('File Uploaded',
 * 'File Deleted', a stage moved) and the rows the database writes ('note'
 * for a note's copy, 'update' for a field changed, 'delete').
 */
export function activityKind(actionType: string | null | undefined): ActivityKind {
    const type = (actionType ?? "").trim().toLowerCase()
    if (type.startsWith("file")) return "file"
    if (type.includes("stage")) return "stage"
    if (type.includes("note")) return "note"
    if (type.includes("call")) return "call"
    if (type.includes("email")) return "email"
    if (type.includes("meeting") || type.includes("visit")) return "meeting"
    if (type.includes("follow") || type.includes("task")) return "follow_up"
    if (type.includes("create")) return "create"
    if (type.includes("update")) return "update"
    if (type.includes("delete")) return "delete"
    return "other"
}

const LOGGED_TYPES = ["call", "email", "meeting", "task", "follow_up"]

/**
 * Whether a row is one a person logged, which its author or an admin may
 * change or delete; the same test as `fn_record_activity_is_logged` in the
 * database. Never a row the database or the app wrote for itself: a field
 * changed, a note's copy, a file, a Sales Activity visit (which carries its
 * mission in `field_name`).
 */
export function isLoggedActivity(row: Pick<ActivityRow, "action_type" | "field_name">): boolean {
    return !row.field_name && LOGGED_TYPES.includes((row.action_type ?? "").trim().toLowerCase())
}

/** An open follow-up: one with a due day, not yet done. A task from the old dialog has no due day. */
export function isOpenFollowUp(row: Pick<ActivityRow, "action_type" | "due_at" | "completed_at">): boolean {
    return activityKind(row.action_type) === "follow_up" && !!row.due_at && !row.completed_at
}

/** A follow-up (open or done); an old task without a due day is not one. */
export function isFollowUp(row: Pick<ActivityRow, "action_type" | "due_at">): boolean {
    return activityKind(row.action_type) === "follow_up" && !!row.due_at
}

/**
 * The people a record's timeline names beyond its authors (whose names
 * come with each row): who a follow-up is for and who ticked it done, each
 * once, for the page to read by name.
 */
export function activityPeopleIds(rows: readonly Pick<ActivityRow, "assignee_id" | "completed_by">[]): string[] {
    const ids = new Set<string>()
    for (const row of rows) {
        if (row.assignee_id) ids.add(row.assignee_id)
        if (row.completed_by) ids.add(row.completed_by)
    }
    return [...ids]
}

/** Whether a role is an admin: the same test as `public.fn_user_is_admin()` (admin or super admin, any case or spacing). */
export function isAdminRole(role: string | null | undefined): boolean {
    const normalized = (role ?? "").trim().replace(/\s+/g, "_").toLowerCase()
    return normalized === "super_admin" || normalized === "admin"
}

/** Who is looking at the page: their id, and whether they are an admin. */
export interface ActivityViewer {
    id: string | null
    isAdmin: boolean
}

/** The viewer as a record's page receives it from the server: with their name. */
export interface RecordViewer extends ActivityViewer {
    name: string | null
}

/** Edit and Delete on a logged row: its author or an admin (the database's update and delete policies). */
export function canManageActivity(row: Pick<ActivityRow, "action_type" | "field_name" | "user_id">, viewer: ActivityViewer): boolean {
    if (!viewer.id || !isLoggedActivity(row)) return false
    return viewer.isAdmin || row.user_id === viewer.id
}

/** Ticking a follow-up done or reopening it: its author, the person it is assigned to, or an admin. */
export function canCompleteFollowUp(row: Pick<ActivityRow, "action_type" | "field_name" | "user_id" | "assignee_id" | "due_at">, viewer: ActivityViewer): boolean {
    if (!viewer.id || !isFollowUp(row) || !isLoggedActivity(row)) return false
    return viewer.isAdmin || row.user_id === viewer.id || row.assignee_id === viewer.id
}

/** A note from the notes table: its author or an admin. */
export function canManageNote(note: { userId: string | null }, viewer: ActivityViewer): boolean {
    if (!viewer.id) return false
    return viewer.isAdmin || note.userId === viewer.id
}

// ─── The composer's kinds ───────────────────────────────────────────

export type ComposerKind = "note" | "call" | "meeting" | "email" | "follow_up"

/**
 * The type pills in order, the button each makes, the toast after a save,
 * and the word for Delete's question. A pill for something that already
 * happened says so ("Log call"), so it never reads as the header's Call
 * (which dials) or Send email (which writes one).
 */
export const COMPOSER_KINDS: readonly { id: ComposerKind; label: string; action: string; done: string; noun: string }[] = [
    { id: "note", label: "Note", action: "Save note", done: "Note saved", noun: "note" },
    { id: "call", label: "Log call", action: "Log call", done: "Call logged", noun: "call" },
    { id: "meeting", label: "Log meeting", action: "Log meeting", done: "Meeting logged", noun: "meeting" },
    { id: "email", label: "Log email", action: "Log email", done: "Email logged", noun: "email" },
    { id: "follow_up", label: "Follow-up", action: "Add follow-up", done: "Follow-up added", noun: "follow-up" },
]

export function composerKind(id: ComposerKind) {
    return COMPOSER_KINDS.find((entry) => entry.id === id) ?? COMPOSER_KINDS[0]
}

/** The `action_type` each kind is written with. */
export const ACTION_TYPE: Record<Exclude<ComposerKind, "note">, string> = {
    call: "call",
    meeting: "meeting",
    email: "email",
    follow_up: "follow_up",
}

export const CALL_OUTCOMES = [
    { id: "connected", label: "Connected" },
    { id: "no_answer", label: "No answer" },
    { id: "busy", label: "Busy" },
    { id: "call_back", label: "Call back requested" },
] as const

export type CallOutcome = (typeof CALL_OUTCOMES)[number]["id"]

export const MEETING_MODES = [
    { id: "in_person", label: "In person" },
    { id: "online", label: "Online" },
] as const

export type MeetingMode = (typeof MEETING_MODES)[number]["id"]

export function callOutcomeLabel(outcome: string | null | undefined): string | null {
    return CALL_OUTCOMES.find((entry) => entry.id === outcome)?.label ?? null
}

export function meetingModeLabel(mode: string | null | undefined): string | null {
    return MEETING_MODES.find((entry) => entry.id === mode)?.label ?? null
}

/** The note's prompt, naming the person (their first name) or the company. */
export function notePlaceholder(subject: string): string {
    return `Write a note about ${subject.trim() || "them"} — meeting summary, preferences…`
}

// ─── Days and times, where the person is ─────────────────────────────

const pad = (value: number) => String(value).padStart(2, "0")

/** "2026-09-25", the reader's calendar day. */
export function localDay(at: Date): string {
    return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
}

/** "14:05", the reader's clock. */
export function localTime(at: Date): string {
    return `${pad(at.getHours())}:${pad(at.getMinutes())}`
}

/** A calendar day moved by whole days: "2026-09-30" + 2 is "2026-10-02". */
export function shiftDay(day: string, days: number): string {
    const [year, month, date] = day.split("-").map(Number)
    return localDay(new Date(year, month - 1, date + days))
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME = /^(\d{2}):(\d{2})$/

/** A day and a time on the reader's clock as one instant; null when either is not one. */
export function combineLocal(day: string, time: string): Date | null {
    const d = DAY.exec(day)
    const t = TIME.exec(time)
    if (!d || !t) return null
    const at = new Date(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]))
    if (at.getDate() !== Number(d[3]) || Number(t[1]) > 23 || Number(t[2]) > 59) return null
    return at
}

/**
 * A follow-up's due day as an instant: noon on that day where the person
 * is, so the day reads the same anywhere in Indonesia (WIB, WITA, WIT) and
 * a few hours either side of it.
 */
export function dueAtFromDay(day: string): Date | null {
    return combineLocal(day, "12:00")
}

// ─── The form ────────────────────────────────────────────────────────

/**
 * What the composer holds while a person fills it in, as the fields show
 * it. One draft for every kind, so what was typed survives a change of
 * kind (a note that turns out to be a call keeps its words).
 */
export interface ComposerDraft {
    /** The note; a call's notes; a meeting's outcome or summary; an email's summary; a follow-up's notes. */
    text: string
    outcome: CallOutcome | null
    meetingMode: MeetingMode | null
    location: string
    meetingUrl: string
    /** An email's subject. */
    subject: string
    /** A follow-up's title. */
    title: string
    /** When it happened: the day ("2026-09-25") and the time ("14:05"). */
    date: string
    time: string
    /** Whether the person chose the day or the time; until then both follow the clock. */
    whenTouched: boolean
    /** A follow-up's due day. */
    dueDate: string
    assigneeId: string | null
}

/** A fresh form: now, due tomorrow, assigned to the person writing it. */
export function emptyDraft(now: Date, viewerId: string | null): ComposerDraft {
    return {
        text: "",
        outcome: null,
        meetingMode: null,
        location: "",
        meetingUrl: "",
        subject: "",
        title: "",
        date: localDay(now),
        time: localTime(now),
        whenTouched: false,
        dueDate: shiftDay(localDay(now), 1),
        assigneeId: viewerId,
    }
}

/** A draft whose "when" nobody chose follows the clock: it says now when it is saved, not when the page opened. */
export function withCurrentTime(draft: ComposerDraft, now: Date): ComposerDraft {
    if (draft.whenTouched) return draft
    return { ...draft, date: localDay(now), time: localTime(now) }
}

export const TEXT_MAX = 10_000
export const LINE_MAX = 300
export const URL_MAX = 2_000
/** How far past the clock a "when" may be: the minute being typed in, and a clock a little ahead. */
export const FUTURE_SLACK_MS = 60_000

/** A meeting link as typed ("meet.google.com/abc-defg-hij") made one that opens: https when it names none. */
export function normalizeMeetingUrl(value: string): string | null {
    const trimmed = value.trim()
    if (!trimmed) return null
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    try {
        const url = new URL(withScheme)
        if (url.protocol !== "https:" && url.protocol !== "http:") return null
        if (!url.hostname.includes(".") && url.hostname !== "localhost") return null
        return url.toString()
    } catch {
        return null
    }
}

const optionalText = z.string().trim().max(TEXT_MAX, { error: "Keep it under 10,000 characters" })

/** When it happened: an instant, never in the future. */
function happenedAt(now: Date) {
    return z.date({ error: "Choose the date and time" }).refine(
        (at) => at.getTime() <= now.getTime() + FUTURE_SLACK_MS,
        { error: "Can't be in the future" },
    )
}

/**
 * The schema each kind is checked against before it is saved, given the
 * time now (a call, a meeting or an email is logged after it happened).
 * Required: a note's text; a call's outcome and when; a meeting's mode and
 * when; an email's subject and when; a follow-up's title and due day.
 */
export function composerSchema(now: Date) {
    return z.discriminatedUnion("kind", [
        z.object({
            kind: z.literal("note"),
            text: z.string().trim().min(1, { error: "Write the note" }).max(TEXT_MAX, { error: "Keep it under 10,000 characters" }),
        }),
        z.object({
            kind: z.literal("call"),
            outcome: z.enum(CALL_OUTCOMES.map((entry) => entry.id) as [CallOutcome, ...CallOutcome[]], { error: "Choose how the call went" }),
            occurredAt: happenedAt(now),
            notes: optionalText,
        }),
        z.object({
            kind: z.literal("meeting"),
            mode: z.enum(MEETING_MODES.map((entry) => entry.id) as [MeetingMode, ...MeetingMode[]], { error: "Choose in person or online" }),
            location: z.string().trim().max(LINE_MAX, { error: "Keep it under 300 characters" }),
            meetingUrl: z.string().max(URL_MAX, { error: "The link is too long" }).nullable(),
            occurredAt: happenedAt(now),
            summary: optionalText,
        }),
        z.object({
            kind: z.literal("email"),
            subject: z.string().trim().min(1, { error: "Write the subject" }).max(LINE_MAX, { error: "Keep it under 300 characters" }),
            occurredAt: happenedAt(now),
            summary: optionalText,
        }),
        z.object({
            kind: z.literal("follow_up"),
            title: z.string().trim().min(1, { error: "Write what needs doing" }).max(LINE_MAX, { error: "Keep it under 300 characters" }),
            dueAt: z.date({ error: "Choose the due date" }),
            assigneeId: z.string().min(1).max(64).nullable(),
            notes: optionalText,
        }),
    ])
}

export type ComposerInput = z.infer<ReturnType<typeof composerSchema>>
export type LoggedInput = Exclude<ComposerInput, { kind: "note" }>

/** The fields a composer shows, for its errors. */
export type DraftField = "text" | "outcome" | "meetingMode" | "location" | "meetingUrl" | "subject" | "title" | "when" | "dueDate" | "assigneeId"

const ISSUE_FIELD: Record<string, DraftField> = {
    text: "text",
    notes: "text",
    summary: "text",
    outcome: "outcome",
    mode: "meetingMode",
    location: "location",
    meetingUrl: "meetingUrl",
    subject: "subject",
    title: "title",
    occurredAt: "when",
    dueAt: "dueDate",
    assigneeId: "assigneeId",
}

export type DraftResult =
    | { ok: true; input: ComposerInput }
    | { ok: false; errors: Partial<Record<DraftField, string>> }

/**
 * The draft of one kind read as what would be saved, or why it can't be:
 * the button is enabled on `ok`, and an error shows beside its field only
 * once there is something in it to be wrong (a time in the future, a link
 * that is not one), never for a field still empty.
 */
export function parseDraft(kind: ComposerKind, draft: ComposerDraft, now: Date): DraftResult {
    const errors: Partial<Record<DraftField, string>> = {}
    let candidate: Record<string, unknown>
    switch (kind) {
        case "note":
            candidate = { kind, text: draft.text }
            break
        case "call":
            candidate = { kind, outcome: draft.outcome ?? undefined, occurredAt: combineLocal(draft.date, draft.time) ?? undefined, notes: draft.text }
            break
        case "meeting": {
            const link = draft.meetingMode === "online" ? draft.meetingUrl.trim() : ""
            const url = link ? normalizeMeetingUrl(link) : null
            if (link && !url) errors.meetingUrl = "Enter a link, such as meet.google.com/abc-defg-hij"
            candidate = {
                kind,
                mode: draft.meetingMode ?? undefined,
                location: draft.meetingMode === "in_person" ? draft.location : "",
                meetingUrl: url,
                occurredAt: combineLocal(draft.date, draft.time) ?? undefined,
                summary: draft.text,
            }
            break
        }
        case "email":
            candidate = { kind, subject: draft.subject, occurredAt: combineLocal(draft.date, draft.time) ?? undefined, summary: draft.text }
            break
        case "follow_up":
            candidate = { kind, title: draft.title, dueAt: dueAtFromDay(draft.dueDate) ?? undefined, assigneeId: draft.assigneeId, notes: draft.text }
            break
    }
    const parsed = composerSchema(now).safeParse(candidate)
    if (parsed.success && Object.keys(errors).length === 0) return { ok: true, input: parsed.data }
    if (!parsed.success) {
        for (const issue of parsed.error.issues) {
            const field = ISSUE_FIELD[String(issue.path[0])]
            if (field && !errors[field]) errors[field] = issue.message
        }
    }
    return { ok: false, errors }
}

/** Whether a field holds anything yet, so its error is worth showing. */
export function fieldHasValue(field: DraftField, draft: ComposerDraft): boolean {
    switch (field) {
        case "text": return !!draft.text.trim()
        case "outcome": return !!draft.outcome
        case "meetingMode": return !!draft.meetingMode
        case "location": return !!draft.location.trim()
        case "meetingUrl": return !!draft.meetingUrl.trim()
        case "subject": return !!draft.subject.trim()
        case "title": return !!draft.title.trim()
        case "when": return !!draft.date && !!draft.time
        case "dueDate": return !!draft.dueDate
        case "assigneeId": return !!draft.assigneeId
    }
}

/** The errors worth showing now: those on a field that holds something. */
export function visibleErrors(result: DraftResult, draft: ComposerDraft): Partial<Record<DraftField, string>> {
    if (result.ok) return {}
    const shown: Partial<Record<DraftField, string>> = {}
    for (const [field, message] of Object.entries(result.errors) as [DraftField, string][]) {
        if (fieldHasValue(field, draft)) shown[field] = message
    }
    return shown
}

// ─── Saving ──────────────────────────────────────────────────────────

/** The columns a logged kind is written with (the record's key and the author are added by the caller). */
export interface ActivityColumns {
    action_type: string
    /** NOT NULL in the table: an empty string when nothing was written. */
    description: string
    occurred_at: string | null
    outcome: string | null
    meeting_mode: string | null
    location: string | null
    meeting_url: string | null
    subject: string | null
    due_at: string | null
    assignee_id: string | null
}

const orNull = (value: string | null | undefined) => {
    const trimmed = value?.trim()
    return trimmed ? trimmed : null
}

/** A call, a meeting, an email or a follow-up as the row it is saved as; every typed column set, the ones it does not use to null. */
export function activityColumns(input: LoggedInput): ActivityColumns {
    const base: ActivityColumns = {
        action_type: ACTION_TYPE[input.kind],
        description: "",
        occurred_at: null,
        outcome: null,
        meeting_mode: null,
        location: null,
        meeting_url: null,
        subject: null,
        due_at: null,
        assignee_id: null,
    }
    switch (input.kind) {
        case "call":
            return { ...base, description: input.notes.trim(), occurred_at: input.occurredAt.toISOString(), outcome: input.outcome }
        case "meeting":
            return {
                ...base,
                description: input.summary.trim(),
                occurred_at: input.occurredAt.toISOString(),
                meeting_mode: input.mode,
                location: input.mode === "in_person" ? orNull(input.location) : null,
                meeting_url: input.mode === "online" ? input.meetingUrl : null,
            }
        case "email":
            return { ...base, description: input.summary.trim(), occurred_at: input.occurredAt.toISOString(), subject: input.subject.trim() }
        case "follow_up":
            return { ...base, description: input.notes.trim(), due_at: input.dueAt.toISOString(), subject: input.title.trim(), assignee_id: input.assigneeId }
    }
}

/**
 * A saved row back as the form that edits it: its kind and a draft with
 * its values. An older row that has only its text (a call logged before
 * outcomes) opens with the text and asks for what it lacks.
 */
export function draftFromActivity(row: ActivityRow, viewerId: string | null): { kind: ComposerKind; draft: ComposerDraft } | null {
    const kind = activityKind(row.action_type)
    if (kind !== "call" && kind !== "meeting" && kind !== "email" && kind !== "follow_up") return null
    const when = new Date(row.occurred_at || row.created_at)
    const draft = emptyDraft(Number.isNaN(when.getTime()) ? new Date() : when, viewerId)
    draft.whenTouched = true
    draft.text = row.description ?? ""
    if (kind === "call") {
        draft.outcome = CALL_OUTCOMES.some((entry) => entry.id === row.outcome) ? (row.outcome as CallOutcome) : null
    } else if (kind === "meeting") {
        draft.meetingMode = MEETING_MODES.some((entry) => entry.id === row.meeting_mode) ? (row.meeting_mode as MeetingMode) : null
        draft.location = row.location ?? ""
        draft.meetingUrl = row.meeting_url ?? ""
    } else if (kind === "email") {
        draft.subject = row.subject ?? ""
    } else {
        draft.title = row.subject ?? ""
        const due = row.due_at ? new Date(row.due_at) : null
        draft.dueDate = due && !Number.isNaN(due.getTime()) ? localDay(due) : ""
        draft.assigneeId = row.assignee_id ?? null
    }
    return { kind, draft }
}
