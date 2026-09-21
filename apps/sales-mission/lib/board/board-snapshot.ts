import { missionDayKey } from "@/lib/missions/mission-calendar"
import { MISSION_TIME_ZONE, type MissionListItem, type MissionStatus } from "@/lib/missions/mission-schema"
import type { BoardRange } from "./board-options"

/**
 * What the live board shows, and what it hides.
 *
 * Two audiences, one computation. The dashboard in the app is for people who
 * already have access to the pipeline. The TV board hangs in an open office
 * where visitors, candidates and vendors walk past, and a photograph of it
 * travels further than anyone intends — so client identity is removed there
 * unless the admin who made the screen link chose otherwise.
 *
 * People are never masked. Seeing who is out in the field is the point of the
 * board; it is what makes it motivating rather than merely informative.
 */

export interface BoardMission {
  id: string
  /** Already masked when the board is public. */
  clientLabel: string
  location: string | null
  missionType: string
  status: MissionStatus
  /** Wall-clock start, "09.30", or null when unscheduled. */
  time: string | null
  /** Day key and minutes past midnight, mission time, for timelines. */
  day: string
  startMinute: number
  endMinute: number
  primarySalesName: string | null
  supportingSalesNames: string[]
}

export interface BoardDay {
  /** YYYY-MM-DD in mission time. */
  date: string
  /** "Sen 16 Sep" */
  label: string
  isToday: boolean
  missions: BoardMission[]
}

/** A person's next visit at or after `now`, in parts so a wall can size them differently. */
export interface BoardTeamNext {
  /** The day label ("Kam 17 Sep") on a week board when it is not today; null for today. */
  day: string | null
  time: string
  client: string
  isToday: boolean
}

/** The visit a person is in at `now`: started, not over, not yet marked done. */
export interface BoardTeamNow {
  time: string
  client: string
  location: string | null
}

export interface BoardTeamMember {
  name: string
  missionCount: number
  /** Where the person is right now, or null when between visits. */
  now: BoardTeamNow | null
  /** The member's next visit at or after `now`, or null once their day (or week) is done. */
  next: BoardTeamNext | null
}

/** One line for the next visit: "Kam 17 Sep 10.30 · PT A•••" or "10.30 · PT A•••". */
export function formatTeamNext(next: BoardTeamNext | null): string | null {
  if (!next) return null
  return `${next.day ? `${next.day} ` : ""}${next.time} · ${next.client}`
}

export interface BoardSnapshot {
  today: string
  range: BoardRange
  /** First and last day shown, inclusive. */
  from: string
  to: string
  counts: {
    /** Missions in the range (named todayTotal for the day board it started as). */
    todayTotal: number
    accepted: number
    completed: number
    /** Open missions across all days, not just the range. */
    openMissions: number
  }
  /** Every mission in the range, earliest first. */
  missions: BoardMission[]
  /** The same missions grouped by day, one entry per day in the range. */
  days: BoardDay[]
  team: BoardTeamMember[]
}

export interface BoardSnapshotOptions {
  masked: boolean
  range?: BoardRange
  /** User ids; empty means everyone. */
  sales?: string[]
  /** Location strings; empty means everywhere. */
  location?: string[]
}

/**
 * Hide a client's identity while leaving the entry recognisable to whoever
 * booked it.
 *
 * A legal prefix on its own identifies nobody, so it is kept for shape; the
 * distinguishing part is reduced to one letter. "PT Arunika Kreasi" reads as
 * "PT A•••", which tells a passer-by nothing and still lets the rep who
 * scheduled it spot their own row.
 */
const LEGAL_PREFIXES = new Set(["pt", "cv", "ud", "pt.", "cv.", "the"])

export function maskClientName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "•••"

  const first = words[0]
  if (LEGAL_PREFIXES.has(first.toLowerCase()) && words.length > 1) {
    return `${first} ${words[1][0].toUpperCase()}•••`
  }

  return `${first[0].toUpperCase()}•••`
}

/** Wall-clock time in mission timezone, or null for an unscheduled mission. */
function formatTime(iso: string | null): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: MISSION_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function minuteOfDay(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: MISSION_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date)
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0) % 24
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0)
  return hour * 60 + minute
}

function shiftDay(day: string, days: number): string {
  const base = new Date(`${day}T00:00:00+07:00`)
  return missionDayKey(new Date(base.getTime() + days * 86_400_000))
}

