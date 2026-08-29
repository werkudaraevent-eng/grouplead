import { MISSION_TIME_ZONE, type MissionListItem } from "./mission-schema"

/**
 * Month-grid construction for the calendar view.
 *
 * Pure and timezone-explicit: every day boundary is Werkudara's, never the
 * server's. A mission at 23:30 WIB is already the next day in UTC, so deriving
 * days from raw timestamps would drop it onto the wrong square.
 */

export interface CalendarDay {
  /** YYYY-MM-DD in mission time. */
  date: string
  dayOfMonth: number
  missionCount: number
  isToday: boolean
}

export interface MonthGrid {
  /** Empty squares before the 1st, so the month starts on the right weekday (Monday-first). */
  leadingBlanks: number
  days: CalendarDay[]
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

/** Only the schedule matters here, so callers keep whatever else they carry. */
type Schedulable = Pick<MissionListItem, "scheduledStart">

export function buildMonthGrid(month: string, missions: Schedulable[], now: Date): MonthGrid {
  const year = Number(month.slice(0, 4))
  const monthIndex = Number(month.slice(5, 7)) - 1

  // Day 0 of the next month is the last day of this one.
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  // getUTCDay is Sunday-first; the grid is Monday-first.
  const firstWeekday = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay()
  const leadingBlanks = (firstWeekday + 6) % 7

  const countsByDay = new Map<string, number>()
  for (const mission of missions) {
    if (!mission.scheduledStart) continue
    const start = new Date(mission.scheduledStart)
    if (Number.isNaN(start.getTime())) continue
    const key = missionDayKey(start)
    countsByDay.set(key, (countsByDay.get(key) ?? 0) + 1)
  }

  const today = missionDayKey(now)

  const days: CalendarDay[] = Array.from({ length: daysInMonth }, (_, index) => {
    const dayOfMonth = index + 1
    const date = `${month}-${String(dayOfMonth).padStart(2, "0")}`
    return {
      date,
      dayOfMonth,
      missionCount: countsByDay.get(date) ?? 0,
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
