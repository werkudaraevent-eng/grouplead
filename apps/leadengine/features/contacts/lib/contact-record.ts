import { normalizePhoneToE164 } from "@/lib/phone-normalize"

/**
 * The pure half of a contact's record page (`contact-detail-page.tsx`): the
 * sections its rail and chips jump to, the one-line summary of the
 * contact's leads, which fields fold under "Show N empty fields", the
 * links behind Call, WhatsApp and Email, and the DISC reading sent from
 * the field.
 */

// ─── Tabs ────────────────────────────────────────────────────────────

export type ContactTab = "overview" | "timeline"

export const CONTACT_TABS: readonly { id: ContactTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "timeline", label: "Timeline" },
]

/** `?tab=timeline` opens the Timeline; anything else, the Overview. */
export function readContactTab(value: string | string[] | null | undefined): ContactTab {
    const raw = Array.isArray(value) ? value[0] : value
    return raw === "timeline" ? "timeline" : "overview"
}

/** The query string with the tab in it; the Overview, the default, is left out. */
export function withContactTab(search: string, tab: ContactTab): string {
    const params = new URLSearchParams(search)
    if (tab === "overview") params.delete("tab")
    else params.set("tab", tab)
    return params.toString()
}

// ─── Sections ────────────────────────────────────────────────────────

export type ContactSectionId = "info" | "notes" | "leads" | "files"

export const CONTACT_SECTIONS: readonly { id: ContactSectionId; label: string }[] = [
    { id: "info", label: "Info" },
    { id: "notes", label: "Notes" },
    { id: "leads", label: "Leads" },
    { id: "files", label: "Files" },
]

/** The element id of a section, and of its heading (the jump's focus target). */
export function contactSectionDomId(id: ContactSectionId): string {
    return `contact-${id}`
}

/**
 * The count a rail item or chip carries: Info has none; the others once
 * they are known (null while notes or files are still loading, so a "0"
 * never flashes before the real number).
 */
export function sectionCounts(counts: {
    notes: number | null
    leads: number | null
    files: number | null
}): Record<ContactSectionId, number | null> {
    return { info: null, notes: counts.notes, leads: counts.leads, files: counts.files }
}

