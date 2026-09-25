import { formatCalendarDay, isBlank, readRecordTab, withRecordTab } from "@/lib/record-page"

/**
 * The contact-only half of a contact's record page
 * (`contact-detail-page.tsx`): its tabs, the name with its salutation,
 * when the business unit is worth naming, the secondary emails and phones
 * and social links, a custom field's value as text, and the DISC reading
 * sent from the field. What every record page shares (empty fields, the
 * quick actions' links, the leads' summary, the activity) is in
 * `lib/record-page.ts`.
 */

// ─── Tabs ────────────────────────────────────────────────────────────

export type ContactTab = "overview" | "activity" | "leads" | "files"

export const CONTACT_TAB_IDS: readonly ContactTab[] = ["overview", "activity", "leads", "files"]

/** `?tab=activity|leads|files` opens that tab; the old `?tab=timeline` opens Activity; anything else, the Overview. */
export function readContactTab(value: string | string[] | null | undefined): ContactTab {
    return readRecordTab(value, CONTACT_TAB_IDS, { timeline: "activity" })
}

/** The query string with the tab in it; the Overview, the default, is left out. */
export function withContactTab(search: string, tab: ContactTab): string {
    return withRecordTab(search, tab, "overview")
}

// ─── Fields ──────────────────────────────────────────────────────────

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
