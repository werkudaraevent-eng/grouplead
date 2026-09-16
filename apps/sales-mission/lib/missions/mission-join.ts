/**
 * Schedule conflict detection and join eligibility.
 *
 * One implementation, two callers: the admin assigning someone and the sales
 * joining a mission themselves. If these ever diverged, a mission could be
 * refused by one path and accepted by the other for the same person and the
 * same clash — so the rule lives here, pure and tested, and both import it.
 */

export interface ScheduledBlock {
  missionId: string
  scheduledStart: string | null
  scheduledEnd: string | null
  location: string | null
}

export interface ConflictSettings {
  conflictCheckEnabled: boolean
  travelBufferMinutes: number
  allowSameLocationBackToBack: boolean
}

export const DEFAULT_CONFLICT_SETTINGS: ConflictSettings = {
  conflictCheckEnabled: true,
  travelBufferMinutes: 30,
  allowSameLocationBackToBack: false,
}

/** Missions with no end time are treated as this long when checking overlap. */
const ASSUMED_DURATION_MINUTES = 60

const MINUTE = 60_000

interface Interval {
  start: number
  end: number
}

/**
 * Resolve a block to a time interval, or null when it cannot clash with
 * anything — an unscheduled mission has no position on the calendar.
 */
function toInterval(block: ScheduledBlock): Interval | null {
  if (!block.scheduledStart) return null

  const start = new Date(block.scheduledStart).getTime()
  if (Number.isNaN(start)) return null

  const rawEnd = block.scheduledEnd ? new Date(block.scheduledEnd).getTime() : Number.NaN
  const end = Number.isNaN(rawEnd) || rawEnd <= start ? start + ASSUMED_DURATION_MINUTES * MINUTE : rawEnd

  return { start, end }
}

