import { usagePageLabel } from "./usage-path"

/**
 * Settings → Usage, as arithmetic over the day rows and page counters.
 * Pure: the page reads rows, these decide what they say. The same rules as
 * Sales Activity's Pemakaian, in LeadEngine's words.
 *
 * Days are WIB calendar days as YYYY-MM-DD (`usageDayKey`), and every
 * window ends on, and includes, today: "7 days" is today and the six days
 * before it, the way Microsoft 365's active-users report counts a period.
 */

/** The periods the page offers, for "Daily active users" and "Most opened pages" alike. */
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
/** Pages kept on the bar list before the rest fold into "Other". */
export const TOP_PAGES = 12

/** The zone the day rows are counted in. */
export const USAGE_TIME_ZONE = "Asia/Jakarta"
/** WIB is UTC+7 all year (no daylight saving), so a fixed offset is exact. */
const WIB_OFFSET_MS = 7 * 3_600_000

const DAY_MS = 86_400_000
const MINUTE_MS = 60_000

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

/** A moment as its WIB wall clock, read with the UTC getters. */
function wib(ms: number): Date {
  return new Date(ms + WIB_OFFSET_MS)
}

/** The WIB calendar day of a moment, YYYY-MM-DD: the day a usage row belongs to. */
export function usageDayKey(moment: Date): string {
  return wib(moment.getTime()).toISOString().slice(0, 10)
}

export function parseUsagePeriod(raw: string | undefined | null): UsagePeriod {
  const value = Number(raw)
  return (USAGE_PERIODS as readonly number[]).includes(value) ? (value as UsagePeriod) : DEFAULT_USAGE_PERIOD
}

/** Days of day rows to read: eight weeks for the people table, or the period when it is longer (90). */
export function usageDayWindow(period: UsagePeriod): number {
  return Math.max(USAGE_DAY_WINDOW, period)
}

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

/**
 * Whether a role may read usage: the same test as `public.fn_user_is_admin()`
 * (`lower(replace(role, ' ', '_'))` is super_admin or admin), which is what
 * row security asks before it returns a single row. The page asks it first
 * so anyone else with Settings access reads a sentence, not a table of
 * people who seem never to have come.
 */
export function isUsageAdmin(role: string | null | undefined): boolean {
  const normalized = (role ?? "").replace(/ /g, "_").toLowerCase()
  return normalized === "super_admin" || normalized === "admin"
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
 * oldest first: the "Daily active users" chart. Every day of the range is
 * there and a day nobody came is 0, so a quiet Sunday is a gap between
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

/**
 * Room the daily chart's Y axis and margins take from its measured width,
 * on the generous side: the plot is at least this much narrower, so a slot
 * computed from it is never wider than the real one.
 */
export const USAGE_CHART_AXIS_ROOM = 44

/**
 * The width of one day's bar in a chart `width` pixels wide holding `days`
 * bars: ideally 72% of the day's slot, capped at 28px so seven days on a
 * desk are bars and not blocks; at least 4px where the slot has room for
 * that, but never more than 90% of the slot, so ninety days on a phone are
 * thin bars side by side rather than bars laid over their neighbours; and
 * never under 1px.
 */
export function usageBarSize(width: number, days: number): number {
  const slot = Math.max(0, width - USAGE_CHART_AXIS_ROOM) / Math.max(1, days)
  const least = Math.max(1, Math.min(4, Math.floor(slot * 0.9)))
  return Math.max(least, Math.min(28, Math.floor(slot * 0.72)))
}

/**
 * A day under a bar: "22 Sep". Written out rather than left to
 * `Intl.DateTimeFormat`, whose English short month is "Sept" in some
 * runtimes and "Sep" in others; the key is already a WIB day, so it is
 * read at UTC midnight.
 */
export function usageDayLabel(day: string): string {
  const date = new Date(`${day}T00:00:00Z`)
  return `${date.getUTCDate()} ${MONTHS_SHORT[date.getUTCMonth()]}`
}

/** The same day with its weekday, for the tooltip: "Tue 22 Sep" (no comma, a "·" follows it). */
export function usageDayLongLabel(day: string): string {
  const date = new Date(`${day}T00:00:00Z`)
  return `${WEEKDAYS_SHORT[date.getUTCDay()]} ${usageDayLabel(day)}`
}

/** The first recorded day for the footnote: "23 September 2026". */
export function usageSinceLabel(day: string): string {
  const date = new Date(`${day}T00:00:00Z`)
  return `${date.getUTCDate()} ${MONTHS_LONG[date.getUTCMonth()]} ${date.getUTCFullYear()}`
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
    return a.name.localeCompare(b.name, "en")
  })
}

