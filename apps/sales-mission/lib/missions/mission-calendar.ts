import { MISSION_TIME_ZONE, type MissionListItem } from "./mission-schema"

/**
 * Month-grid construction for the calendar view.
 *
 * Pure and timezone-explicit: every day boundary is Werkudara's, never the
 * server's. A mission at 23:30 WIB is already the next day in UTC, so deriving
 * days from raw timestamps would drop it onto the wrong square.
 */

export interface CalendarDay<T = unknown> {
  /** YYYY-MM-DD in mission time. */
  date: string
  dayOfMonth: number
  missionCount: number
  /** The day's missions, earliest first, so a cell can name them rather than only count them. */
  missions: T[]
  isToday: boolean
}

export interface MonthGrid<T = unknown> {
  /** Empty squares before the 1st, so the month starts on the right weekday (Monday-first). */
  leadingBlanks: number
  days: CalendarDay<T>[]
}

const MONTH_PATTERN = /^\d{4}-\d{2}$/

/** The day a timestamp falls on, in mission time. */
export function missionDayKey(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: MISSION_TIME_ZONE }).format(value)
}

/** Current month as YYYY-MM, in mission time. */
export function currentMissionMonth(now: Date): string {
  return missionDayKey(now).slice(0, 7)
}

/** Normalize an untrusted `?month=` value, falling back to the current month. */
export function resolveMonth(raw: string | undefined, now: Date): string {
  if (!raw || !MONTH_PATTERN.test(raw)) return currentMissionMonth(now)
  const monthNumber = Number(raw.slice(5, 7))
  if (monthNumber < 1 || monthNumber > 12) return currentMissionMonth(now)
  return raw
}

/** Adjacent month as YYYY-MM. `step` is -1 or 1. */
export function shiftMonth(month: string, step: number): string {
  const year = Number(month.slice(0, 4))
  const monthIndex = Number(month.slice(5, 7)) - 1
  const shifted = new Date(Date.UTC(year, monthIndex + step, 1))
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`
}

/** Human month label, e.g. "Agustus 2026". */
export function formatMonthLabel(month: string): string {
  const year = Number(month.slice(0, 4))
  const monthIndex = Number(month.slice(5, 7)) - 1
  return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, monthIndex, 1))
  )
}

/**
 * The instants to load for a month: the month in mission time plus a week on
 * either side, so the day panel is right at the edges. Computed from the
 * month string, not from an instant: the first of the month at WIB midnight
 * is still the previous month in UTC, and taking the UTC month from it once
 * cut the window off on the 9th.
 */
export function monthWindow(month: string): { since: Date; until: Date } {
  const year = Number(month.slice(0, 4))
  const monthIndex = Number(month.slice(5, 7)) - 1
  const offsetMs = 7 * 3_600_000 // WIB midnight is 17:00 UTC the day before
  const start = Date.UTC(year, monthIndex, 1) - offsetMs
  const end = Date.UTC(year, monthIndex + 1, 1) - offsetMs
  return { since: new Date(start - 7 * 86_400_000), until: new Date(end + 7 * 86_400_000) }
}

/** Only the schedule matters here, so callers keep whatever else they carry. */
type Schedulable = Pick<MissionListItem, "scheduledStart">

export function buildMonthGrid<T extends Schedulable>(month: string, missions: T[], now: Date): MonthGrid<T> {
  const year = Number(month.slice(0, 4))
  const monthIndex = Number(month.slice(5, 7)) - 1

  // Day 0 of the next month is the last day of this one.
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  // getUTCDay is Sunday-first; the grid is Monday-first.
  const firstWeekday = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay()
  const leadingBlanks = (firstWeekday + 6) % 7

  const byDay = new Map<string, T[]>()
  for (const mission of missions) {
    if (!mission.scheduledStart) continue
    const start = new Date(mission.scheduledStart)
    if (Number.isNaN(start.getTime())) continue
    const key = missionDayKey(start)
    byDay.set(key, [...(byDay.get(key) ?? []), mission])
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => (a.scheduledStart ?? "").localeCompare(b.scheduledStart ?? ""))
  }

  const today = missionDayKey(now)

  const days: CalendarDay<T>[] = Array.from({ length: daysInMonth }, (_, index) => {
    const dayOfMonth = index + 1
    const date = `${month}-${String(dayOfMonth).padStart(2, "0")}`
    const onDay = byDay.get(date) ?? []
    return {
      date,
      dayOfMonth,
      missionCount: onDay.length,
      missions: onDay,
      isToday: date === today,
    }
  })

  return { leadingBlanks, days }
}

/** Missions scheduled on a given mission-time day, earliest first. */
export function missionsOnDay<T extends Schedulable>(missions: T[], day: string): T[] {
  return missions
    .filter((mission) => {
      if (!mission.scheduledStart) return false
      const start = new Date(mission.scheduledStart)
      return !Number.isNaN(start.getTime()) && missionDayKey(start) === day
    })
    .sort((a, b) => (a.scheduledStart ?? "").localeCompare(b.scheduledStart ?? ""))
}