/** Case-insensitive location match, used to waive the buffer when configured. */
function sameLocation(a: string | null, b: string | null): boolean {
  if (!a || !b) return false
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

export interface ConflictResult {
  hasConflict: boolean
  /** Missions already on the person's calendar that clash. */
  conflictingMissionIds: string[]
}

/**
 * Does `candidate` clash with anything already on this person's calendar?
 *
 * The travel buffer is padding on each side: two visits an hour apart across
 * town are a conflict even though the meetings themselves do not overlap. When
 * both are at the same place and the tenant allows it, the buffer is waived —
 * a second meeting in the same building needs no travel.
 */
export function detectConflict(
  candidate: ScheduledBlock,
  existing: ScheduledBlock[],
  settings: ConflictSettings = DEFAULT_CONFLICT_SETTINGS
): ConflictResult {
  if (!settings.conflictCheckEnabled) return { hasConflict: false, conflictingMissionIds: [] }

  const candidateInterval = toInterval(candidate)
  if (!candidateInterval) return { hasConflict: false, conflictingMissionIds: [] }

  const conflictingMissionIds: string[] = []

  for (const block of existing) {
    if (block.missionId === candidate.missionId) continue

    const interval = toInterval(block)
    if (!interval) continue

    const waiveBuffer =
      settings.allowSameLocationBackToBack && sameLocation(candidate.location, block.location)
    const buffer = waiveBuffer ? 0 : settings.travelBufferMinutes * MINUTE

    // Touching exactly at the boundary is not an overlap: a visit ending at
    // 10:00 and the next starting at 10:00 with no buffer is back-to-back, not
    // a clash.
    const overlaps =
      candidateInterval.start < interval.end + buffer && interval.start < candidateInterval.end + buffer

    if (overlaps) conflictingMissionIds.push(block.missionId)
  }

  return { hasConflict: conflictingMissionIds.length > 0, conflictingMissionIds }
}

export type JoinStatus = "ASSIGNED" | "OVER" | "CONFLICT" | "JOINABLE" | "FULL" | "CLOSED"

export const JOIN_STATUS_LABELS: Record<JoinStatus, string> = {
  ASSIGNED: "Kamu ditugaskan",
  OVER: "Sudah selesai",
  CONFLICT: "Bentrok jadwal",
  JOINABLE: "Bisa join",
  FULL: "Sudah penuh",
  CLOSED: "Tertutup",
}

export interface JoinContext {
  /** Viewer is already primary or supporting on this mission. */
  isAssigned: boolean
  /** The visit is over or was called off; there is nothing left to join. */
  isOver: boolean
  allowJoin: boolean
  supportingCount: number
  maxSupporting: number
  hasConflict: boolean
}

/**
 * What this viewer may do with this mission.
 *
 * Order matters and encodes the intent: being already assigned outranks
 * everything, and a schedule clash is reported before "full" or "closed" so the
 * person sees the reason that is about them rather than about the mission.
 */
export function resolveJoinStatus(context: JoinContext): JoinStatus {
  if (context.isAssigned) return "ASSIGNED"
  if (context.isOver) return "OVER"
  if (context.hasConflict) return "CONFLICT"
  if (!context.allowJoin) return "CLOSED"
  if (context.supportingCount >= context.maxSupporting) return "FULL"
  return "JOINABLE"
}

/** Only one status permits joining. Keeps the button and the server in step. */
export function canJoin(status: JoinStatus): boolean {
  return status === "JOINABLE"
}

export interface JoinSettings extends ConflictSettings {
  maxSupporting: number
}

export const DEFAULT_JOIN_SETTINGS: JoinSettings = {
  ...DEFAULT_CONFLICT_SETTINGS,
  maxSupporting: 2,
}

/** Minimal mission shape this module needs, so it stays free of query types. */
export interface JoinCandidate {
  id: string
  scheduledStart: string | null
  scheduledEnd: string | null
  location: string | null
  allowJoin: boolean
  supportingCount: number
  viewerRole: "PRIMARY" | "SUPPORTING" | null
  /** Mission status; COMPLETED and CANCELLED close the door. Optional for callers that only check time. */
  status?: string
}

/**
 * Label every mission with what this viewer may do with it.
 *
 * The viewer's own calendar is derived from the same list — any mission they
 * are already assigned to is a block on their day — so a single fetch answers
 * both "what is on the team calendar" and "which of these clash with mine".
 */
export function annotateJoinStatus<T extends JoinCandidate>(
  missions: T[],
  settings: JoinSettings = DEFAULT_JOIN_SETTINGS,
  /**
   * The viewer's whole calendar. Derived from the list itself when omitted,
   * which is only right when the list is the whole tenant; a paged list
   * passes it explicitly.
   */
  calendar?: ScheduledBlock[]
): Array<T & { joinStatus: JoinStatus }> {
  const ownBlocks: ScheduledBlock[] =
    calendar ??
    missions
      .filter((mission) => mission.viewerRole !== null)
      .map((mission) => ({
        missionId: mission.id,
        scheduledStart: mission.scheduledStart,
        scheduledEnd: mission.scheduledEnd,
        location: mission.location,
      }))

  return missions.map((mission) => {
    const { hasConflict } = detectConflict(
      {
        missionId: mission.id,
        scheduledStart: mission.scheduledStart,
        scheduledEnd: mission.scheduledEnd,
        location: mission.location,
      },
      ownBlocks,
      settings
    )

    return {
      ...mission,
      joinStatus: resolveJoinStatus({
        isAssigned: mission.viewerRole !== null,
        isOver: mission.status === "COMPLETED" || mission.status === "CANCELLED",
        allowJoin: mission.allowJoin,
        supportingCount: mission.supportingCount,
        maxSupporting: settings.maxSupporting,
        hasConflict,
      }),
    }
  })
}

/** Why the join button is disabled, phrased for the person reading it. */
export function joinBlockedReason(status: JoinStatus, maxSupporting: number): string | null {
  switch (status) {
    case "CONFLICT":
      return "Kamu sudah punya aktivitas pada jam itu. Minta admin mengatur ulang jadwal kalau tetap ingin ikut."
    case "FULL":
      return `Aktivitas ini sudah penuh (maksimal ${maxSupporting} sales pendukung).`
    case "CLOSED":
      return "Sales utama menutup aktivitas ini dari penambahan anggota."
    case "OVER":
      return "Kunjungan ini sudah selesai atau dibatalkan."
    default:
      return null
  }
}