function dayLabel(day: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: MISSION_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${day}T00:00:00+07:00`))
}

/** Inclusive day bounds for the range: today, or the Monday-first week around it. */
export function boardRangeBounds(range: BoardRange, today: string): [string, string] {
  if (range === "today") return [today, today]
  // Weekday of the calendar date itself. Reading getUTCDay off the WIB
  // midnight instant lands on the previous UTC day and shifts the week.
  const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7
  const monday = shiftDay(today, -weekday)
  return [monday, shiftDay(monday, 6)]
}

const OPEN_STATUSES: MissionStatus[] = ["SCHEDULED", "ASSIGNED", "ACCEPTED", "IN_PROGRESS"]
/**
 * A visit that was called off is not on the board.
 *
 * The same rule the calendar already applies: a schedule shows what will
 * happen, and the Aktivitas list with its Status filter is where a
 * cancellation is reviewed. It matters more here than on a calendar, because
 * the board does not only draw these rows — it counts them. A cancelled visit
 * left in put a person in "orang di lapangan" who was sitting at their desk,
 * so the wall stated something untrue about the room reading it.
 */
const OFF_THE_BOARD: MissionStatus[] = ["CANCELLED", "REJECTED"]
const ASSUMED_MINUTES = 60

/**
 * Build the board from the tenant's missions.
 *
 * `now` is injected rather than read from the clock so the same input always
 * produces the same board — the tests can assert on "today" without racing it.
 */
export function buildBoardSnapshot(
  missions: MissionListItem[],
  now: Date,
  options: BoardSnapshotOptions
): BoardSnapshot {
  const today = missionDayKey(now)
  const range = options.range ?? "today"
  const [from, to] = boardRangeBounds(range, today)
  const sales = new Set(options.sales ?? [])
  const location = new Set((options.location ?? []).map((item) => item.trim().toLowerCase()))

  const scoped = missions.filter((mission) => {
    if (OFF_THE_BOARD.includes(mission.status)) return false
    if (sales.size && !mission.assigneeIds.some((id) => sales.has(id))) return false
    if (location.size && !location.has((mission.location ?? "").trim().toLowerCase())) return false
    return true
  })

  const inRange = scoped.filter((mission) => {
    if (!mission.scheduledStart) return false
    const start = new Date(mission.scheduledStart)
    if (Number.isNaN(start.getTime())) return false
    const day = missionDayKey(start)
    return day >= from && day <= to
  })

  const ordered = [...inRange].sort((a, b) => (a.scheduledStart ?? "").localeCompare(b.scheduledStart ?? ""))

  const boardMissions: BoardMission[] = ordered.map((mission) => {
    const start = new Date(mission.scheduledStart as string)
    const startMinute = minuteOfDay(start)
    let endMinute = startMinute + ASSUMED_MINUTES
    if (mission.scheduledEnd) {
      const end = new Date(mission.scheduledEnd)
      if (!Number.isNaN(end.getTime()) && end.getTime() > start.getTime()) {
        endMinute = missionDayKey(end) === missionDayKey(start) ? minuteOfDay(end) : 24 * 60
      }
    }
    return {
      id: mission.id,
      clientLabel: options.masked ? maskClientName(mission.clientCompanyName) : mission.clientCompanyName,
      location: mission.location,
      missionType: mission.missionType,
      status: mission.status,
      time: formatTime(mission.scheduledStart),
      day: missionDayKey(start),
      startMinute,
      endMinute,
      primarySalesName: mission.primarySalesName,
      supportingSalesNames: mission.supportingSalesNames,
    }
  })

  const days: BoardDay[] = []
  for (let day = from; day <= to; day = shiftDay(day, 1)) {
    days.push({
      date: day,
      label: dayLabel(day),
      isToday: day === today,
      missions: boardMissions.filter((mission) => mission.day === day),
    })
    if (days.length > 7) break
  }

  // Who is out, and where. Counts every role: a supporting sales is out of
  // the office just as much as the primary. "Now" is the visit a person is
  // in at this minute; "next" is their first visit that has not started yet.
  // The order answers the office's question in that order: who is with a
  // client right now, then who is about to be, then who is done.
  const nowMinute = minuteOfDay(now)
  const counts = new Map<string, number>()
  const current = new Map<string, BoardTeamNow>()
  const next = new Map<string, BoardTeamNext>()
  for (const mission of boardMissions) {
    const people = [mission.primarySalesName, ...mission.supportingSalesNames].filter(
      (name): name is string => Boolean(name)
    )
    const upcoming = mission.day > today || (mission.day === today && mission.startMinute >= nowMinute)
    const ongoing = mission.day === today && mission.startMinute <= nowMinute && nowMinute < mission.endMinute && mission.status !== "COMPLETED"
    for (const name of new Set(people)) {
      counts.set(name, (counts.get(name) ?? 0) + 1)
      if (ongoing && !current.has(name) && mission.time) {
        current.set(name, { time: mission.time, client: mission.clientLabel, location: mission.location })
      }
      if (upcoming && !next.has(name) && mission.time) {
        next.set(name, {
          day: range === "week" && mission.day !== today ? dayLabel(mission.day) : null,
          time: mission.time,
          client: mission.clientLabel,
          isToday: mission.day === today,
        })
      }
    }
  }

  const rank = (member: BoardTeamMember) => (member.now ? 0 : member.next ? 1 : 2)
  const team: BoardTeamMember[] = [...counts.entries()]
    .map(([name, missionCount]) => ({ name, missionCount, now: current.get(name) ?? null, next: next.get(name) ?? null }))
    .sort((a, b) => {
      const byState = rank(a) - rank(b)
      if (byState !== 0) return byState
      if (a.now && b.now) return a.now.time.localeCompare(b.now.time) || a.name.localeCompare(b.name)
      if (a.next && b.next) {
        const today = Number(b.next.isToday) - Number(a.next.isToday)
        return today || a.next.time.localeCompare(b.next.time) || a.name.localeCompare(b.name)
      }
      return b.missionCount - a.missionCount || a.name.localeCompare(b.name)
    })

  return {
    today,
    range,
    from,
    to,
    counts: {
      todayTotal: ordered.length,
      accepted: ordered.filter((mission) => mission.status === "ACCEPTED").length,
      completed: ordered.filter((mission) => mission.status === "COMPLETED").length,
      openMissions: scoped.filter((mission) => OPEN_STATUSES.includes(mission.status)).length,
    },
    missions: boardMissions,
    days,
    team,
  }
}
