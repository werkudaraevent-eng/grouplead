import { dateRangeFor } from "@/lib/missions/mission-filter"
import { parseCalendarSales } from "@/lib/missions/calendar-filter"
import { missionDayKey } from "@/lib/missions/mission-calendar"

/**
 * What Ringkasan is looking at: a period and whose visits. Both live in
 * the URL and are remembered per person (see lib/view-cookies.ts); the
 * daily card's `day` is also in the URL but is a place, not a view, and
 * is never remembered.
 */

export const RINGKASAN_PRESETS = ["today", "week", "month", "custom"] as const
export type RingkasanPreset = (typeof RINGKASAN_PRESETS)[number]
export const RINGKASAN_PRESET_LABELS: Record<RingkasanPreset, string> = {
  today: "Hari ini",
  week: "Minggu ini",
  month: "Bulan ini",
  custom: "Rentang",
}

export interface RingkasanQuery {
  date: RingkasanPreset
  /** YYYY-MM-DD, mission time; only read when `date` is "custom". */
  from: string | null
  to: string | null
  /** User ids and "me". */
  sales: string[]
  /** The daily card's day, or null for the range's last day. */
  day: string | null
}

const DAY = /^\d{4}-\d{2}-\d{2}$/
type Params = Record<string, string | string[] | undefined>

const one = (params: Params, key: string): string => {
  const value = params[key]
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? ""
}

export function parseRingkasanQuery(params: Params): RingkasanQuery {
  const from = one(params, "from")
  const to = one(params, "to")
  const rawDate = one(params, "date")
  const hasBounds = DAY.test(from) || DAY.test(to)
  const date: RingkasanPreset = (RINGKASAN_PRESETS as readonly string[]).includes(rawDate)
    ? (rawDate as RingkasanPreset)
    : hasBounds
      ? "custom"
      : "month"
  const day = one(params, "day")
  return {
    date,
    from: date === "custom" && DAY.test(from) ? from : null,
    to: date === "custom" && DAY.test(to) ? to : null,
    sales: parseCalendarSales(params.sales),
    day: DAY.test(day) ? day : null,
  }
}

/** The default (this month, everyone) writes nothing, so a plain link stays plain. `day` is written last. */
export function serializeRingkasanQuery(query: RingkasanQuery): URLSearchParams {
  const params = new URLSearchParams()
  if (query.date !== "month") params.set("date", query.date)
  if (query.date === "custom") {
    if (query.from) params.set("from", query.from)
    if (query.to) params.set("to", query.to)
  }
  if (query.sales.length) params.set("sales", query.sales.join(","))
  if (query.day) params.set("day", query.day)
  return params
}

/** Always a closed range. A custom range missing an edge, or upside down, falls back to this month. */
export function resolveRingkasanRange(query: RingkasanQuery, now: Date): { from: string; to: string } {
  const range = dateRangeFor({ date: query.date, from: query.from, to: query.to }, now)
  if (range && range[0] && range[1] && range[0] <= range[1]) return { from: range[0], to: range[1] }
  const month = dateRangeFor({ date: "month", from: null, to: null }, now) as [string, string]
  return { from: month[0], to: month[1] }
}

/** The day the daily card shows: `?day` when inside the range, else the last day of the range that is not after today. */
export function resolveReportDay(query: RingkasanQuery, range: { from: string; to: string }, now: Date): string {
  if (query.day && query.day >= range.from && query.day <= range.to) return query.day
  const today = missionDayKey(now)
  if (today < range.from) return range.from
  return today < range.to ? today : range.to
}