/** Ids the rows name that the people list does not (someone since deactivated or removed). */
export function unlistedUserIds(people: UsagePersonInput[], lastSeen: UsageLastSeen[], rows: UsageDayRow[]): string[] {
  const listed = new Set(people.map((person) => person.id))
  const extra = new Set<string>()
  for (const entry of lastSeen) if (!listed.has(entry.userId)) extra.add(entry.userId)
  for (const row of rows) if (!listed.has(row.userId)) extra.add(row.userId)
  return [...extra]
}

/**
 * Whole percentages that add up to exactly 100 (largest remainder), so a
 * bar list never reads 99% or 101% in total. All zeros for no total.
 */
export function shares(values: number[]): number[] {
  const total = values.reduce((sum, value) => sum + value, 0)
  if (total <= 0) return values.map(() => 0)
  const raw = values.map((value) => (value / total) * 100)
  const floors = raw.map((value) => Math.floor(value))
  let remaining = 100 - floors.reduce((sum, value) => sum + value, 0)
  const order = raw
    .map((value, index) => ({ index, fraction: value - floors[index] }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
  for (const { index } of order) {
    if (remaining <= 0) break
    floors[index] += 1
    remaining -= 1
  }
  return floors
}

/** One row of the pages bar list. */
export interface PageBar {
  key: string
  label: string
  value: number
  /** Share of the whole total, not of the rows shown. */
  share: number
  /** On the "Other" row: how many pages it folds. */
  folded?: number
}

export interface PageUsage {
  rows: PageBar[]
  all: PageBar[]
  total: number
}

/**
 * Pages opened in the period as a bar list: the most opened first, shares
 * of the whole total, the top twelve kept and the rest folded into one
 * "Other (N pages)" row so nothing is silently dropped.
 */
export function rollupPages(rows: UsagePageRow[], from: string, today: string, top = TOP_PAGES): PageUsage {
  const totals = new Map<string, number>()
  for (const row of rows) {
    if (row.day < from || row.day > today || row.views <= 0) continue
    totals.set(row.path, (totals.get(row.path) ?? 0) + row.views)
  }
  const entries = [...totals]
    .map(([path, views]) => ({ path, views, label: usagePageLabel(path) }))
    .sort((a, b) => b.views - a.views || a.label.localeCompare(b.label, "en"))
  const everyShare = shares(entries.map((entry) => entry.views))
  const all: PageBar[] = entries.map((entry, index) => ({
    key: entry.path,
    label: entry.label,
    value: entry.views,
    share: everyShare[index],
  }))
  const total = entries.reduce((sum, entry) => sum + entry.views, 0)
  const shown = all.slice(0, top)
  const rest = all.slice(top)
  if (rest.length === 0) return { rows: shown, all, total }
  return {
    rows: [
      ...shown,
      {
        key: "__other",
        label: `Other (${rest.length} ${rest.length === 1 ? "page" : "pages"})`,
        value: rest.reduce((sum, row) => sum + row.value, 0),
        share: rest.reduce((sum, row) => sum + row.share, 0),
        folded: rest.length,
      },
    ],
    all,
    total,
  }
}

/**
 * "Last active" as a person says it: "Just now", "12 minutes ago",
 * "2 hours ago", "Yesterday", "3 days ago", then the date. Relative because
 * the question is "how long since", the way Slack and Microsoft Teams show
 * last activity; the exact stamp is `lastSeenStamp`, in the cell's title.
 * Days are WIB days, so 23:50 yesterday is "Yesterday" at 00:10.
 */
export function lastSeenLabel(iso: string, now: Date): string {
  const when = Date.parse(iso)
  if (Number.isNaN(when)) return "—"
  const minutes = Math.max(0, Math.floor((now.getTime() - when) / MINUTE_MS))
  const ago = daysAgo(usageDayKey(new Date(when)), usageDayKey(now))
  if (ago <= 0) {
    if (minutes < 2) return "Just now"
    if (minutes < 60) return `${minutes} minutes ago`
    const hours = Math.floor(minutes / 60)
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`
  }
  if (ago === 1) return "Yesterday"
  if (ago < 30) return `${ago} days ago`
  const date = wib(when)
  return `${date.getUTCDate()} ${MONTHS_SHORT[date.getUTCMonth()]} ${date.getUTCFullYear()}`
}

/** The exact moment, for the title beside a relative label: "Wed 23 Sep 2026, 09:41 WIB". */
export function lastSeenStamp(iso: string): string {
  const when = Date.parse(iso)
  if (Number.isNaN(when)) return ""
  const date = wib(when)
  const time = `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`
  return `${WEEKDAYS_SHORT[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS_SHORT[date.getUTCMonth()]} ${date.getUTCFullYear()}, ${time} WIB`
}
