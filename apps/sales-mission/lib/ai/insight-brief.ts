/**
 * The brief's vocabulary and the pure rules around it.
 *
 * An insight is a list of items, each one belonging to one of three
 * sections: what has to be acted on, what the reps heard in the field, and
 * what management should decide. The order of those sections is the
 * brief's argument, so it is written down once here and used by the page,
 * the teaser card and the WhatsApp text alike. Everything in this file is
 * pure and safe to import from a client component; the model call, the
 * database and the prompt live in `insights.ts`.
 */

import { paths } from "@/lib/paths"
import { plainText } from "./answer-format"
import { wibDayOf } from "./insight-facts"

export const INSIGHT_KINDS = ["naik", "turun", "perlu_tindakan", "info"] as const
export type InsightKind = (typeof INSIGHT_KINDS)[number]

/** The brief's three parts, in the order they are read. */
export const INSIGHT_SECTIONS = ["tindak", "lapangan", "rekomendasi"] as const
export type InsightSection = (typeof INSIGHT_SECTIONS)[number]

export const INSIGHT_SECTION_LABELS: Record<InsightSection, string> = {
  tindak: "Perlu ditindak",
  lapangan: "Yang terdengar di lapangan",
  rekomendasi: "Rekomendasi",
}

/** Where a sentence can point. The model picks a key; the app turns it into a link it controls. */
export const INSIGHT_LINKS = ["laporan_hari_ini", "laporan_tertunda", "prospek_jatuh_tempo", "aktivitas_hari_ini", "aktivitas_besok", "ringkasan_minggu"] as const
export type InsightLink = (typeof INSIGHT_LINKS)[number]

export interface InsightItem {
  text: string
  kind: InsightKind
  section: InsightSection
  link: InsightLink | null
  /** Activities whose report is the evidence for this item; ids that were in the facts. */
  missionIds?: string[]
}

/** Two sentences, forty-five words: the cap the prompt states, enforced here. */
const MAX_TEXT = 340
/** Nine items across three sections. */
const MAX_ITEMS = 9
/** How many reports one item may point at; more than three is a list, not evidence. */
const MAX_MISSION_IDS = 3
/** How many items the card teases before the page takes over. */
export const TEASER_ITEMS = 3

/** The link key as a URL into the app, for the day the insight is about. */
export function insightHref(link: InsightLink | null, day: string): string | null {
  switch (link) {
    case "laporan_hari_ini":
      return paths.reportList({ date: "custom", from: day, to: day })
    case "laporan_tertunda":
      return paths.activities({ report: "needs_report", date: "past" })
    case "prospek_jatuh_tempo":
      return paths.prospectList({ due: "1" })
    case "aktivitas_hari_ini":
      return paths.activities({ date: "custom", from: day, to: day })
    case "aktivitas_besok": {
      const next = new Date(`${day}T00:00:00+07:00`)
      next.setUTCDate(next.getUTCDate() + 1)
      const tomorrow = wibDayOf(next)
      return paths.activities({ date: "custom", from: tomorrow, to: tomorrow })
    }
    case "ringkasan_minggu":
      return paths.reportSummary({ date: "week" })
    default:
      return null
  }
}

/**
 * One item out of whatever the model (or an older row) put there. A row
 * written before the brief had sections is a field observation, which is
 * where an unlabelled sentence belongs.
 */
function toItem(entry: unknown, allowedMissionIds?: ReadonlySet<string>): InsightItem | null {
  if (!entry || typeof entry !== "object") return null
  const record = entry as Record<string, unknown>
  const body = typeof record.text === "string" ? plainText(record.text.replace(/\s+/g, " ")) : ""
  if (!body) return null
  const kind = (INSIGHT_KINDS as readonly string[]).includes(String(record.kind)) ? (record.kind as InsightKind) : "info"
  const section = (INSIGHT_SECTIONS as readonly string[]).includes(String(record.section)) ? (record.section as InsightSection) : "lapangan"
  const link = (INSIGHT_LINKS as readonly string[]).includes(String(record.link)) ? (record.link as InsightLink) : null
  const ids = Array.isArray(record.missionIds) ? record.missionIds : []
  const missionIds = ids
    .filter((id): id is string => typeof id === "string" && (!allowedMissionIds || allowedMissionIds.has(id)))
    .slice(0, MAX_MISSION_IDS)
  const item: InsightItem = { text: body.slice(0, MAX_TEXT), kind, section, link }
  if (missionIds.length) item.missionIds = missionIds
  return item
}

