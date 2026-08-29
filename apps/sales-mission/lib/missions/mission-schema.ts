import { z } from "zod"

/**
 * Mission domain contract: validation, constants, and the pure helpers that
 * turn form input into database rows and rows back into display strings.
 *
 * Everything here is free of Supabase and Next, so it is unit-testable and can
 * be reused by a server action, a route handler, or a future API client.
 */

/** Built-in mission types (spec §11). Admin-defined types arrive with templates. */
export const MISSION_TYPES = ["Meeting", "Visit", "Survey", "Follow Up"] as const
export type MissionType = (typeof MISSION_TYPES)[number]

/** Mission lifecycle (spec §6). Mirrors the CHECK constraint on the table. */
export const MISSION_STATUSES = [
  "DRAFT",
  "SCHEDULED",
  "ASSIGNED",
  "ACCEPTED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "RESCHEDULE_REQUESTED",
  "REJECTED",
] as const
export type MissionStatus = (typeof MISSION_STATUSES)[number]

export const ASSIGNMENT_ROLES = ["PRIMARY", "SUPPORTING"] as const
export type AssignmentRole = (typeof ASSIGNMENT_ROLES)[number]

export const ASSIGNMENT_RESPONSES = ["PENDING", "ACCEPTED", "REJECTED", "RESCHEDULE_REQUESTED"] as const
export type AssignmentResponse = (typeof ASSIGNMENT_RESPONSES)[number]

/**
 * Werkudara operates in Western Indonesian Time. Indonesia has no daylight
 * saving, so a fixed offset is exact rather than an approximation — the form
 * collects wall-clock time and this pins it to a real instant.
 *
 * Revisit if missions are ever scheduled in WITA (+08:00) or WIT (+09:00);
 * the offset would then have to be per-mission, not per-app.
 */
export const MISSION_TIME_ZONE = "Asia/Jakarta"
const MISSION_UTC_OFFSET = "+07:00"

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^\d{2}:\d{2}$/

export const createMissionSchema = z
  .object({
    clientCompanyName: z.string().trim().min(1, "Nama perusahaan klien wajib diisi").max(200),
    missionType: z.enum(MISSION_TYPES),
    date: z.string().regex(DATE_PATTERN, "Tanggal tidak valid"),
    startTime: z.string().regex(TIME_PATTERN, "Jam mulai tidak valid"),
    endTime: z.string().regex(TIME_PATTERN, "Jam selesai tidak valid").optional().or(z.literal("")),
    location: z.string().trim().max(300).optional().or(z.literal("")),
    objective: z.string().trim().max(1000).optional().or(z.literal("")),
    primarySalesId: z.string().uuid("Pilih sales utama"),
    supportingSalesIds: z.array(z.string().uuid()).default([]),
  })
  .superRefine((value, ctx) => {
    if (value.endTime && value.endTime <= value.startTime) {
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "Jam selesai harus setelah jam mulai",
      })
    }

    if (value.supportingSalesIds.includes(value.primarySalesId)) {
      ctx.addIssue({
        code: "custom",
        path: ["supportingSalesIds"],
        message: "Sales utama tidak bisa sekaligus jadi sales pendukung",
      })
    }

    const unique = new Set(value.supportingSalesIds)
    if (unique.size !== value.supportingSalesIds.length) {
      ctx.addIssue({
        code: "custom",
        path: ["supportingSalesIds"],
        message: "Sales pendukung terduplikasi",
      })
    }
  })

export type CreateMissionInput = z.infer<typeof createMissionSchema>

/**
 * Combine a wall-clock date and time into an instant.
 *
 * The form has no timezone control, so an unqualified string would be read as
 * the server's zone — which on a cloud host is UTC, silently shifting every
 * mission by seven hours.
 */
export function toMissionTimestamp(date: string, time: string): string {
  return `${date}T${time}:00${MISSION_UTC_OFFSET}`
}

