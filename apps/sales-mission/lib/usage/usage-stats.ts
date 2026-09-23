import { missionDayKey } from "@/lib/missions/mission-calendar"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"
import { shares } from "@/lib/reporting/cube"
import type { ListRow } from "@/lib/reporting/widget-view"
import { usagePageLabel } from "./usage-path"

/**
 * Pengaturan → Pemakaian, as arithmetic over the day rows and page
 * counters. Pure: the page reads rows, these decide what they say.
 *
 * Days are WIB calendar days as YYYY-MM-DD (`missionDayKey`), and every
 * window ends on, and includes, today: "7 hari" is today and the six days
 * before it, the way Microsoft 365's active-users report counts a period.
 */

/** The periods the page offers, for "Pengguna aktif per hari" and "Halaman paling dibuka" alike. */
export const USAGE_PERIODS = [7, 30, 90] as const
export type UsagePeriod = (typeof USAGE_PERIODS)[number]
export const DEFAULT_USAGE_PERIOD: UsagePeriod = 30

/** Weeks in a person's trend line. */
export const TREND_WEEKS = 8
/**
 * Days of day rows the page reads for the people table: the trend's reach.
 * The daily chart needs the period's, so the page reads whichever is longer
 * (`usageDayWindow`).
 */
export const USAGE_DAY_WINDOW = TREND_WEEKS * 7
/** Pages kept on the bar list before the rest fold into "Lainnya". */
export const TOP_PAGES = 12

export function parseUsagePeriod(raw: string | undefined | null): UsagePeriod {
  const value = Number(raw)
  return (USAGE_PERIODS as readonly number[]).includes(value) ? (value as UsagePeriod) : DEFAULT_USAGE_PERIOD
}

/** Days of day rows to read: eight weeks for the people table, or the period when it is longer (90). */
export function usageDayWindow(period: UsagePeriod): number {
  return Math.max(USAGE_DAY_WINDOW, period)
}

const DAY_MS = 86_400_000

/** A calendar day moved by whole days. */
export function shiftDay(day: string, delta: number): string {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + delta)
  return date.toISOString().slice(0, 10)
}

/** The first day of an N-day window that ends on (and includes) `today`. */
export function windowStart(today: string, days: number): string {
  return shiftDay(today, -(days - 1))
}

/** Whole days from `day` to `today`: 0 for today, 1 for yesterday. */
export function daysAgo(day: string, today: string): number {
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / DAY_MS)
}

export interface UsageDayRow {
  userId: string
  day: string
  lastSeenAt: string
  views: number
  lastPath: string | null
}

export interface UsagePageRow {
  day: string
  path: string
  views: number
}

/** A person's most recent day, whenever it was (`usage_last_seen`). */
export interface UsageLastSeen {
  userId: string
  day: string
  lastSeenAt: string
  lastPath: string | null
}

export interface UsagePersonInput {
  id: string
  name: string
  avatarUrl: string | null
}

export interface UsageSummary {
  activeToday: number
  active7: number
  active30: number
  /** Pages opened in the last 30 days, everyone together. */
  views30: number
}

/** People seen today, in 7 days, in 30 days, and the pages opened in 30. */
export function summarizeUsage(rows: UsageDayRow[], today: string): UsageSummary {
  const from7 = windowStart(today, 7)
  const from30 = windowStart(today, 30)
  const today1 = new Set<string>()
  const week = new Set<string>()
  const month = new Set<string>()
  let views30 = 0
  for (const row of rows) {
    if (row.day > today || row.day < from30) continue
    month.add(row.userId)
    views30 += row.views
    if (row.day >= from7) week.add(row.userId)
    if (row.day === today) today1.add(row.userId)
  }
  return { activeToday: today1.size, active7: week.size, active30: month.size, views30 }
}

/**
 * Days active in each of the last `weeks` rolling weeks, oldest first.
 * Rolling seven-day blocks ending today rather than calendar weeks, so the
 * newest point is a whole week and not a Monday's dip.
 */
export function weeklyActiveDays(days: string[], today: string, weeks = TREND_WEEKS): number[] {
  const buckets = Array.from({ length: weeks }, () => new Set<string>())
  for (const day of days) {
    const ago = daysAgo(day, today)
    if (ago < 0 || ago >= weeks * 7) continue
    buckets[weeks - 1 - Math.floor(ago / 7)].add(day)
  }
  return buckets.map((set) => set.size)
}

