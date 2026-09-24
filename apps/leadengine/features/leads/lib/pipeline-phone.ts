import type { Lead, PipelineStage } from "@/types"

/**
 * The Pipeline on a phone (below `md`): stage tabs over a list of lead
 * cards, where a desk shows the kanban board. The pure half of it: which
 * leads sit in which stage, what each tab says, which stage the page opens
 * on, how the choice lives in the URL, and what a card's chips and date
 * line say. `pipeline-phone-view.tsx` draws it.
 */

/** The URL parameter that keeps the stage a phone shows: `/leads?pipeline=…&stage=…`. */
export const STAGE_PARAM = "stage"

type StageRef = Pick<PipelineStage, "id" | "name">
type StageLead = Pick<Lead, "pipeline_stage_id" | "status">

/**
 * Whether a lead sits in a stage: by the stage's id, or, for a lead that
 * has no stage id, by its status matching the stage's name. The kanban
 * groups its columns the same way, so a lead is in the same place on a
 * desk and on a phone.
 */
export function leadInStage(lead: StageLead, stage: StageRef): boolean {
    return lead.pipeline_stage_id
        ? lead.pipeline_stage_id === stage.id
        : (lead.status || "").toLowerCase() === stage.name.toLowerCase()
}

export interface StageSummary {
    count: number
    /** The estimated values added up, as a kanban column's header adds them. */
    total: number
}

/** Each stage's lead count and total estimated value, keyed by stage id. */
export function summarizeStages(
    stages: StageRef[],
    leads: (StageLead & Pick<Lead, "estimated_value">)[],
): Map<string, StageSummary> {
    const summaries = new Map<string, StageSummary>()
    for (const stage of stages) {
        let count = 0
        let total = 0
        for (const lead of leads) {
            if (!leadInStage(lead, stage)) continue
            count += 1
            total += lead.estimated_value || 0
        }
        summaries.set(stage.id, { count, total })
    }
    return summaries
}

type TabStage = Pick<PipelineStage, "id" | "name" | "stage_type">

/**
 * The stage a phone opens on when none is chosen: the first open stage
 * with leads in it, so the page opens on work rather than on an empty
 * list; failing that the first stage with leads (a pipeline whose leads
 * are all closed); failing that the first open stage, then the first
 * stage. `stages` in the board's order (`sortStages`).
 */
export function defaultStageId(stages: TabStage[], summaries: Map<string, StageSummary>): string | null {
    const hasLeads = (stage: TabStage) => (summaries.get(stage.id)?.count ?? 0) > 0
    const open = stages.filter((stage) => stage.stage_type !== "closed")
    return (open.find(hasLeads) ?? stages.find(hasLeads) ?? open[0] ?? stages[0])?.id ?? null
}

/** The chosen stage when it belongs to this pipeline, otherwise the default. */
export function resolveStageId(
    stages: TabStage[],
    requested: string | null | undefined,
    summaries: Map<string, StageSummary>,
): string | null {
    if (requested && stages.some((stage) => stage.id === requested)) return requested
    return defaultStageId(stages, summaries)
}

/** `?stage=` from a query string (with or without its "?"); missing or blank is null. */
export function readStageParam(search: string): string | null {
    const value = new URLSearchParams(search).get(STAGE_PARAM)?.trim()
    return value ? value : null
}

/**
 * The query string with `stage` set to `stageId`, or removed for null,
 * every other parameter kept where it was. No leading "?".
 */
export function withStageParam(search: string, stageId: string | null): string {
    const params = new URLSearchParams(search)
    if (stageId) params.set(STAGE_PARAM, stageId)
    else params.delete(STAGE_PARAM)
    return params.toString()
}

/**
 * Where a row that scrolls sideways must stand to show one of its items
 * in the middle, held within the row's two ends. The tab row uses it to
 * bring the chosen stage into view by setting its own `scrollLeft`, so
 * nothing but the row moves.
 *
 * `fade` is the width of the row's edge fades (`EDGE_FADE_PX`), which show
 * on a side the row can still scroll toward. A centred item narrower than
 * the row less both fades is always clear of them (and at either end the
 * fade on that side is off); a wider one cannot be, so its start is kept
 * clear, where its name begins.
 */
