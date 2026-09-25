import { normalizePhoneToE164 } from "@/lib/phone-normalize"
import { formatRelativeTime } from "@/lib/relative-time"
import {
    activityKind, callOutcomeLabel, isFollowUp, isOpenFollowUp, meetingModeLabel, type ActivityKind, type ActivityRow,
} from "@/lib/record-activity"

/**
 * The pure half of a record's page (a contact and a company; the lead is to
 * follow): which tab the address opens, the empty fields folded under "Show
 * N empty fields", the links behind Call, WhatsApp, Email and Website, the
 * one-line summary of the record's leads, and the activity: what each
 * timeline row is called, History (notes merged in), Upcoming (the open
 * follow-ups) and what "Last activity" says. What the composer logs and
 * how it is saved is `lib/record-activity.ts`. See DESIGN.md, "Record
 * pages".
 */

// ─── Tabs ────────────────────────────────────────────────────────────

/**
 * The tab `?tab=` names, the first of `ids` (Activity) for anything else.
 * `aliases` keeps an old address working (`?tab=overview` and
 * `?tab=timeline` are Activity now).
 */
export function readRecordTab<T extends string>(
    value: string | string[] | null | undefined,
    ids: readonly T[],
    aliases: Readonly<Record<string, T>> = {},
): T {
    const raw = Array.isArray(value) ? value[0] : value
    if (raw && (ids as readonly string[]).includes(raw)) return raw as T
    if (raw && aliases[raw]) return aliases[raw]
    return ids[0]
}

/** The query string with the tab in it; the default tab is left out. */
export function withRecordTab(search: string, tab: string, defaultTab: string): string {
    const params = new URLSearchParams(search)
    if (tab === defaultTab) params.delete("tab")
    else params.set("tab", tab)
    return params.toString()
}

// ─── Fields ──────────────────────────────────────────────────────────

/** An empty value: nothing, blank text, or an empty list. */
export function isBlank(value: unknown): boolean {
    if (value === null || value === undefined) return true
    if (typeof value === "string") return value.trim() === ""
    if (Array.isArray(value)) return value.every(isBlank)
    return false
}

/**
 * Which fields show and which fold under "Show N empty fields" (Zoho's
 * record page; M3: show what is known first). A field with a value shows;
 * an empty field the person can fill in folds; an empty field nobody fills
 * in here (the DISC reading sent from the field, the business unit) is
 * left out, since "—" beside it tells nobody anything. Order is kept.
 */
export function splitEmptyFields<T extends { empty: boolean; fillable: boolean }>(fields: readonly T[]): { filled: T[]; empty: T[] } {
    const filled: T[] = []
    const empty: T[] = []
    for (const field of fields) {
        if (!field.empty) filled.push(field)
        else if (field.fillable) empty.push(field)
    }
    return { filled, empty }
}

/** "Show 1 empty field" / "Show 4 empty fields". */
export function emptyFieldsToggleLabel(count: number, open: boolean): string {
    if (open) return count === 1 ? "Hide the empty field" : "Hide empty fields"
    return `Show ${count} empty ${count === 1 ? "field" : "fields"}`
}

/** The facts that exist, joined with a middle dot: "IT Services · Jakarta Selatan". */
export function joinFacts(parts: readonly (string | null | undefined)[]): string {
    return parts.map((part) => part?.trim()).filter(Boolean).join(" · ")
}

