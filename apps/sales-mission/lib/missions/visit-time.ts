import { MISSION_TIME_ZONE, toMissionTimestamp } from "./mission-schema"

/**
 * The visit's real window, next to its appointment.
 *
 * The form takes a date and two clock times in mission time, the report
 * stores two instants, and the reports compare the first one with the
 * mission's schedule. Pure, so the same arithmetic runs on the form, the
 * server and the KPI screen.
 */

export interface VisitTimeInput {
  actualDate?: string | null
  actualStartTime?: string | null
  actualEndTime?: string | null
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^\d{2}:\d{2}$/

/** Minutes after the appointment that still count as on time. */
export const ON_TIME_GRACE_MINUTES = 15

/** An instant as the mission-time date and clock time the form shows. */
export function splitMissionInstant(iso: string | null | undefined): { date: string; time: string } | null {
  if (!iso) return null
  const value = new Date(iso)
  if (Number.isNaN(value.getTime())) return null
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: MISSION_TIME_ZONE }).format(value)
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: MISSION_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(value)
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00"
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00"
  return { date, time: `${hour}:${minute}` }
}

/** Why the three inputs do not make a window, or null. Empty is fine: the admin decides whether it is required. */
export function visitTimeViolation(input: VisitTimeInput): string | null {
  const date = input.actualDate || null
  const start = input.actualStartTime || null
  const end = input.actualEndTime || null
  if (!date && !start && !end) return null
  if (date && !DATE.test(date)) return "Tanggal kunjungan tidak valid."
  if (start && !TIME.test(start)) return "Jam mulai tidak valid."
  if (end && !TIME.test(end)) return "Jam selesai tidak valid."
  if (!date || !start) return "Lengkapi tanggal dan jam mulai kunjungan."
  if (end && end <= start) return "Jam selesai harus setelah jam mulai."
  return null
}

/** The two instants to store. Null when the inputs are empty or broken. */
export function toVisitInstants(input: VisitTimeInput): { start: string | null; end: string | null } {
  if (visitTimeViolation(input) || !input.actualDate || !input.actualStartTime) return { start: null, end: null }
  return {
    start: toMissionTimestamp(input.actualDate, input.actualStartTime),
    end: input.actualEndTime ? toMissionTimestamp(input.actualDate, input.actualEndTime) : null,
  }
}

/** Minutes the visit began after its appointment; negative when early. Null when either side is missing. */
export function startDelayMinutes(actualStart: string | null | undefined, scheduledStart: string | null | undefined): number | null {
  if (!actualStart || !scheduledStart) return null
  const actual = new Date(actualStart).getTime()
  const planned = new Date(scheduledStart).getTime()
  if (Number.isNaN(actual) || Number.isNaN(planned)) return null
  return Math.round((actual - planned) / 60_000)
}

export function isOnTime(actualStart: string | null | undefined, scheduledStart: string | null | undefined): boolean | null {
  const delay = startDelayMinutes(actualStart, scheduledStart)
  if (delay === null) return null
  return delay <= ON_TIME_GRACE_MINUTES
}

function describeMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} menit`
  if (rest === 0) return `${hours} jam`
  return `${hours} jam ${rest} menit`
}

/**
 * One line comparing the visit with its appointment: on time, late by how
 * much, or early. Null when there is nothing to compare.
 */
export function describeTiming(actualStart: string | null | undefined, scheduledStart: string | null | undefined): { text: string; tone: "success" | "warning" | "neutral" } | null {
  const delay = startDelayMinutes(actualStart, scheduledStart)
  if (delay === null) return null
  if (Math.abs(delay) <= ON_TIME_GRACE_MINUTES) return { text: "Sesuai jadwal", tone: "success" }
  if (delay > 0) return { text: `Mulai ${describeMinutes(delay)} setelah jadwal`, tone: "warning" }
  return { text: `Mulai ${describeMinutes(-delay)} sebelum jadwal`, tone: "neutral" }
}

/** "Rab, 17 Sep · 17.05–18.10", or without the end when there is none. */
export function formatVisitWindow(actualStart: string | null | undefined, actualEnd: string | null | undefined): string {
  if (!actualStart) return "—"
  const start = new Date(actualStart)
  const day = new Intl.DateTimeFormat("id-ID", { timeZone: MISSION_TIME_ZONE, weekday: "short", day: "numeric", month: "short" }).format(start)
  const clock = (value: Date) => new Intl.DateTimeFormat("id-ID", { timeZone: MISSION_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(value)
  const text = `${day} · ${clock(start)}`
  return actualEnd ? `${text}–${clock(new Date(actualEnd))}` : text
}

/** Minutes between start and end, or null. */
export function visitDurationMinutes(actualStart: string | null | undefined, actualEnd: string | null | undefined): number | null {
  if (!actualStart || !actualEnd) return null
  const minutes = Math.round((new Date(actualEnd).getTime() - new Date(actualStart).getTime()) / 60_000)
  return Number.isNaN(minutes) || minutes <= 0 ? null : minutes
}