/**
 * The model's answer as items, or null when it is not the shape asked for.
 * Fences are stripped, unknown kinds, sections and links fall back, mission
 * ids that were not in the facts are dropped, and the list is capped, so a
 * slightly sloppy answer still lands.
 */
export function parseInsightItems(raw: string, allowedMissionIds?: ReadonlySet<string>): InsightItem[] | null {
  let text = raw.trim()
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) text = fenced[1].trim()
  const start = text.indexOf("{")
  const arrayStart = text.indexOf("[")
  if (start === -1 && arrayStart === -1) return null
  const from = start === -1 ? arrayStart : arrayStart === -1 ? start : Math.min(start, arrayStart)
  let parsed: unknown
  try {
    parsed = JSON.parse(text.slice(from, text.lastIndexOf(text[from] === "{" ? "}" : "]") + 1))
  } catch {
    return null
  }
  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { items?: unknown }).items)
      ? (parsed as { items: unknown[] }).items
      : null
  if (!list) return null
  const items: InsightItem[] = []
  for (const entry of list) {
    const item = toItem(entry, allowedMissionIds)
    if (!item) continue
    items.push(item)
    if (items.length === MAX_ITEMS) break
  }
  return items.length ? items : null
}

/** A stored row's items, tolerating rows written before a field existed. */
export function storedInsightItems(raw: unknown): InsightItem[] {
  if (!Array.isArray(raw)) return []
  const items: InsightItem[] = []
  for (const entry of raw) {
    const item = toItem(entry)
    if (item) items.push(item)
  }
  return items
}

/** The items of one section, in the order the model wrote them. */
export function itemsOfSection<T extends { section: InsightSection }>(items: readonly T[], section: InsightSection): T[] {
  return items.filter((item) => item.section === section)
}

/** The three sections with their items, empty ones dropped. */
export function briefSections<T extends { section: InsightSection }>(items: readonly T[]): Array<{ section: InsightSection; label: string; items: T[] }> {
  return INSIGHT_SECTIONS.map((section) => ({ section, label: INSIGHT_SECTION_LABELS[section], items: itemsOfSection(items, section) })).filter(
    (group) => group.items.length > 0
  )
}

/**
 * What the card shows: what has to be acted on first, then what management
 * is asked to decide, then the field. A door shows the most urgent thing
 * behind it, not the first thing written.
 */
const TEASER_ORDER: readonly InsightSection[] = ["tindak", "rekomendasi", "lapangan"]

export function teaserInsightItems<T extends { section: InsightSection }>(items: readonly T[], limit = TEASER_ITEMS): T[] {
  const picked: T[] = []
  for (const section of TEASER_ORDER) {
    for (const item of itemsOfSection(items, section)) {
      if (picked.length === limit) return picked
      picked.push(item)
    }
  }
  return picked
}

/** "Senin, 22 Sep 2026" for a YYYY-MM-DD day in WIB. */
export function insightDayLabel(day: string): string {
  return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", weekday: "long", day: "numeric", month: "short", year: "numeric" }).format(
    new Date(`${day}T00:00:00+07:00`)
  )
}

/** "Hari ini", "Kemarin", else the day. For the day list and the brief's heading. */
export function insightDayName(day: string, today: string): string {
  if (day === today) return "Hari ini"
  const yesterday = new Date(`${today}T00:00:00+07:00`)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  if (day === wibDayOf(yesterday)) return "Kemarin"
  return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", weekday: "long", day: "numeric", month: "short" }).format(new Date(`${day}T00:00:00+07:00`))
}

/**
 * The brief as one WhatsApp message: a title with the day, then each
 * section as a short list. WhatsApp's own emphasis marks (single asterisks)
 * are the only formatting a chat understands, and the provenance line
 * travels with the text so a forwarded brief still says who wrote it.
 */
export function briefShareText({
  day,
  items,
  scopeNote,
}: {
  day: string
  items: ReadonlyArray<{ text: string; section: InsightSection }>
  scopeNote?: string | null
}): string {
  const lines: string[] = [`*Brief AI · ${insightDayLabel(day)}*`]
  if (scopeNote) lines.push(scopeNote)
  for (const group of briefSections(items)) {
    lines.push("", `*${group.label}*`)
    for (const item of group.items) lines.push(`• ${item.text}`)
  }
  if (items.length === 0) lines.push("", "Belum ada insight untuk hari ini.")
  lines.push("", "Ditulis AI dari data Sales Activity. AI bisa keliru; angkanya berasal dari data aplikasi.")
  return lines.join("\n")
}