/** The first word of a name, for "Write a note about Abdan…". */
export function firstName(fullName: string | null | undefined): string {
    return fullName?.trim().split(/\s+/)[0] ?? ""
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/**
 * A day as "3 Sep 2026", the same in every browser (their own en-GB months
 * differ by version, "Sep" or "Sept"; the Pipeline's `formatDay` does the
 * same). A plain "2026-09-03" is that calendar day; a timestamp is its day
 * where the reader is. Null for nothing or a value that is not a date.
 */
export function formatCalendarDay(value: string | null | undefined): string | null {
    if (!value) return null
    const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    if (plain) return `${Number(plain[3])} ${MONTHS[Number(plain[2]) - 1]} ${plain[1]}`
    const day = new Date(value)
    if (Number.isNaN(day.getTime())) return null
    return `${day.getDate()} ${MONTHS[day.getMonth()]} ${day.getFullYear()}`
}

/** "3 Sep 2026, 14:05", where the reader is. */
export function formatDayTime(value: string | null | undefined): string | null {
    if (!value) return null
    const at = new Date(value)
    if (Number.isNaN(at.getTime())) return null
    const time = `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`
    return `${formatCalendarDay(value)}, ${time}`
}

// ─── Quick actions ───────────────────────────────────────────────────

export function mailtoHref(email: string | null | undefined): string | null {
    const trimmed = email?.trim()
    return trimmed ? `mailto:${trimmed}` : null
}

/** `tel:` takes the stored number (E.164), never the spaced display form. */
export function telHref(phone: string | null | undefined): string | null {
    const trimmed = phone?.trim()
    if (!trimmed) return null
    const dialable = trimmed.replace(/[^\d+]/g, "")
    return dialable.replace(/\D/g, "").length >= 5 ? `tel:${dialable}` : null
}

/**
 * WhatsApp's click-to-chat link: the app on a phone, WhatsApp Web or
 * Desktop on a desk. wa.me wants the country code and no plus, so a local
 * "0812…" that skipped normalisation becomes "62812…" (Sales Activity's
 * `whatsAppLink`, the same rule).
 */
export function whatsAppHref(phone: string | null | undefined): string | null {
    const trimmed = phone?.trim()
    if (!trimmed) return null
    const e164 = normalizePhoneToE164(trimmed)
    let digits = (e164 ?? trimmed).replace(/\D/g, "")
    if (!e164 && digits.startsWith("0")) digits = `62${digits.slice(1)}`
    return digits.length >= 8 ? `https://wa.me/${digits}` : null
}

/** An address typed without a scheme ("linkedin.com/in/…") opened as https. */
export function externalHref(url: string): string {
    return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

/** A website as people say it: "https://www.acme.co.id/" reads "www.acme.co.id". */
export function websiteLabel(url: string | null | undefined): string | null {
    const trimmed = url?.trim()
    if (!trimmed) return null
    return trimmed.replace(/^https?:\/\//i, "").replace(/\/+$/, "")
}

// ─── Leads ───────────────────────────────────────────────────────────

export interface LeadStageFacts {
    name?: string | null
    stage_type?: string | null
    closed_status?: string | null
}

export type LeadStanding = "open" | "won" | "lost" | "closed"

/**
 * Where a lead stands, from its stage: the stage's own closed status when
 * the pipeline records one, otherwise its name, as the pages always read it
 * ("Closed Won", "Lost", "Cancelled", "Turndown", "Postponed").
 */
export function leadStanding(stage: LeadStageFacts | null | undefined): LeadStanding {
    if (!stage) return "open"
    if (stage.closed_status === "won") return "won"
    if (stage.closed_status === "lost") return "lost"
    if (stage.stage_type === "closed") return "closed"
    const name = (stage.name ?? "").toLowerCase()
    if (name.includes("won")) return "won"
    if (["lost", "cancel", "turndown", "postponed"].some((word) => name.includes(word))) return "lost"
    return "open"
}

export interface LeadSummary {
    total: number
    open: number
    won: number
    /** The estimated value of the open leads: what is still in play. */
    openValue: number
}

export function summarizeLeads(
    leads: readonly { estimated_value: number | null; pipeline_stage: LeadStageFacts | null }[],
): LeadSummary {
    let open = 0
    let won = 0
    let openValue = 0
    for (const lead of leads) {
        const standing = leadStanding(lead.pipeline_stage)
        if (standing === "open") {
            open += 1
            openValue += lead.estimated_value ?? 0
        } else if (standing === "won") {
            won += 1
        }
    }
    return { total: leads.length, open, won, openValue }
}

/**
 * The line over a record's leads, "2 open · Rp 1.2B · 1 won": how many are
 * in play and what they are worth, then how many were won. Nothing when
 * there are no leads (the card says so itself); the value is left out at
 * zero and the won count when none were won.
 */
export function leadSummaryLabel(summary: LeadSummary, money: (amount: number) => string): string | null {
    if (summary.total === 0) return null
    const parts = [`${summary.open} open`]
    if (summary.openValue > 0) parts.push(money(summary.openValue))
    if (summary.won > 0) parts.push(`${summary.won} won`)
    return parts.join(" · ")
}

// ─── Activity ────────────────────────────────────────────────────────

export { activityKind, type ActivityKind, type ActivityRow }

/**
 * The kinds that are contact with the person or the account, which "Last
 * activity" counts: a note, a call, a meeting, an email (HubSpot's last
 * activity date). A follow-up is a plan, not contact; a field changed or a
 * file uploaded is not contact with anyone.
 */
export const ENGAGEMENT_KINDS: readonly ActivityKind[] = ["note", "call", "email", "meeting"]

const KIND_TITLE: Record<ActivityKind, string> = {
    note: "Note",
    call: "Call",
    email: "Email",
    meeting: "Meeting",
    follow_up: "Task",
    file: "File",
    stage: "Stage changed",
    create: "Record created",
    update: "Details updated",
    delete: "Removed",
    other: "Activity",
}

/** "File Uploaded" → "File uploaded": the app's own words, in sentence case. */
function sentenceCase(text: string): string {
    const trimmed = text.trim()
    return trimmed ? trimmed[0].toUpperCase() + trimmed.slice(1).toLowerCase() : trimmed
}

type TitleFacts = Pick<ActivityRow, "action_type" | "outcome" | "meeting_mode" | "location" | "subject" | "due_at" | "completed_at">

/**
 * A row's title, what it was in a few words: "Call · Connected", "Meeting
 * · In person · The Manhattan Square", "Meeting · Online", "Email ·
 * Proposal v2", "Follow-up done · Send the proposal", "File uploaded". A
 * row logged before these fields existed says its kind alone ("Call"; an
 * old task, "Task").
 */
export function activityTitle(row: TitleFacts): string {
    const kind = activityKind(row.action_type)
    switch (kind) {
        case "call":
            return joinFacts(["Call", callOutcomeLabel(row.outcome)])
        case "meeting":
            return joinFacts(["Meeting", meetingModeLabel(row.meeting_mode), row.meeting_mode === "in_person" ? row.location : null])
        case "email":
            return joinFacts(["Email", row.subject])
        case "follow_up":
            if (!row.due_at) return KIND_TITLE.follow_up
            return joinFacts([row.completed_at ? "Follow-up done" : "Follow-up", row.subject])
        case "file":
            return row.action_type?.trim() ? sentenceCase(row.action_type) : KIND_TITLE.file
        default:
            return KIND_TITLE[kind]
    }
}

export interface NoteRow {
    id: string
    content: string
    author_name: string | null
    user_id: string | null
    created_at: string
}

/** The people a record's activity names (its assignees, who ticked a follow-up done), by id. */
export type PeopleById = Readonly<Record<string, { full_name: string | null; avatar_url?: string | null }>>

function personName(people: PeopleById, id: string | null | undefined): string | null {
    return (id && people[id]?.full_name?.trim()) || null
}

export interface FeedItem {
    /** "a:<activity id>" or "n:<note id>". */
    key: string
    kind: ActivityKind
    title: string
    /** Who did it (who ticked a follow-up done); null for the system. */
    actor: string | null
    detail: string | null
    /** When it happened: the time a person chose, when a follow-up was done, else when it was written. */
    at: string
    attachment: string | null
    /** An online meeting's link. */
    link: string | null
    /** Set on a note from the notes table, which its author or an admin may edit or delete. */
    note: { id: string; userId: string | null; content: string } | null
    /** The timeline row behind it, for Edit, Delete and a follow-up's tick. */
    row: ActivityRow | null
}

const MIRRORED_NOTE = /^Added a note: "/

/**
 * The copy of a note the database writes to the timeline when a note is
 * added (`audit_contact_notes`, `audit_company_notes`): its first 100
 * characters, frozen. The feed shows the note itself instead, whole and as
 * it reads now.
 */
export function isMirroredNote(row: Pick<ActivityRow, "action_type" | "description">): boolean {
    return row.action_type === "note" && MIRRORED_NOTE.test(row.description ?? "")
}

/**
 * History, newest first: the timeline's rows, with the notes taken from
 * the notes table (whole, editable) in place of the database's truncated
 * copies, and without the open follow-ups, which are Upcoming's; a
 * follow-up joins History when it is done, at the time it was done, under
 * the name of whoever ticked it. A note logged through the old Log Activity
 * dialog lives only in the timeline and stays as it was.
 */
export function buildFeed(activities: readonly ActivityRow[], notes: readonly NoteRow[] = [], people: PeopleById = {}): FeedItem[] {
    const items: FeedItem[] = []
    for (const row of activities) {
        if (isMirroredNote(row) || isOpenFollowUp(row)) continue
        const kind = activityKind(row.action_type)
        const done = isFollowUp(row) && !!row.completed_at
        items.push({
            key: `a:${row.id}`,
            kind,
            title: activityTitle(row),
            actor: done ? personName(people, row.completed_by) : row.profile?.full_name?.trim() || null,
            detail: row.description?.trim() || null,
            at: (done ? row.completed_at : row.occurred_at) || row.created_at,
            attachment: row.attachment_name ?? null,
            link: kind === "meeting" && row.meeting_url?.trim() ? row.meeting_url.trim() : null,
            note: null,
            row,
        })
    }
    for (const note of notes) {
        items.push({
            key: `n:${note.id}`,
            kind: "note",
            title: KIND_TITLE.note,
            actor: note.author_name?.trim() || null,
            detail: note.content,
            at: note.created_at,
            attachment: null,
            link: null,
            note: { id: note.id, userId: note.user_id, content: note.content },
            row: null,
        })
    }
    return items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
}

export interface UpcomingItem {
    key: string
    title: string
    detail: string | null
    dueAt: string
    assignee: { id: string; name: string; avatarUrl: string | null } | null
    row: ActivityRow
}

/** Upcoming: the open follow-ups, the one due first on top (the most overdue), then the oldest. */
export function buildUpcoming(activities: readonly ActivityRow[], people: PeopleById = {}): UpcomingItem[] {
    return activities
        .filter(isOpenFollowUp)
        .map((row): UpcomingItem => {
            const name = personName(people, row.assignee_id)
            return {
                key: `a:${row.id}`,
                title: row.subject?.trim() || "Follow-up",
                detail: row.description?.trim() || null,
                dueAt: row.due_at as string,
                assignee: row.assignee_id && name ? { id: row.assignee_id, name, avatarUrl: people[row.assignee_id]?.avatar_url ?? null } : null,
                row,
            }
        })
        .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt) || Date.parse(a.row.created_at) - Date.parse(b.row.created_at))
}

/** "3 Oct" this year, "3 Oct 2027" another. */
function shortDay(at: Date, now: Date): string {
    const day = `${at.getDate()} ${MONTHS[at.getMonth()]}`
    return at.getFullYear() === now.getFullYear() ? day : `${day} ${at.getFullYear()}`
}

/**
 * When a follow-up is due, as its row says it: "Due today", "Due
 * tomorrow", "Due 3 Oct", or, once the day has passed, "Overdue · 20 Sep"
 * (in the danger ink; the word says it too, for whoever does not see the
 * colour). Days are the reader's calendar days.
 */
export function dueLabel(dueAt: string, now: Date = new Date()): { text: string; overdue: boolean } {
    const due = new Date(dueAt)
    if (Number.isNaN(due.getTime())) return { text: "", overdue: false }
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime()
    const days = Math.round((dueDay - today) / 86_400_000)
    if (days < 0) return { text: `Overdue · ${shortDay(due, now)}`, overdue: true }
    if (days === 0) return { text: "Due today", overdue: false }
    if (days === 1) return { text: "Due tomorrow", overdue: false }
    return { text: `Due ${shortDay(due, now)}`, overdue: false }
}

/** "Hanung Prasetyo" → "Hanung P.": a name short enough for a phone's row. */
export function shortPersonName(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean)
    if (words.length < 2) return words[0] ?? ""
    return `${words[0]} ${words[words.length - 1][0].toUpperCase()}.`
}