export function scrollLeftToCenter({
    itemLeft,
    itemWidth,
    viewWidth,
    scrollWidth,
    fade = 0,
}: {
    itemLeft: number
    itemWidth: number
    viewWidth: number
    scrollWidth: number
    fade?: number
}): number {
    const max = Math.max(0, scrollWidth - viewWidth)
    const clamp = (left: number) => Math.round(Math.min(max, Math.max(0, left)))
    if (fade > 0 && itemWidth > viewWidth - 2 * fade) return clamp(itemLeft - fade)
    return clamp(itemLeft + itemWidth / 2 - viewWidth / 2)
}

// ─── A lead card's facts ─────────────────────────────────────────────

export type StageOutcome = "open" | "won" | "lost" | "closed"

interface StageFacts {
    name?: string | null
    closed_status?: "won" | "lost" | null
    stage_type?: "open" | "closed"
}

const LOST_WORDS = ["lost", "cancel", "cancelled", "canceled", "postpone", "postponed", "turndown"]

/**
 * Whether a stage is still open, or closed as won, lost, or just closed.
 * The stage's own `closed_status` first, then its name, as the kanban card
 * and its Move menu read it ("Closed Won", "Cancelled", "Postponed").
 */
export function stageOutcome(stage: StageFacts | null | undefined): StageOutcome {
    const name = (stage?.name || "").toLowerCase()
    if (stage?.closed_status === "won" || name.includes("won")) return "won"
    if (stage?.closed_status === "lost" || LOST_WORDS.some((word) => name.includes(word))) return "lost"
    if (stage?.stage_type === "closed") return "closed"
    return "open"
}