/** Row shape returned by the missions table. */
export interface MissionRow {
  id: string
  client_company_name_snapshot: string
  client_company_id: string | null
  mission_type: string
  status: string
  objective: string | null
  location: string | null
  scheduled_start: string | null
  scheduled_end: string | null
  allow_join: boolean
  created_by: string
  created_at: string
}

export interface AssignmentRow {
  mission_id: string
  user_id: string
  assignment_role: string
  response: string
}

/** A mission with its people resolved, ready to render. */
export interface MissionListItem {
  id: string
  clientCompanyName: string
  /** LeadEngine master id, null while the company is only a snapshot name. */
  clientCompanyId: string | null
  missionType: string
  status: MissionStatus
  location: string | null
  objective: string | null
  scheduledStart: string | null
  scheduledEnd: string | null
  primarySalesName: string | null
  supportingSalesNames: string[]
  /** Primary can close a sensitive meeting to further joiners. */
  allowJoin: boolean
  supportingCount: number
  /** This viewer's own role on the mission, if any. */
  viewerRole: "PRIMARY" | "SUPPORTING" | null
}

/**
 * Join missions to their assignments and names in memory.
 *
 * Assignments reference `auth.users`, not `profiles`, so PostgREST cannot embed
 * the name — and the two tables now live in different schemas. Three small
 * queries plus this mapping beat one query per mission.
 */
export function mapMissions(
  missions: MissionRow[],
  assignments: AssignmentRow[],
  namesByUserId: Map<string, string>,
  viewerId?: string
): MissionListItem[] {
  const byMission = new Map<string, AssignmentRow[]>()
  for (const assignment of assignments) {
    const list = byMission.get(assignment.mission_id)
    if (list) list.push(assignment)
    else byMission.set(assignment.mission_id, [assignment])
  }

  return missions.map((mission) => {
    const missionAssignments = byMission.get(mission.id) ?? []
    const primary = missionAssignments.find((item) => item.assignment_role === "PRIMARY")
    const supporting = missionAssignments.filter((item) => item.assignment_role === "SUPPORTING")
    const viewer = viewerId ? missionAssignments.find((item) => item.user_id === viewerId) : undefined

    return {
      id: mission.id,
      clientCompanyName: mission.client_company_name_snapshot,
      clientCompanyId: mission.client_company_id,
      missionType: mission.mission_type,
      status: mission.status as MissionStatus,
      location: mission.location,
      objective: mission.objective,
      scheduledStart: mission.scheduled_start,
      scheduledEnd: mission.scheduled_end,
      // Missions created before the column existed default to open.
      allowJoin: mission.allow_join !== false,
      supportingCount: supporting.length,
      viewerRole: (viewer?.assignment_role as "PRIMARY" | "SUPPORTING" | undefined) ?? null,
      primarySalesName: primary ? namesByUserId.get(primary.user_id) ?? null : null,
      supportingSalesNames: supporting
        .map((item) => namesByUserId.get(item.user_id))
        .filter((name): name is string => Boolean(name)),
    }
  })
}

/**
 * Render a mission's schedule in Werkudara's timezone.
 *
 * `now` is injected rather than read from the clock so the relative wording is
 * deterministic — a server render and the test suite agree on what "today" is.
 */
export function formatMissionSchedule(scheduledStart: string | null, now: Date): string {
  if (!scheduledStart) return "Belum dijadwalkan"

  const start = new Date(scheduledStart)
  if (Number.isNaN(start.getTime())) return "Jadwal tidak valid"

  const dayKey = (value: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: MISSION_TIME_ZONE }).format(value)

  const time = new Intl.DateTimeFormat("id-ID", {
    timeZone: MISSION_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(start)

  const startDay = dayKey(start)
  const today = dayKey(now)
  const tomorrow = dayKey(new Date(now.getTime() + 86_400_000))

  if (startDay === today) return `Hari ini, ${time}`
  if (startDay === tomorrow) return `Besok, ${time}`

  const date = new Intl.DateTimeFormat("id-ID", {
    timeZone: MISSION_TIME_ZONE,
    day: "numeric",
    month: "short",
  }).format(start)

  return `${date}, ${time}`
}
