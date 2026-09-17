import { MISSION_TIME_ZONE } from "./mission-schema"
import { missionDayKey } from "./mission-calendar"

/**
 * When a visit's report may be started.
 *
 * A report written on the 17th about a visit scheduled for the 21st is a
 * contradiction the data cannot tell apart from a real one: the mission
 * would read Selesai and the KPI would count it. So, when the tenant keeps
 * the rule on, the form opens at the start of the scheduled day in mission
 * time (not the appointment hour: a morning visit brought forward should
 * not have to wait for the clock), and the visit's actual time may not lie
 * in the future. A visit moved to an earlier day is handled by moving the
 * schedule first, which tells the team, rather than by a report that
 * quietly outruns the calendar.
 */

/** The instant the report opens: 00.00 of the scheduled day, mission time. Null when unscheduled. */
export function reportOpensAt(scheduledStart: string | null | undefined): Date | null {
  if (!scheduledStart) return null
  const start = new Date(scheduledStart)
  if (Number.isNaN(start.getTime())) return null
  return new Date(`${missionDayKey(start)}T00:00:00+07:00`)
}

/** Why the report cannot be started yet, or null when it can. */
export function reportLocked(scheduledStart: string | null | undefined, now: Date): { until: Date } | null {
  const opens = reportOpensAt(scheduledStart)
  if (!opens || now.getTime() >= opens.getTime()) return null
  return { until: opens }
}

/** "Laporan bisa diisi mulai Sen, 21 Sep". */
export function describeReportOpens(until: Date): string {
  const day = new Intl.DateTimeFormat("id-ID", { timeZone: MISSION_TIME_ZONE, weekday: "short", day: "numeric", month: "short" }).format(until)
  return `Laporan bisa diisi mulai ${day}`
}