/** Today (or any moment) as a local calendar day, `YYYY-MM-DD`. */
export function localDayKey(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${date.getFullYear()}-${month}-${day}`
}

/** A stored date or timestamp as a local calendar day; a bare date stays the day it names. */
export function dayKeyOf(value: string): string | null {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : localDayKey(parsed)
}

function dayNumber(key: string): number {
    const [year, month, day] = key.split("-").map(Number)
    return Date.UTC(year, month - 1, day) / 86_400_000
}

export interface LeadDateFact {
    /**
     * `closing`: an open lead's target closing date. `won` / `lost`: when a
     * closed lead was won or closed. `updated`: a closed lead with no such
     * date, dated by its last update. `none`: nothing to say.
     */
    kind: "closing" | "won" | "lost" | "updated" | "none"
    /** The stored value the fact is about, as it was stored. */
    value: string | null
    /** That value as a local calendar day. */
    day: string | null
    /** For `closing`: passed, within three days, or later. */
    urgency: "overdue" | "soon" | "normal"
}

const NO_DATE: LeadDateFact = { kind: "none", value: null, day: null, urgency: "normal" }

/**
 * The date a lead card shows, by the state of its stage: an open lead its
 * target closing date, overdue once the day has passed and "soon" within
 * three days; a won lead the day it was won; any other closed lead
 * (lost, cancelled, postponed) the day it was closed; either falls back to
 * the last update. The kanban card's rule, shared with the phone's card.
 */
export function leadDateFact(
    lead: Pick<Lead, "target_close_date" | "closed_won_date" | "closed_lost_date" | "updated_at">,
    stage: StageFacts | null | undefined,
    today: string,
): LeadDateFact {
    const outcome = stageOutcome(stage)
    if (outcome === "won") {
        const value = lead.closed_won_date ?? lead.updated_at ?? null
        if (!value) return NO_DATE
        return { kind: lead.closed_won_date ? "won" : "updated", value, day: dayKeyOf(value), urgency: "normal" }
    }
    if (outcome !== "open") {
        const value = lead.closed_lost_date ?? lead.updated_at ?? null
        if (!value) return NO_DATE
        return { kind: lead.closed_lost_date ? "lost" : "updated", value, day: dayKeyOf(value), urgency: "normal" }
    }
    if (!lead.target_close_date) return NO_DATE
    const day = dayKeyOf(lead.target_close_date)
    if (!day) return NO_DATE
    const diff = dayNumber(day) - dayNumber(today)
    return {
        kind: "closing",
        value: lead.target_close_date,
        day,
        urgency: diff < 0 ? "overdue" : diff <= 3 ? "soon" : "normal",
    }
}

/**
 * The words before the date on a phone's card: "Closing 12 Sep 2026",
 * "Overdue 12 Sep 2026" (the word says it, not only the colour), "Won …",
 * "Closed …", "Updated …".
 */
export function dateFactWord(fact: LeadDateFact): string | null {
    switch (fact.kind) {
        case "closing":
            return fact.urgency === "overdue" ? "Overdue" : "Closing"
        case "won":
            return "Won"
        case "lost":
            return "Closed"
        case "updated":
            return "Updated"
        default:
            return null
    }
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/**
 * A calendar day as "12 Sep 2026", the same on every phone: a browser's own
 * en-GB months differ by version ("Sep", "Sept").
 */
export function formatDay(day: string): string {
    const [year, month, date] = day.split("-").map(Number)
    return `${date} ${MONTHS[month - 1]} ${year}`
}

export type ChipTone = "neutral" | "success" | "warning" | "danger" | "info"

export interface LeadChip {
    key: string
    label: string
    tone: ChipTone
}

/** The card badges a person can choose in Card Settings, in the order a card draws them. */
export const CARD_BADGE_ORDER = ["subsidiary", "grade_lead", "category", "lead_source", "main_stream", "event_format"] as const

/** A lead grade's tone: A the good news, B and C a caution, D the danger ink; the temperature words as `temperatureTone`. */
export function gradeTone(grade: string): ChipTone {
    const value = grade.trim().toUpperCase()
    if (value === "A+" || value === "A" || value === "WON") return "success"
    if (value === "B" || value === "C") return "warning"
    if (value === "D") return "danger"
    return temperatureTone(grade)
}

/** Hot, warm or cold (the lead's category): the danger ink, the caution, the calm blue. */
export function temperatureTone(category: string): ChipTone {
    const value = category.toLowerCase()
    if (value.includes("hot")) return "danger"
    if (value.includes("warm")) return "warning"
    if (value.includes("cold")) return "info"
    return "neutral"
}

type ChipLead = Pick<Lead, "grade_lead" | "category" | "lead_source" | "main_stream" | "event_format"> & {
    company?: { name: string } | null
}

/**
 * The chips a lead card shows: the badges the person chose in Card
 * Settings (business unit, grade, temperature, source, stream, format),
 * those the lead has a value for, in the card's order.
 */
export function leadChips(lead: ChipLead, badges: readonly string[]): LeadChip[] {
    const chips: LeadChip[] = []
    for (const key of CARD_BADGE_ORDER) {
        if (!badges.includes(key)) continue
        switch (key) {
            case "subsidiary":
                if (lead.company?.name) chips.push({ key, label: lead.company.name, tone: "neutral" })
                break
            case "grade_lead":
                if (lead.grade_lead) chips.push({ key, label: lead.grade_lead, tone: gradeTone(lead.grade_lead) })
                break
            case "category":
                if (lead.category) chips.push({ key, label: lead.category, tone: temperatureTone(lead.category) })
                break
            default: {
                const value = lead[key]
                if (value) chips.push({ key, label: value, tone: "neutral" })
            }
        }
    }
    return chips
}

/**
 * The count above a phone's cards, saying which it counts: "12 in
 * Proposal Sent · 245 in all stages". Both follow the search and filters,
 * as the tabs' counts do.
 */
export function stageCountLabel(stageName: string, inStage: number, inPipeline: number): string {
    const format = (value: number) => value.toLocaleString("en-US")
    return `${format(inStage)} in ${stageName} · ${format(inPipeline)} in all stages`
}
