import { createClient } from "@/utils/supabase/server"
import type { SalesMissionAccess } from "@/lib/sales-mission-access"
import {
  mapMissions,
  type AssignmentRow,
  type MissionListItem,
  type MissionRow,
} from "./mission-schema"
import type {
  InterestLevel,
  NextActionType,
  ReportContactInput,
  ReportStatus,
  VisitOutcome,
} from "./visit-report-schema"

/**
 * Read side of the mission domain.
 *
 * Every query is scoped by `company_id` in addition to RLS. RLS is the security
 * boundary; the explicit filter keeps the intent visible at the call site and
 * stops a policy change from silently widening a list.
 */

const MISSION_COLUMNS =
  "id, client_company_name_snapshot, client_company_id, mission_type, status, objective, location, scheduled_start, scheduled_end, allow_join, created_by, created_at"

/** Mission tables live in their own schema; identity tables stay in `public`. */
async function missionSchema() {
  const supabase = await createClient()
  return { supabase, missions: supabase.schema("sales_mission") }
}

/** Resolve display names for a set of user ids. Returns an empty map for none. */
async function resolveNames(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userIds: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(userIds)]
  if (unique.length === 0) return new Map()

  const { data } = await supabase.from("profiles").select("id, full_name").in("id", unique)

  return new Map(
    (data ?? [])
      .filter((row): row is { id: string; full_name: string } => Boolean(row.full_name))
      .map((row) => [row.id, row.full_name])
  )
}

export async function listMissions(access: SalesMissionAccess): Promise<MissionListItem[]> {
  const { supabase, missions } = await missionSchema()

  const { data: missionRows, error } = await missions
    .from("missions")
    .select(MISSION_COLUMNS)
    .eq("company_id", access.companyId)
    .order("scheduled_start", { ascending: true, nullsFirst: false })

  if (error || !missionRows?.length) return []

  const missionIds = missionRows.map((row) => row.id)
  const { data: assignmentRows } = await missions
    .from("assignments")
    .select("mission_id, user_id, assignment_role, response")
    .eq("company_id", access.companyId)
    .in("mission_id", missionIds)

  const assignments = (assignmentRows ?? []) as AssignmentRow[]
  const names = await resolveNames(supabase, assignments.map((row) => row.user_id))

  return mapMissions(missionRows as MissionRow[], assignments, names, access.userId)
}

export interface MissionSettings {
  conflictCheckEnabled: boolean
  travelBufferMinutes: number
  allowSameLocationBackToBack: boolean
  maxSupporting: number
}

/**
 * Operational settings for this tenant.
 *
 * A tenant that has never configured anything has no row, so the documented
 * defaults apply. Those defaults must match the `enforce_supporting_cap`
 * trigger, or the UI and the database would disagree about when a mission is
 * full.
 */
export async function getMissionSettings(access: SalesMissionAccess): Promise<MissionSettings> {
  const supabase = await createClient()

  const { data } = await supabase
    .schema("sales_mission")
    .from("mission_settings")
    .select("conflict_check_enabled, default_travel_buffer_minutes, allow_same_location_back_to_back, max_supporting_per_mission")
    .eq("company_id", access.companyId)
    .maybeSingle()

  return {
    conflictCheckEnabled: data?.conflict_check_enabled ?? true,
    travelBufferMinutes: data?.default_travel_buffer_minutes ?? 30,
    allowSameLocationBackToBack: data?.allow_same_location_back_to_back ?? false,
    maxSupporting: data?.max_supporting_per_mission ?? 2,
  }
}

export async function getMission(
  access: SalesMissionAccess,
  missionId: string
): Promise<MissionListItem | null> {
  const { supabase, missions } = await missionSchema()

  const { data: missionRow, error } = await missions
    .from("missions")
    .select(MISSION_COLUMNS)
    .eq("company_id", access.companyId)
    .eq("id", missionId)
    .maybeSingle()

  if (error || !missionRow) return null

  const { data: assignmentRows } = await missions
    .from("assignments")
    .select("mission_id, user_id, assignment_role, response")
    .eq("company_id", access.companyId)
    .eq("mission_id", missionId)

  const assignments = (assignmentRows ?? []) as AssignmentRow[]
  const names = await resolveNames(supabase, assignments.map((row) => row.user_id))

  return mapMissions([missionRow as MissionRow], assignments, names, access.userId)[0] ?? null
}

export type MissionRole = "PRIMARY" | "SUPPORTING" | null

