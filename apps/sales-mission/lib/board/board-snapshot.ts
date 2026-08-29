import { missionDayKey } from "@/lib/missions/mission-calendar"
import { MISSION_TIME_ZONE, type MissionListItem, type MissionStatus } from "@/lib/missions/mission-schema"

/**
 * What the live board shows, and what it hides.
 *
 * Two audiences, one computation. The internal board is for people who already
 * have access to the pipeline. The TV board hangs in an open office where
 * visitors, candidates and vendors walk past, and a photograph of it travels
 * further than anyone intends — so client identity is removed there.
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
  time: string | null
  primarySalesName: string | null
  supportingSalesNames: string[]
}

export interface BoardTeamMember {
  name: string
  missionCount: number
}

export interface BoardSnapshot {
  today: string
  counts: {
    todayTotal: number
    accepted: number
    completed: number
    openMissions: number
  }
  missions: BoardMission[]
  team: BoardTeamMember[]
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

const OPEN_STATUSES: MissionStatus[] = ["SCHEDULED", "ASSIGNED", "ACCEPTED", "IN_PROGRESS"]

/**
 * Build the board from the tenant's missions.
 *
 * `now` is injected rather than read from the clock so the same input always
 * produces the same board — the tests can assert on "today" without racing it.
 */
export function buildBoardSnapshot(
  missions: MissionListItem[],
  now: Date,
  options: { masked: boolean }
): BoardSnapshot {
  const today = missionDayKey(now)

  const todays = missions.filter((mission) => {
    if (!mission.scheduledStart) return false
    const start = new Date(mission.scheduledStart)
    return !Number.isNaN(start.getTime()) && missionDayKey(start) === today
  })

  const ordered = [...todays].sort((a, b) =>
    (a.scheduledStart ?? "").localeCompare(b.scheduledStart ?? "")
  )

  const boardMissions: BoardMission[] = ordered.map((mission) => ({
    id: mission.id,
    clientLabel: options.masked ? maskClientName(mission.clientCompanyName) : mission.clientCompanyName,
    location: mission.location,
    missionType: mission.missionType,
    status: mission.status,
    time: formatTime(mission.scheduledStart),
    primarySalesName: mission.primarySalesName,
    supportingSalesNames: mission.supportingSalesNames,
  }))

  // Who is out today, busiest first. Counts every role: a supporting sales is
  // out of the office just as much as the primary.
  const counts = new Map<string, number>()
  for (const mission of ordered) {
    const people = [mission.primarySalesName, ...mission.supportingSalesNames].filter(
      (name): name is string => Boolean(name)
    )
    for (const name of new Set(people)) {
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
  }

  const team = [...counts.entries()]
    .map(([name, missionCount]) => ({ name, missionCount }))
    .sort((a, b) => b.missionCount - a.missionCount || a.name.localeCompare(b.name))

  return {
    today,
    counts: {
      todayTotal: ordered.length,
      accepted: ordered.filter((mission) => mission.status === "ACCEPTED").length,
      completed: ordered.filter((mission) => mission.status === "COMPLETED").length,
      openMissions: missions.filter((mission) => OPEN_STATUSES.includes(mission.status)).length,
    },
    missions: boardMissions,
    team,
  }
}