/** Saturday or Sunday, for a WIB day key. */
export function isWeekendDay(day: string): boolean {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay()
  return weekday === 0 || weekday === 6
}

export interface DailyActive {
  /** WIB day, YYYY-MM-DD. */
  day: string
  /** Distinct people seen that day. */
  active: number
  /** Saturday or Sunday: drawn in the muted ink so the weekly rhythm shows. */
  weekend: boolean
}

/**
 * People active on each WIB day from `fromDay` to `toDay`, both included,
 * oldest first: the "Pengguna aktif per hari" chart. Every day of the range
 * is there and a day nobody came is 0, so a quiet Sunday is a gap between
 * bars rather than a missing bar. People, not rows or opens: a heartbeat
 * row (no page opened) still means the person was here, as in
 * `summarizeUsage`. Rows outside the range are ignored.
 */
export function dailyActiveSeries(rows: UsageDayRow[], fromDay: string, toDay: string): DailyActive[] {
  if (!fromDay || !toDay || fromDay > toDay) return []
  const people = new Map<string, Set<string>>()
  for (const row of rows) {
    if (row.day < fromDay || row.day > toDay) continue
    const seen = people.get(row.day)
    if (seen) seen.add(row.userId)
    else people.set(row.day, new Set([row.userId]))
  }
  const series: DailyActive[] = []
  for (let day = fromDay; day <= toDay; day = shiftDay(day, 1)) {
    series.push({ day, active: people.get(day)?.size ?? 0, weekend: isWeekendDay(day) })
  }
  return series
}

// The board's own day labels (`bucketLabel` in lib/reporting/cube.ts): the
// key is already a WIB calendar day, so it is read at UTC midnight.
const DAY_SHORT = new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", day: "numeric", month: "short" })
const DAY_LONG = new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" })

/** A day under a bar: "22 Sep". */
export function usageDayLabel(day: string): string {
  return DAY_SHORT.format(new Date(`${day}T00:00:00Z`))
}

/** The same day with its weekday, for the tooltip: "Sel 22 Sep" (no comma, a "·" follows it). */
export function usageDayLongLabel(day: string): string {
  return DAY_LONG.formatToParts(new Date(`${day}T00:00:00Z`))
    .filter((part) => part.type !== "literal")
    .map((part) => part.value)
    .join(" ")
}

export type UsageState = "active" | "idle" | "never"

export interface PersonUsage {
  id: string
  name: string
  avatarUrl: string | null
  lastSeenAt: string | null
  lastPath: string | null
  /** Distinct days seen in the last 30. */
  daysActive30: number
  /** Pages opened in the last 7 days. */
  views7: number
  /** Days active per rolling week, oldest first. */
  weekly: number[]
  /** idle: not seen in the last 7 days; never: no row at all. */
  state: UsageState
}

/**
 * One line per person: everyone who can use the app, seen or not, plus
 * anyone the rows name who is no longer on that list, so the table always
 * accounts for the counts above it. Most recently seen first; people never
 * seen last, by name.
 */
export function rollupPeople(
  people: UsagePersonInput[],
  rows: UsageDayRow[],
  lastSeen: UsageLastSeen[],
  today: string
): PersonUsage[] {
  const from7 = windowStart(today, 7)
  const from30 = windowStart(today, 30)
  const byPerson = new Map<string, UsageDayRow[]>()
  for (const row of rows) {
    if (row.day > today) continue
    const list = byPerson.get(row.userId)
    if (list) list.push(row)
    else byPerson.set(row.userId, [row])
  }
  const latest = new Map(lastSeen.map((entry) => [entry.userId, entry]))

  const result = people.map((person): PersonUsage => {
    const own = byPerson.get(person.id) ?? []
    let newest: UsageDayRow | null = null
    let views7 = 0
    const days30 = new Set<string>()
    for (const row of own) {
      if (!newest || row.day > newest.day) newest = row
      if (row.day >= from30) days30.add(row.day)
      if (row.day >= from7) views7 += row.views
    }
    const last = latest.get(person.id)
    const lastDay = last?.day ?? newest?.day ?? null
    const state: UsageState = lastDay === null ? "never" : lastDay < from7 ? "idle" : "active"
    return {
      id: person.id,
      name: person.name,
      avatarUrl: person.avatarUrl,
      lastSeenAt: last?.lastSeenAt ?? newest?.lastSeenAt ?? null,
      lastPath: last ? last.lastPath : (newest?.lastPath ?? null),
      daysActive30: days30.size,
      views7,
      weekly: weeklyActiveDays(own.map((row) => row.day), today),
      state,
    }
  })

  return result.sort((a, b) => {
    if (a.lastSeenAt && b.lastSeenAt) return Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt)
    if (a.lastSeenAt) return -1
    if (b.lastSeenAt) return 1
    return a.name.localeCompare(b.name, "id-ID")
  })
}