/**
 * This viewer's role on a mission.
 *
 * Drives who may write what: only the primary records what happened in the
 * room. Supporting sales — including anyone who joined the mission themselves —
 * add their own notes instead.
 */
export async function getMissionRole(
  access: SalesMissionAccess,
  missionId: string
): Promise<MissionRole> {
  const { missions } = await missionSchema()

  const { data } = await missions
    .from("assignments")
    .select("assignment_role")
    .eq("company_id", access.companyId)
    .eq("mission_id", missionId)
    .eq("user_id", access.userId)
    .maybeSingle()

  return (data?.assignment_role as MissionRole) ?? null
}

export interface MissionTeamMember {
  userId: string
  name: string
  role: "PRIMARY" | "SUPPORTING"
  response: string
}

/** Everyone assigned to a mission, primary first. */
export async function listMissionTeam(
  access: SalesMissionAccess,
  missionId: string
): Promise<MissionTeamMember[]> {
  const { supabase, missions } = await missionSchema()

  const { data: rows } = await missions
    .from("assignments")
    .select("user_id, assignment_role, response")
    .eq("company_id", access.companyId)
    .eq("mission_id", missionId)

  if (!rows?.length) return []

  const names = await resolveNames(supabase, rows.map((row) => row.user_id as string))

  return rows
    .map((row) => ({
      userId: row.user_id as string,
      name: names.get(row.user_id as string) ?? "Nama tidak diketahui",
      role: row.assignment_role as "PRIMARY" | "SUPPORTING",
      response: row.response as string,
    }))
    .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === "PRIMARY" ? -1 : 1))
}

export interface VisitReportRecord {
  id: string
  missionId: string
  status: ReportStatus
  visitOutcome: VisitOutcome | null
  meetingSummary: string
  clientNeeds: string[]
  productInterest: string[]
  interestLevel: InterestLevel | null
  opportunityExists: boolean
  estimatedValue: number | null
  competitorMentioned: string
  nextActionType: NextActionType
  nextActionOwner: string | null
  followUpDate: string | null
  clarificationNote: string | null
  submittedAt: string | null
  contacts: ReportContactInput[]
}

export interface SupportingNoteRecord {
  id: string
  authorName: string
  note: string
  createdAt: string
}

/** The report for a mission, with its contacts. Null when none exists yet. */
export async function getVisitReport(
  access: SalesMissionAccess,
  missionId: string
): Promise<VisitReportRecord | null> {
  const { missions } = await missionSchema()

  const { data: report } = await missions
    .from("visit_reports")
    .select(
      "id, mission_id, status, visit_outcome, meeting_summary, client_needs, product_interest, interest_level, opportunity_exists, estimated_value, competitor_mentioned, next_action_type, next_action_owner, follow_up_date, clarification_note, submitted_at"
    )
    .eq("company_id", access.companyId)
    .eq("mission_id", missionId)
    .maybeSingle()

  if (!report) return null

  const { data: contacts } = await missions
    .from("report_contacts")
    .select("full_name, job_title, phone, email, is_decision_maker")
    .eq("company_id", access.companyId)
    .eq("report_id", report.id)
    .order("created_at")

  return {
    id: report.id as string,
    missionId: report.mission_id as string,
    status: report.status as ReportStatus,
    visitOutcome: (report.visit_outcome as VisitOutcome | null) ?? null,
    meetingSummary: (report.meeting_summary as string | null) ?? "",
    clientNeeds: (report.client_needs as string[] | null) ?? [],
    productInterest: (report.product_interest as string[] | null) ?? [],
    interestLevel: (report.interest_level as InterestLevel | null) ?? null,
    opportunityExists: Boolean(report.opportunity_exists),
    estimatedValue: report.estimated_value === null ? null : Number(report.estimated_value),
    competitorMentioned: (report.competitor_mentioned as string | null) ?? "",
    nextActionType: (report.next_action_type as NextActionType) ?? "NONE",
    nextActionOwner: (report.next_action_owner as string | null) ?? null,
    followUpDate: (report.follow_up_date as string | null) ?? null,
    clarificationNote: (report.clarification_note as string | null) ?? null,
    submittedAt: (report.submitted_at as string | null) ?? null,
    contacts: (contacts ?? []).map((row) => ({
      fullName: row.full_name as string,
      jobTitle: (row.job_title as string | null) ?? "",
      phone: (row.phone as string | null) ?? "",
      email: (row.email as string | null) ?? "",
      isDecisionMaker: Boolean(row.is_decision_maker),
    })),
  }
}