/** Who, after a row's title: the name on a desk, "Hanung P." on a phone; nothing for the system. */
export function feedByline(item: Pick<FeedItem, "actor">, compact = false): string | null {
    if (!item.actor) return null
    return compact ? shortPersonName(item.actor) : item.actor
}

/**
 * When, as a timeline says it: "just now", "3 hours ago", "2 days ago" for
 * the last week, then the day ("12 Sep 2026"). `compact` is the phone's:
 * "now", "5m", "3h", "2d", "12 Sep" (the year only when it is not this one).
 * A time ahead of the clock (a row logged on a clock running fast) reads as now.
 */
export function activityTime(iso: string, now: Date = new Date(), compact = false): string {
    const at = new Date(iso)
    const time = at.getTime()
    if (Number.isNaN(time)) return ""
    const seconds = Math.max(0, Math.floor((now.getTime() - time) / 1000))
    const week = 7 * 86400
    if (!compact) {
        if (seconds < week) return formatRelativeTime(time > now.getTime() ? now.toISOString() : iso, now) ?? ""
        return formatCalendarDay(iso) ?? ""
    }
    if (seconds < 60) return "now"
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
    if (seconds < week) return `${Math.floor(seconds / 86400)}d`
    return shortDay(at, now)
}

/**
 * "Last activity" in a record's facts: the newest note, call, meeting or
 * email, by when it happened, as "Call · 2 days ago"; null when there is
 * none (the page says "No activity yet").
 */
