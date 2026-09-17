import type { MissionListItem, MissionStatus } from "@/lib/missions/mission-schema"

/**
 * iCalendar (RFC 5545) writer, by hand.
 *
 * The feed needs a dozen properties, all of them simple, and a library
 * would be the largest dependency in the app for the sake of escaping
 * commas. What matters is done carefully: CRLF line ends, lines folded at
 * 75 octets (not characters), text escaped, times in UTC so no calendar
 * has to know Jakarta, and a UID and SEQUENCE that let a calendar update
 * an event in place rather than duplicate it.
 */

export type EventStatus = "TENTATIVE" | "CONFIRMED" | "CANCELLED"

export interface CalendarEvent {
  uid: string
  start: Date
  end: Date
  summary: string
  description?: string
  location?: string
  url?: string
  status: EventStatus
  lastModified?: Date
  /** Must not decrease for a given UID; the update counter calendars honour. */
  sequence?: number
}

const CRLF = "\r\n"
const PRODID = "-//Werkudara//Sales Activity//ID"

/** Text values: backslash, semicolon, comma and newline are escaped; CR dropped. */
export function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r/g, "").replace(/\n/g, "\\n")
}

/** A UTC timestamp in basic format: 20260917T023000Z. */
export function toUtcStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")
}

/**
 * Fold one content line at 75 octets, continuation lines starting with a
 * space (RFC 5545 §3.1). Measured in bytes, and never split inside a
 * multi-byte character, which a character count would do for "é" or "—".
 */
export function foldLine(line: string): string[] {
  const out: string[] = []
  let current = ""
  let currentBytes = 0
  let limit = 75
  for (const char of line) {
    const bytes = Buffer.byteLength(char, "utf8")
    if (currentBytes + bytes > limit) {
      out.push(current)
      current = " "
      currentBytes = 1
      limit = 75
    }
    current += char
    currentBytes += bytes
  }
  out.push(current)
  return out
}

function property(name: string, value: string | undefined): string[] {
  if (value === undefined || value === "") return []
  return foldLine(`${name}:${value}`)
}

export function buildEvent(event: CalendarEvent, now: Date): string[] {
  return [
    "BEGIN:VEVENT",
    ...property("UID", event.uid),
    ...property("DTSTAMP", toUtcStamp(now)),
    ...property("DTSTART", toUtcStamp(event.start)),
    ...property("DTEND", toUtcStamp(event.end)),
    ...property("SUMMARY", escapeText(event.summary)),
    ...property("DESCRIPTION", event.description ? escapeText(event.description) : undefined),
    ...property("LOCATION", event.location ? escapeText(event.location) : undefined),
    ...property("URL", event.url),
    ...property("STATUS", event.status),
    ...property("LAST-MODIFIED", event.lastModified ? toUtcStamp(event.lastModified) : undefined),
    ...property("SEQUENCE", event.sequence !== undefined ? String(event.sequence) : undefined),
    "END:VEVENT",
  ]
}

export function buildCalendar({
  name,
  events,
  now,
  timeZone = "Asia/Jakarta",
  refreshHours = 1,
}: {
  name: string
  events: CalendarEvent[]
  now: Date
  timeZone?: string
  refreshHours?: number
}): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    ...property("PRODID", PRODID),
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...property("X-WR-CALNAME", escapeText(name)),
    ...property("X-WR-TIMEZONE", timeZone),
    ...property("REFRESH-INTERVAL;VALUE=DURATION", `PT${refreshHours}H`),
    ...property("X-PUBLISHED-TTL", `PT${refreshHours}H`),
    ...events.flatMap((event) => buildEvent(event, now)),
    "END:VCALENDAR",
  ]
  return lines.join(CRLF) + CRLF
}

/** How a visit's status reads to a calendar: cancelled stays, so the subscriber sees the removal. */
export function eventStatusFor(status: MissionStatus): EventStatus {
  if (status === "CANCELLED" || status === "REJECTED") return "CANCELLED"
  if (status === "ACCEPTED" || status === "IN_PROGRESS" || status === "COMPLETED") return "CONFIRMED"
  return "TENTATIVE"
}

const HOUR = 60 * 60 * 1000

/**
 * A visit as a calendar event, or null when it has no start yet.
 * The end defaults to an hour, the same convention as the team calendar.
 */
export function eventFromMission(mission: MissionListItem, options: { url: string; host: string; team?: boolean }): CalendarEvent | null {
  if (!mission.scheduledStart) return null
  const start = new Date(mission.scheduledStart)
  const end = mission.scheduledEnd ? new Date(mission.scheduledEnd) : new Date(start.getTime() + HOUR)
  const team = [
    mission.primarySalesName ? `Sales utama: ${mission.primarySalesName}` : null,
    mission.supportingSalesNames.length ? `Pendukung: ${mission.supportingSalesNames.join(", ")}` : null,
  ].filter(Boolean)
  const description = [mission.objective, team.join(" · ") || null, options.url].filter(Boolean).join("\n\n")
  const location = [mission.address, mission.appointment.building, mission.location].filter(Boolean).join(", ")
  const modified = mission.updatedAt ? new Date(mission.updatedAt) : undefined
  return {
    uid: `${mission.id}@${options.host}`,
    start,
    end: end > start ? end : new Date(start.getTime() + HOUR),
    // On the team's calendar the person comes first: that is what a manager scans for.
    summary: options.team ? `${mission.primarySalesName ?? "Belum ditugaskan"} · ${mission.clientCompanyName}` : `${mission.clientCompanyName} · ${mission.missionType}`,
    description,
    location: location || undefined,
    url: options.url,
    status: eventStatusFor(mission.status),
    lastModified: modified,
    sequence: modified ? Math.floor(modified.getTime() / 1000) : undefined,
  }
}
