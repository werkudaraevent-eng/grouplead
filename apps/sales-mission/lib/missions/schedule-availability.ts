import { MISSION_TIME_ZONE } from "./mission-schema"
import { detectConflict, type ConflictSettings, type ScheduledBlock } from "./mission-join"
import { missionDayKey } from "./mission-calendar"

/**
 * What a scheduler sees while picking a date and time.
 *
 * Pure. The picker asks two questions and both are answered here so the
 * component holds no rules of its own: which days already carry visits for
 * the people being assigned, and what a given day looks like as a timeline of
 * their busy blocks. The clash test is `detectConflict`, the same function the
 * server refuses with, so what the picker paints red is exactly what the save
 * would reject.
 *
 * "Busy" is per person. A rep with two visits on Tuesday sees both; the
 * appointment team assigning three people sees all three calendars merged,
 * each block naming who it belongs to.
 */

export interface PersonSchedule {
  userId: string
  name: string
  blocks: ScheduledBlock[]
}

/** One painted block on the day timeline. Minutes are from 00:00 mission time. */
export interface BusyBlock {
  missionId: string
  personName: string
  startMinute: number
  endMinute: number
  /** Time range as the rep would read it, "09:30–11:00". */
  label: string
  location: string | null
}

/** Minutes past midnight, mission time, for a timestamp. */
export function minuteOfDay(iso: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: MISSION_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso))
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0) % 24
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0)
  return hour * 60 + minute
}

function formatMinute(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`
}

/** Missions with no end are drawn an hour long, matching detectConflict. */
const ASSUMED_DURATION_MINUTES = 60

/** Days (YYYY-MM-DD) on which any of these people already have a visit. */
export function busyDays(people: PersonSchedule[]): Set<string> {
  const days = new Set<string>()
  for (const person of people) {
    for (const block of person.blocks) {
      if (!block.scheduledStart) continue
      const start = new Date(block.scheduledStart)
      if (Number.isNaN(start.getTime())) continue
      days.add(missionDayKey(start))
    }
  }
  return days
}

/** Everyone's visits on one day, earliest first, as timeline blocks. */
export function busyBlocksOn(day: string, people: PersonSchedule[]): BusyBlock[] {
  const result: BusyBlock[] = []
  for (const person of people) {
    for (const block of person.blocks) {
      if (!block.scheduledStart) continue
      const start = new Date(block.scheduledStart)
      if (Number.isNaN(start.getTime()) || missionDayKey(start) !== day) continue

      const startMinute = minuteOfDay(block.scheduledStart)
      let endMinute = startMinute + ASSUMED_DURATION_MINUTES
      if (block.scheduledEnd) {
        const end = new Date(block.scheduledEnd)
        if (!Number.isNaN(end.getTime()) && end.getTime() > start.getTime()) {
          // A visit that runs past midnight is clipped at the day's edge.
          endMinute = missionDayKey(end) === day ? minuteOfDay(block.scheduledEnd) : 24 * 60
        }
      }

      result.push({
        missionId: block.missionId,
        personName: person.name,
        startMinute,
        endMinute,
        label: `${formatMinute(startMinute)}–${formatMinute(endMinute)}`,
        location: block.location,
      })
    }
  }
  return result.sort((a, b) => a.startMinute - b.startMinute)
}

export interface CandidateSlot {
  date: string
  startTime: string
  endTime: string
  location: string | null
  /** The mission being rescheduled, so its own current slot does not clash with itself. */
  missionId?: string
}

export interface SlotVerdict {
  clear: boolean
  /** Who clashes, and with which visit, phrased for the person choosing. */
  clashes: Array<{ personName: string; label: string }>
}

/**
 * Would this slot clash with anyone being assigned?
 *
 * Runs `detectConflict` once per person against that person's own calendar,
 * because a clash is personal: Yulia being busy at 10:00 says nothing about
 * whether Dimas is free then.
 */
export function judgeSlot(
  candidate: CandidateSlot,
  people: PersonSchedule[],
  settings: ConflictSettings
): SlotVerdict {
  if (!candidate.date || !candidate.startTime) return { clear: true, clashes: [] }

  const start = `${candidate.date}T${candidate.startTime}:00+07:00`
  const end = candidate.endTime ? `${candidate.date}T${candidate.endTime}:00+07:00` : null
  const block: ScheduledBlock = {
    missionId: candidate.missionId ?? "candidate",
    scheduledStart: start,
    scheduledEnd: end,
    location: candidate.location,
  }

  const clashes: SlotVerdict["clashes"] = []
  for (const person of people) {
    const result = detectConflict(block, person.blocks, settings)
    for (const missionId of result.conflictingMissionIds) {
      const hit = busyBlocksOn(candidate.date, [person]).find((item) => item.missionId === missionId)
      clashes.push({ personName: person.name, label: hit?.label ?? "jadwal lain" })
    }
  }

  return { clear: clashes.length === 0, clashes }
}