export function lastActivityLabel(feed: readonly FeedItem[], now: Date = new Date()): string | null {
    const latest = feed.find((item) => ENGAGEMENT_KINDS.includes(item.kind))
    if (!latest) return null
    return `${KIND_TITLE[latest.kind]} · ${activityTime(latest.at, now)}`
}

export type FeedFilter = "all" | "note" | "call" | "meeting" | "email" | "follow_up" | "file" | "changes"

export const FEED_FILTERS: readonly { id: FeedFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "note", label: "Notes" },
    { id: "call", label: "Calls" },
    { id: "meeting", label: "Meetings" },
    { id: "email", label: "Emails" },
    { id: "follow_up", label: "Follow-ups" },
    { id: "file", label: "Files" },
    { id: "changes", label: "Changes" },
]

function matchesFilter(item: FeedItem, filter: FeedFilter): boolean {
    if (filter === "all") return true
    if (filter === "changes") return ["stage", "create", "update", "delete", "other"].includes(item.kind)
    return item.kind === filter
}

export function filterFeed(items: readonly FeedItem[], filter: FeedFilter): FeedItem[] {
    return items.filter((item) => matchesFilter(item, filter))
}

/** The filters worth offering: All, then only those with something to show. */
export function feedFilterOptions(items: readonly FeedItem[]): { id: FeedFilter; label: string }[] {
    return FEED_FILTERS.filter((filter) => filter.id === "all" || items.some((item) => matchesFilter(item, filter.id)))
}