/** Supporting notes for a mission, oldest first, with author names resolved. */
export async function listSupportingNotes(
  access: SalesMissionAccess,
  missionId: string
): Promise<SupportingNoteRecord[]> {
  const { supabase, missions } = await missionSchema()

  const { data: rows } = await missions
    .from("supporting_notes")
    .select("id, author_id, note, created_at")
    .eq("company_id", access.companyId)
    .eq("mission_id", missionId)
    .order("created_at")

  if (!rows?.length) return []

  const names = await resolveNames(supabase, rows.map((row) => row.author_id as string))

  return rows.map((row) => ({
    id: row.id as string,
    authorName: names.get(row.author_id as string) ?? "Nama tidak diketahui",
    note: row.note as string,
    createdAt: row.created_at as string,
  }))
}

export interface TenantSalesOption {
  id: string
  name: string
}

/**
 * People who can be assigned a mission: active members of this tenant.
 *
 * Membership comes from `company_members`, which LeadEngine owns — Sales
 * Mission reads it and never writes it.
 */
export async function listTenantSales(access: SalesMissionAccess): Promise<TenantSalesOption[]> {
  const supabase = await createClient()

  const { data: members } = await supabase
    .from("company_members")
    .select("user_id")
    .eq("company_id", access.companyId)

  const userIds = (members ?? []).map((row) => row.user_id as string)
  if (userIds.length === 0) return []

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", userIds)
    .eq("is_active", true)
    .order("full_name")

  return (profiles ?? [])
    .filter((row): row is { id: string; full_name: string } => Boolean(row.full_name))
    .map((row) => ({ id: row.id, name: row.full_name }))
}

export interface AssignmentListItem {
  id: string
  missionId: string
  clientCompanyName: string
  scheduledStart: string | null
  salesName: string
  role: string
  response: string
}

/** Every assignment in this tenant, newest mission first. */
export async function listAssignments(access: SalesMissionAccess): Promise<AssignmentListItem[]> {
  const { supabase, missions } = await missionSchema()

  const { data: rows, error } = await missions
    .from("assignments")
    .select("id, mission_id, user_id, assignment_role, response")
    .eq("company_id", access.companyId)

  if (error || !rows?.length) return []

  const missionIds = [...new Set(rows.map((row) => row.mission_id as string))]
  const [{ data: missionRows }, names] = await Promise.all([
    missions
      .from("missions")
      .select("id, client_company_name_snapshot, scheduled_start")
      .eq("company_id", access.companyId)
      .in("id", missionIds),
    resolveNames(supabase, rows.map((row) => row.user_id as string)),
  ])

  const missionsById = new Map(
    (missionRows ?? []).map((row) => [row.id as string, row as { client_company_name_snapshot: string; scheduled_start: string | null }])
  )

  return rows
    .map((row) => {
      const mission = missionsById.get(row.mission_id as string)
      if (!mission) return null
      return {
        id: row.id as string,
        missionId: row.mission_id as string,
        clientCompanyName: mission.client_company_name_snapshot,
        scheduledStart: mission.scheduled_start,
        salesName: names.get(row.user_id as string) ?? "Nama tidak diketahui",
        role: row.assignment_role as string,
        response: row.response as string,
      }
    })
    .filter((item): item is AssignmentListItem => item !== null)
    .sort((a, b) => (b.scheduledStart ?? "").localeCompare(a.scheduledStart ?? ""))
}

export interface MissionSummary {
  open: number
  today: number
  completed: number
}

/** Dashboard counters. Uses head-only count queries — no rows come back. */
export async function getMissionSummary(access: SalesMissionAccess): Promise<MissionSummary> {
  const { missions } = await missionSchema()

  const openStatuses = ["SCHEDULED", "ASSIGNED", "ACCEPTED", "IN_PROGRESS"]

  // Day boundaries in Werkudara's timezone, not the server's.
  const now = new Date()
  const jakartaDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(now)
  const dayStart = `${jakartaDay}T00:00:00+07:00`
  const dayEnd = `${jakartaDay}T23:59:59+07:00`

  const base = () => missions.from("missions").select("id", { count: "exact", head: true }).eq("company_id", access.companyId)

  const [open, today, completed] = await Promise.all([
    base().in("status", openStatuses),
    base().gte("scheduled_start", dayStart).lte("scheduled_start", dayEnd),
    base().eq("status", "COMPLETED"),
  ])

  return {
    open: open.count ?? 0,
    today: today.count ?? 0,
    completed: completed.count ?? 0,
  }
}