/** "Notes, 3" for a screen reader; "Info" alone. */
export function sectionAccessibleLabel(label: string, count: number | null): string {
    return count === null ? label : `${label}, ${count}`
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
 * the pipeline records one, otherwise its name, as the page always read it
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

export interface ContactLeadSummary {
    total: number
    active: number
    won: number
    /** The estimated value of the active leads: what is still in play. */
    activeValue: number
}

export function summarizeContactLeads(
    leads: readonly { estimated_value: number | null; pipeline_stage: LeadStageFacts | null }[],
): ContactLeadSummary {
    let active = 0
    let won = 0
    let activeValue = 0
    for (const lead of leads) {
        const standing = leadStanding(lead.pipeline_stage)
        if (standing === "open") {
            active += 1
            activeValue += lead.estimated_value ?? 0
        } else if (standing === "won") {
            won += 1
        }
    }
    return { total: leads.length, active, won, activeValue }
}

/**
 * The line beside the Leads heading, "2 active · Rp 1.2B · 1 won": how many
 * are in play and what they are worth, then how many were won. Nothing
 * when the contact has no leads (the section says so itself); the value is
 * left out at zero and the won count when none were won.
 */
export function leadSummaryLabel(summary: ContactLeadSummary, money: (amount: number) => string): string | null {
    if (summary.total === 0) return null
    const parts = [`${summary.active} active`]
    if (summary.activeValue > 0) parts.push(money(summary.activeValue))
    if (summary.won > 0) parts.push(`${summary.won} won`)
    return parts.join(" · ")
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

/** The secondary emails or phones as one list, the old single column first, without repeats. */
export function secondaryValues(single: string | null | undefined, list: readonly (string | null)[] | null | undefined): string[] {
    const out: string[] = []
    for (const value of [single, ...(list ?? [])]) {
        const trimmed = value?.trim()
        if (trimmed && !out.includes(trimmed)) out.push(trimmed)
    }
    return out
}

export interface SocialLink {
    platform: string
    url: string
}

/** LinkedIn (its own old column) then every other profile, each once. */
export function socialLinks(linkedinUrl: string | null | undefined, socialUrls: readonly Partial<SocialLink>[] | null | undefined): SocialLink[] {
    const out: SocialLink[] = []
    const seen = new Set<string>()
    const add = (platform: string, url: string | null | undefined) => {
        const trimmed = url?.trim()
        if (!trimmed || seen.has(trimmed)) return
        seen.add(trimmed)
        out.push({ platform, url: trimmed })
    }
    add("LinkedIn", linkedinUrl)
    for (const link of Array.isArray(socialUrls) ? socialUrls : []) add(link.platform?.trim() || "Link", link.url)
    return out
}

/** An address typed without a scheme ("linkedin.com/in/…") opened as https. */
export function externalHref(url: string): string {
    return /^https?:\/\//i.test(url) ? url : `https://${url}`
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

/**
 * A custom field's value as text: a date as "3 Sep 2026", a number with
 * its separators, a list joined with commas, a yes/no as Yes or No.
 * Nothing (null) for an empty value.
 */
export function formatCustomValue(value: unknown, fieldType: string | null | undefined): string | null {
    if (isBlank(value)) return null
    if (Array.isArray(value)) return value.filter((item) => !isBlank(item)).map(String).join(", ")
    if (typeof value === "boolean") return value ? "Yes" : "No"
    if (fieldType === "number") {
        const number = typeof value === "number" ? value : Number(value)
        return Number.isFinite(number) ? number.toLocaleString("en-US") : String(value)
    }
    if (fieldType === "date" && typeof value === "string") return formatCalendarDay(value) ?? value
    if (typeof value === "object") return JSON.stringify(value)
    return String(value)
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

// ─── The header ──────────────────────────────────────────────────────

export function nameWithSalutation(salutation: string | null | undefined, fullName: string): string {
    const title = salutation?.trim()
    return title ? `${title} ${fullName}` : fullName
}

/**
 * The business unit (`companies`, the tenant's own unit, never the client
 * company) says something only to someone who sees more than one unit: in
 * the holding view, or with memberships in several. For everyone else
 * every contact they can open is in their one unit.
 */
export function showBusinessUnit({
    unitName,
    isHoldingView,
    unitCount,
}: {
    unitName: string | null | undefined
    isHoldingView: boolean
    unitCount: number
}): boolean {
    return !!unitName?.trim() && (isHoldingView || unitCount > 1)
}

// ─── DISC ────────────────────────────────────────────────────────────

export const DISC_NAMES: Record<string, string> = { D: "Dominance", I: "Influence", S: "Steadiness", C: "Conscientiousness" }

export interface DiscReading {
    primary: string
    secondary: string | null
    note: string | null
    assessedByName: string | null
    assessedAt: string | null
}

/** The DISC reading Sales Activity stores under custom_fields.disc, or null when malformed or absent. */
export function readDisc(customFields: Record<string, unknown> | null | undefined): DiscReading | null {
    const raw = customFields?.disc
    if (!raw || typeof raw !== "object") return null
    const disc = raw as Record<string, unknown>
    const primary = typeof disc.primary === "string" && DISC_NAMES[disc.primary] ? disc.primary : null
    if (!primary) return null
    const secondary = typeof disc.secondary === "string" && DISC_NAMES[disc.secondary] && disc.secondary !== primary ? disc.secondary : null
    return {
        primary,
        secondary,
        note: typeof disc.note === "string" && disc.note.trim() ? disc.note.trim() : null,
        assessedByName: typeof disc.assessedByName === "string" && disc.assessedByName.trim() ? disc.assessedByName : null,
        assessedAt: typeof disc.assessedAt === "string" ? disc.assessedAt : null,
    }
}

/** "DI" and "Dominance with an Influence side" for a reading. */
export function discSummary(disc: DiscReading): { code: string; meaning: string } {
    const code = disc.secondary ? `${disc.primary}${disc.secondary}` : disc.primary
    const meaning = disc.secondary
        ? `${DISC_NAMES[disc.primary]} with ${/^[AEIOU]/.test(DISC_NAMES[disc.secondary]) ? "an" : "a"} ${DISC_NAMES[disc.secondary]} side`
        : DISC_NAMES[disc.primary]
    return { code, meaning }
}