/** Ids the rows name that the people list does not (someone since removed). */
export function unlistedUserIds(people: UsagePersonInput[], lastSeen: UsageLastSeen[], rows: UsageDayRow[]): string[] {
  const listed = new Set(people.map((person) => person.id))
  const extra = new Set<string>()
  for (const entry of lastSeen) if (!listed.has(entry.userId)) extra.add(entry.userId)
  for (const row of rows) if (!listed.has(row.userId)) extra.add(row.userId)
  return [...extra]
}

export interface PageUsage {
  rows: ListRow[]
  all: ListRow[]
  total: number
}

const PAGE_COLOR = "var(--chart-1)"
const MUTED = "var(--muted-foreground)"

/**
 * Pages opened in the period as a bar list: the most opened first, shares
 * of the whole total, the top twelve kept and the rest folded into one
 * "Lainnya (N halaman)" row so nothing is silently dropped.
 */
export function rollupPages(rows: UsagePageRow[], from: string, today: string, top = TOP_PAGES): PageUsage {
  const totals = new Map<string, number>()
  for (const row of rows) {
    if (row.day < from || row.day > today || row.views <= 0) continue
    totals.set(row.path, (totals.get(row.path) ?? 0) + row.views)
  }
  const entries = [...totals]
    .map(([path, views]) => ({ path, views, label: usagePageLabel(path) }))
    .sort((a, b) => b.views - a.views || a.label.localeCompare(b.label, "id-ID"))
  const everyShare = shares(entries.map((entry) => entry.views))
  const all: ListRow[] = entries.map((entry, index) => ({
    key: entry.path,
    label: entry.label,
    value: entry.views,
    share: everyShare[index],
    color: PAGE_COLOR,
    param: null,
  }))
  const total = entries.reduce((sum, entry) => sum + entry.views, 0)
  const shown = all.slice(0, top)
  const rest = all.slice(top)
  if (rest.length === 0) return { rows: shown, all, total }
  return {
    rows: [
      ...shown,
      {
        key: "__lainnya",
        label: `Lainnya (${rest.length} halaman)`,
        value: rest.reduce((sum, row) => sum + row.value, 0),
        share: rest.reduce((sum, row) => sum + row.share, 0),
        color: MUTED,
        folded: rest.length,
        param: null,
      },
    ],
    all,
    total,
  }
}

const MINUTE_MS = 60_000

/**
 * "Terakhir aktif" as a person says it: "Baru saja", "12 menit lalu",
 * "2 jam lalu", "Kemarin", "3 hari lalu", then the date. Relative because
 * the question is "how long since", the way Slack and Microsoft Teams show
 * last activity; the exact stamp is `lastSeenStamp`, in the cell's title.
 * Days are WIB days, so 23.50 yesterday is "Kemarin" at 00.10.
 */
export function lastSeenLabel(iso: string, now: Date): string {
  const when = Date.parse(iso)
  if (Number.isNaN(when)) return "—"
  const minutes = Math.max(0, Math.floor((now.getTime() - when) / MINUTE_MS))
  const ago = daysAgo(missionDayKey(new Date(when)), missionDayKey(now))
  if (ago <= 0) {
    if (minutes < 2) return "Baru saja"
    if (minutes < 60) return `${minutes} menit lalu`
    return `${Math.floor(minutes / 60)} jam lalu`
  }
  if (ago === 1) return "Kemarin"
  if (ago < 30) return `${ago} hari lalu`
  return new Intl.DateTimeFormat("id-ID", { timeZone: MISSION_TIME_ZONE, day: "numeric", month: "short", year: "numeric" }).format(new Date(when))
}

/** The exact moment, for the title beside a relative label: "Sel, 23 Sep 2026 09.41 WIB". */
export function lastSeenStamp(iso: string): string {
  const when = Date.parse(iso)
  if (Number.isNaN(when)) return ""
  const text = new Intl.DateTimeFormat("id-ID", {
    timeZone: MISSION_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(when))
  return `${text} WIB`
}
