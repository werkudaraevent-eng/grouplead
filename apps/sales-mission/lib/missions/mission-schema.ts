import { z } from "zod"

/**
 * Mission domain contract: validation, constants, and the pure helpers that
 * turn form input into database rows and rows back into display strings.
 *
 * Everything here is free of Supabase and Next, so it is unit-testable and can
 * be reused by a server action, a route handler, or a future API client.
 */

/**
 * Kept as the seed default only. The mission form renders the tenant's
 * configured options and the action validates against those, so a type added in
 * Pengaturan works without a deploy.
 */
export { DEFAULT_MISSION_TYPES as MISSION_TYPES } from "./form-fields"
export type MissionType = string

/**
 * Salutations offered beside the appointment contact's name.
 *
 * Constrained rather than free text because it decides how a rep addresses
 * someone in the room, and it is checked by a CHECK constraint on the column
 * too — this list and that constraint have to agree.
 */
export const CONTACT_SALUTATIONS = ["Bapak", "Ibu", "Mr", "Mrs", "Ms"] as const
export type ContactSalutation = (typeof CONTACT_SALUTATIONS)[number]

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
    /**
     * LeadEngine master id when the company was picked from live search.
     * Null keeps a typed-in name as a snapshot, which is legitimate — the CRM
     * review flow links it later. But the lead-push owner and duplicate guards
     * can only run once this is set.
     */
    clientCompanyId: z.string().uuid().nullish(),
    // Validated against the tenant's configured list in createMission, not
    // against a compile-time enum: the options are admin-editable now.
    missionType: z.string().trim().min(1, "Pilih jenis mission").max(100),
    date: z.string().regex(DATE_PATTERN, "Tanggal tidak valid"),
    startTime: z.string().regex(TIME_PATTERN, "Jam mulai tidak valid"),
    endTime: z.string().regex(TIME_PATTERN, "Jam selesai tidak valid").optional().or(z.literal("")),
    location: z.string().trim().max(300).optional().or(z.literal("")),
    objective: z.string().trim().max(1000).optional().or(z.literal("")),
    primarySalesId: z.string().uuid("Pilih sales utama"),
    supportingSalesIds: z.array(z.string().uuid()).default([]),
    // Appointment block. All optional: a rep can be sent to a company before
    // anyone has a name, and refusing to save the mission over a missing phone
    // number would just push people to type junk into it.
    contactSalutation: z.enum(CONTACT_SALUTATIONS).optional().or(z.literal("")),
    /** LeadEngine contacts.id when the name was picked from the CRM, empty when typed. */
    contactId: z.string().uuid().optional().or(z.literal("")),
    contactName: z.string().trim().max(150).optional().or(z.literal("")),
    contactJobTitle: z.string().trim().max(150).optional().or(z.literal("")),
    contactDivision: z.string().trim().max(150).optional().or(z.literal("")),
    contactPhone: z.string().trim().max(50).optional().or(z.literal("")),
    contactEmail: z
      .string()
      .trim()
      .max(200)
      .email("Format email kontak tidak valid")
      .optional()
      .or(z.literal("")),
    building: z.string().trim().max(300).optional().or(z.literal("")),
    appointmentNotes: z.string().trim().max(4000).optional().or(z.literal("")),
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

    // A salutation with nobody attached is a leftover from a cleared field, not
    // information. Catching it here keeps "Bapak —" off the mission detail page.
    if (value.contactSalutation && !value.contactName) {
      ctx.addIssue({
        code: "custom",
        path: ["contactName"],
        message: "Isi nama kontak, atau kosongkan sapaannya",
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
  contact_salutation: string | null
  contact_id: string | null
  contact_name: string | null
  contact_job_title: string | null
  contact_division: string | null
  contact_phone: string | null
  contact_email: string | null
  building: string | null
  appointment_notes: string | null
}

/** Who the appointment is with, and what was already agreed with them. */
export interface MissionAppointment {
  salutation: string | null
  /** LeadEngine contacts.id when this person was picked from the CRM. */
  contactId: string | null
  name: string | null
  jobTitle: string | null
  division: string | null
  phone: string | null
  email: string | null
  building: string | null
  notes: string | null
}

/** Nothing worth rendering an appointment block for. */
export function hasAppointmentDetails(appointment: MissionAppointment): boolean {
  return Boolean(
    appointment.name ||
      appointment.jobTitle ||
      appointment.division ||
      appointment.phone ||
      appointment.email ||
      appointment.building ||
      appointment.notes
  )
}

/** "Bapak Andi" — the salutation is dropped when there is no name to carry it. */
export function formatContactName(appointment: MissionAppointment): string | null {
  if (!appointment.name) return null
  return appointment.salutation ? `${appointment.salutation} ${appointment.name}` : appointment.name
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
  /** Who the appointment is with. Empty on missions booked before this existed. */
  appointment: MissionAppointment
  supportingCount: number
  /** This viewer's own role on the mission, if any. */
  viewerRole: "PRIMARY" | "SUPPORTING" | null
  /** This viewer's own answer, so the list can say "you still owe an answer". */
  viewerResponse: AssignmentResponse | null
  /**
   * How many people on this mission have not answered yet.
   *
   * Carried on the list because chasing answers used to be a separate screen
   * that re-read the same assignments and pivoted them per person. The question
   * ("who is holding this mission up") belongs next to the mission it is about.
   */
  pendingResponses: number
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
      appointment: {
        salutation: mission.contact_salutation ?? null,
        contactId: mission.contact_id ?? null,
        name: mission.contact_name ?? null,
        jobTitle: mission.contact_job_title ?? null,
        division: mission.contact_division ?? null,
        phone: mission.contact_phone ?? null,
        email: mission.contact_email ?? null,
        building: mission.building ?? null,
        notes: mission.appointment_notes ?? null,
      },
      supportingCount: supporting.length,
      viewerRole: (viewer?.assignment_role as "PRIMARY" | "SUPPORTING" | undefined) ?? null,
      viewerResponse: (viewer?.response as AssignmentResponse | undefined) ?? null,
      pendingResponses: missionAssignments.filter((item) => item.response === "PENDING").length,
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
/**
 * Clock time alone, in mission time.
 *
 * For a card already grouped under "Hari ini", `formatMissionSchedule` would
 * repeat the day back at the reader.
 */
export function formatMissionTime(scheduledStart: string | null): string {
  if (!scheduledStart) return "—"

  const start = new Date(scheduledStart)
  if (Number.isNaN(start.getTime())) return "—"

  return new Intl.DateTimeFormat("id-ID", {
    timeZone: MISSION_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(start)
}

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
