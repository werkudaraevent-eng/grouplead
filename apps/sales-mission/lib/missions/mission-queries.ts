import { cache } from "react"
import { normalizeDisc, type DiscLetter } from "@/lib/contacts/disc"
import { createClient } from "@/utils/supabase/server"
import { reportChoiceLabels } from "./report-choice-queries"
import type { SalesMissionAccess } from "@/lib/sales-mission-access"
import {
  mapMissions,
  type AssignmentRow,
  type MissionListItem,
  type MissionRow,
  type ReportStateMap,
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
  "id, client_company_name_snapshot, client_company_id, mission_type, status, objective, location, scheduled_start, scheduled_end, allow_join, created_by, created_at, updated_at, contact_salutation, contact_id, contact_name, contact_job_title, contact_division, contact_phone, contact_email, building, appointment_notes, address, industry, reschedule_due, rescheduled_to_id"

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

/** Report status and outcome per mission, for the list's visit state. */
async function reportStates(
  missions: ReturnType<Awaited<ReturnType<typeof createClient>>["schema"]>,
  companyId: string,
  missionIds: string[]
): Promise<ReportStateMap> {
  const map: ReportStateMap = new Map()
  if (missionIds.length === 0) return map
  const { data } = await missions
    .from("visit_reports")
    .select("mission_id, status, visit_outcome")
    .eq("company_id", companyId)
    .in("mission_id", missionIds)
  const labels = await reportChoiceLabels(missions, companyId)
  for (const row of data ?? []) {
    const outcome = (row.visit_outcome as string | null) ?? null
    map.set(row.mission_id as string, {
      status: row.status as "DRAFT" | "SUBMITTED" | "NEEDS_CLARIFICATION",
      visitOutcome: outcome,
      visitOutcomeLabel: outcome ? (labels.visit_outcome.get(outcome) ?? outcome) : null,
    })
  }
  return map
}

/**
 * Missions in a window, earliest first.
 *
 * Every caller that used to load the whole tenant now says what it needs:
 * a month for the calendar, the last two months for Hari ini. A tenant a
 * year in would otherwise hit PostgREST's row cap and quietly lose rows.
 */
export async function listMissions(
  access: SalesMissionAccess,
  window: { since?: Date; until?: Date } = {}
): Promise<MissionListItem[]> {
  const { missions } = await missionSchema()

  let query = missions
    .from("missions")
    .select(MISSION_COLUMNS)
    .is("deleted_at", null)
    .eq("company_id", access.companyId)
    .order("scheduled_start", { ascending: true, nullsFirst: false })
  if (window.since) query = query.gte("scheduled_start", window.since.toISOString())
  if (window.until) query = query.lte("scheduled_start", window.until.toISOString())

  const { data: missionRows, error } = await query
  if (error || !missionRows?.length) return []

  return hydrateMissions(access, missionRows as MissionRow[])
}

/** The given missions, in the given order. For a page of ids. */
export async function listMissionsByIds(access: SalesMissionAccess, ids: string[]): Promise<MissionListItem[]> {
  if (ids.length === 0) return []
  const { missions } = await missionSchema()
  const { data: missionRows } = await missions
    .from("missions")
    .select(MISSION_COLUMNS)
    .is("deleted_at", null)
    .eq("company_id", access.companyId)
    .in("id", ids)
  const rows = (missionRows ?? []) as MissionRow[]
  const order = new Map(ids.map((id, index) => [id, index]))
  rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
  return hydrateMissions(access, rows)
}

/**
 * The viewer's own visits, as blocks, for judging whether they may join
 * another one. Loaded on its own rather than derived from whichever rows a
 * page happened to show, which stopped being the whole calendar once the
 * list was paged.
 */
export async function listViewerCalendar(
  access: SalesMissionAccess
): Promise<Array<{ missionId: string; scheduledStart: string | null; scheduledEnd: string | null; location: string | null }>> {
  const { missions } = await missionSchema()
  const { data: rows } = await missions
    .from("assignments")
    .select("mission_id")
    .eq("company_id", access.companyId)
    .eq("user_id", access.userId)
    .neq("response", "REJECTED")
  const ids = (rows ?? []).map((row) => row.mission_id as string)
  if (ids.length === 0) return []
  const { data: own } = await missions
    .from("missions")
    .select("id, scheduled_start, scheduled_end, location, status")
    .is("deleted_at", null)
    .eq("company_id", access.companyId)
    .in("id", ids)
    .not("status", "in", "(CANCELLED,REJECTED,COMPLETED)")
  return (own ?? []).map((row) => ({
    missionId: row.id as string,
    scheduledStart: (row.scheduled_start as string | null) ?? null,
    scheduledEnd: (row.scheduled_end as string | null) ?? null,
    location: (row.location as string | null) ?? null,
  }))
}

/** Assignments, names, and report states for a set of mission rows. */
async function hydrateMissions(access: SalesMissionAccess, missionRows: MissionRow[]): Promise<MissionListItem[]> {
  const { supabase, missions } = await missionSchema()
  const missionIds = missionRows.map((row) => row.id)
  const { data: assignmentRows } = await missions
    .from("assignments")
    .select("mission_id, user_id, assignment_role, response")
    .eq("company_id", access.companyId)
    .in("mission_id", missionIds)

  const assignments = (assignmentRows ?? []) as AssignmentRow[]
  const [names, reports] = await Promise.all([
    resolveNames(supabase, [...assignments.map((row) => row.user_id), ...missionRows.map((row) => row.created_by as string)]),
    reportStates(missions, access.companyId, missionIds),
  ])

  return mapMissions(missionRows as MissionRow[], assignments, names, access.userId, reports)
}

export interface MissionSettings {
  conflictCheckEnabled: boolean
  travelBufferMinutes: number
  allowSameLocationBackToBack: boolean
  maxSupporting: number
  /**
   * Whether a rep must press Terima on a new assignment. Off means an
   * assignment is accepted the moment it is made; Tolak and Minta jadwal
   * ulang stay available either way.
   */
  requireAssignmentConfirmation: boolean
  /**
   * Whether the primary sales may move their own visit directly. Off means
   * they propose like everyone else and an admin decides.
   */
  primaryCanReschedule: boolean
  /** Days after sending during which the primary may edit their own report. 0 = admin only. */
  reportEditWindowDays: number
  /**
   * Whether a report waits for its visit: the form opens at the start of
   * the scheduled day and the actual time may not be in the future.
   */
  reportAfterVisitOnly: boolean
  /** Opening line for a WhatsApp chat started from a prospect; null = the app's default. */
  whatsappGreeting: string | null
  /** Template for "Bagikan ke WhatsApp" on a sent report; null = the default in lib/missions/report-share.ts. */
  reportShareTemplate: string | null
  /** Whether the report offers DISC chips on each contact met. Off until the unit trained on it. */
  contactDiscEnabled: boolean
  /** Whether the AI writes a daily insight for the unit (Ringkasan). */
  aiInsightsEnabled: boolean
  /** Hour of day (WIB) for the morning insight. */
  aiInsightsHour: number
  /** Whether Ringkasan offers Tanya AI. */
  aiAskEnabled: boolean
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
    .select("conflict_check_enabled, default_travel_buffer_minutes, allow_same_location_back_to_back, max_supporting_per_mission, require_assignment_confirmation, primary_can_reschedule, report_edit_window_days, report_after_visit_only, whatsapp_greeting, contact_disc_enabled, ai_insights_enabled, ai_insights_hour, ai_ask_enabled, report_share_template")
    .eq("company_id", access.companyId)
    .maybeSingle()

  return {
    conflictCheckEnabled: data?.conflict_check_enabled ?? true,
    travelBufferMinutes: data?.default_travel_buffer_minutes ?? 30,
    allowSameLocationBackToBack: data?.allow_same_location_back_to_back ?? false,
    maxSupporting: data?.max_supporting_per_mission ?? 2,
    requireAssignmentConfirmation: data?.require_assignment_confirmation ?? false,
    primaryCanReschedule: data?.primary_can_reschedule ?? true,
    reportEditWindowDays: data?.report_edit_window_days ?? 7,
    reportAfterVisitOnly: data?.report_after_visit_only ?? true,
    whatsappGreeting: (data?.whatsapp_greeting as string | null | undefined)?.trim() || null,
    reportShareTemplate: (data?.report_share_template as string | null | undefined)?.trim() || null,
    contactDiscEnabled: Boolean(data?.contact_disc_enabled),
    aiInsightsEnabled: Boolean(data?.ai_insights_enabled),
    aiInsightsHour: typeof data?.ai_insights_hour === "number" ? data.ai_insights_hour : 6,
    aiAskEnabled: Boolean(data?.ai_ask_enabled),
  }
}

export interface LeadPushRecord {
  leadId: string
  pushedAt: string
  pushedByName: string
  ownerName: string
  /** Master option values chosen at the push; null on pushes before they existed. */
  category: string | null
  gradeLead: string | null
}

/** The one push a mission can have; the page shows it instead of the form. */
export async function getLeadPush(access: SalesMissionAccess, missionId: string): Promise<LeadPushRecord | null> {
  const { supabase, missions } = await missionSchema()
  const { data } = await missions
    .from("lead_pushes")
    .select("lead_engine_lead_id, pushed_at, pushed_by, owner_user_id, category, grade_lead")
    .eq("company_id", access.companyId)
    .eq("mission_id", missionId)
    .maybeSingle()
  if (!data) return null
  const names = await resolveNames(supabase, [data.pushed_by as string, data.owner_user_id as string])
  return {
    leadId: data.lead_engine_lead_id as string,
    pushedAt: data.pushed_at as string,
    pushedByName: names.get(data.pushed_by as string) ?? "—",
    ownerName: names.get(data.owner_user_id as string) ?? "—",
    category: (data.category as string | null) ?? null,
    gradeLead: (data.grade_lead as string | null) ?? null,
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
    .is("deleted_at", null)
    .eq("company_id", access.companyId)
    .eq("id", missionId)
    .maybeSingle()

  // A query error and "no such mission" both end in a 404, so the error must
  // at least reach the server log or it is invisible.
  if (error) console.error("[getMission]", missionId, error.code, error.message, error.details ?? "")
  if (error || !missionRow) return null

  const { data: assignmentRows } = await missions
    .from("assignments")
    .select("mission_id, user_id, assignment_role, response")
    .eq("company_id", access.companyId)
    .eq("mission_id", missionId)

  const assignments = (assignmentRows ?? []) as AssignmentRow[]
  const [names, reports] = await Promise.all([
    resolveNames(supabase, [...assignments.map((row) => row.user_id), missionRow.created_by as string]),
    reportStates(missions, access.companyId, [missionId]),
  ])

  return mapMissions([missionRow as MissionRow], assignments, names, access.userId, reports)[0] ?? null
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
  avatarUrl: string | null
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

  const userIds = [...new Set(rows.map((row) => row.user_id as string))]
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .in("id", userIds)
  const byId = new Map(
    (profiles ?? []).map((row) => [
      row.id as string,
      { name: (row.full_name as string | null) ?? null, avatarUrl: (row.avatar_url as string | null)?.trim() || null },
    ])
  )

  return rows
    .map((row) => ({
      userId: row.user_id as string,
      name: byId.get(row.user_id as string)?.name ?? "Nama tidak diketahui",
      avatarUrl: byId.get(row.user_id as string)?.avatarUrl ?? null,
      role: row.assignment_role as "PRIMARY" | "SUPPORTING",
      response: row.response as string,
    }))
    .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === "PRIMARY" ? -1 : 1))
}

export interface PendingReschedule {
  id: string
  requestedByName: string
  requestedById: string
  proposedStart: string
  proposedEnd: string | null
  reason: string
  createdAt: string
}

/** The open reschedule request for a mission, if any. At most one by design. */
export async function getPendingReschedule(
  access: SalesMissionAccess,
  missionId: string
): Promise<PendingReschedule | null> {
  const { supabase, missions } = await missionSchema()

  const { data } = await missions
    .from("reschedule_requests")
    .select("id, requested_by, proposed_start, proposed_end, reason, created_at")
    .eq("company_id", access.companyId)
    .eq("mission_id", missionId)
    .eq("status", "PENDING")
    .maybeSingle()

  if (!data) return null

  const names = await resolveNames(supabase, [data.requested_by as string])

  return {
    id: data.id as string,
    requestedById: data.requested_by as string,
    requestedByName: names.get(data.requested_by as string) ?? "Nama tidak diketahui",
    proposedStart: data.proposed_start as string,
    proposedEnd: (data.proposed_end as string | null) ?? null,
    reason: data.reason as string,
    createdAt: data.created_at as string,
  }
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
  /** When the visit really happened, as reported. Null when not filled in. */
  actualStart: string | null
  actualEnd: string | null
  clarificationNote: string | null
  submittedAt: string | null
  /** When the company and contacts last reached LeadEngine. Null until they have. */
  crmSyncedAt: string | null
  /** Why the last attempt failed, so the page can offer a retry with a reason. */
  crmSyncError: string | null
  /** Answers to admin-added fields, keyed by reporting key. */
  custom: Record<string, unknown>
  // The CRM link, so the push modal can tell a known contact from a new one.
  contacts: Array<ReportContactInput & { leadEngineContactId: string | null } & DiscAssessment>
}

/** Who made a contact's DISC reading, and when. Both null until one is saved. */
export interface DiscAssessment {
  discAssessedByName: string | null
  discAssessedAt: string | null
}

/** A contact's last DISC reading at a company, for prefilling the next report. */
export interface KnownDisc {
  discPrimary: DiscLetter
  discSecondary: DiscLetter | null
  discNote: string
  discAssessedByName: string | null
  discAssessedAt: string | null
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
      "id, mission_id, status, visit_outcome, meeting_summary, client_needs, product_interest, interest_level, opportunity_exists, estimated_value, competitor_mentioned, next_action_type, next_action_owner, follow_up_date, actual_start, actual_end, clarification_note, submitted_at, crm_synced_at, crm_sync_error"
    )
    .eq("company_id", access.companyId)
    .eq("mission_id", missionId)
    .maybeSingle()

  if (!report) return null

  const [{ data: contacts }, { data: customRows }] = await Promise.all([
    missions
      .from("report_contacts")
      .select("full_name, job_title, phone, email, is_decision_maker, lead_engine_contact_id, disc_primary, disc_secondary, disc_note, disc_assessed_by_name, disc_assessed_at")
      .eq("company_id", access.companyId)
      .eq("report_id", report.id)
      .order("created_at"),
    missions
      .from("report_field_values")
      .select("reporting_key, value")
      .eq("company_id", access.companyId)
      .eq("report_id", report.id),
  ])
  const custom: Record<string, unknown> = {}
  for (const row of customRows ?? []) custom[row.reporting_key as string] = row.value

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
    actualStart: (report.actual_start as string | null) ?? null,
    actualEnd: (report.actual_end as string | null) ?? null,
    submittedAt: (report.submitted_at as string | null) ?? null,
    crmSyncedAt: (report.crm_synced_at as string | null) ?? null,
    crmSyncError: (report.crm_sync_error as string | null) ?? null,
    custom,
    contacts: (contacts ?? []).map((row) => ({
      fullName: row.full_name as string,
      jobTitle: (row.job_title as string | null) ?? "",
      phone: (row.phone as string | null) ?? "",
      email: (row.email as string | null) ?? "",
      isDecisionMaker: Boolean(row.is_decision_maker),
      leadEngineContactId: (row.lead_engine_contact_id as string | null) ?? null,
      discPrimary: normalizeDisc(row.disc_primary, row.disc_secondary).primary,
      discSecondary: normalizeDisc(row.disc_primary, row.disc_secondary).secondary,
      discNote: (row.disc_note as string | null) ?? "",
      discAssessedByName: (row.disc_assessed_by_name as string | null) ?? null,
      discAssessedAt: (row.disc_assessed_at as string | null) ?? null,
    })),
  }
}

/**
 * The last DISC reading of each person met before at this company, keyed by
 * lowercased name.
 *
 * A reading belongs to the person, not to one visit: the rep who met Pak
 * Nuryono last month already worked out how to talk to him, and the next rep
 * should start from that, not from blank chips. Matched by name within the
 * same CRM company (or the same company name when the mission was never
 * linked), the same rule `replaceContacts` uses to link a contact, so the
 * two never disagree about who is who. Newest reading wins. Scoped to the
 * unit by `company_id`; RLS keeps other units out as everywhere else.
 */
export async function lastDiscForCompany(
  access: SalesMissionAccess,
  mission: { id: string; clientCompanyId: string | null; clientCompanyName: string }
): Promise<Map<string, KnownDisc>> {
  const { missions } = await missionSchema()

  let related = missions
    .from("missions")
    .select("id")
    .eq("company_id", access.companyId)
    .neq("id", mission.id)
  related = mission.clientCompanyId
    ? related.eq("client_company_id", mission.clientCompanyId)
    : related.ilike("client_company_name", mission.clientCompanyName.trim().replace(/[%_]/g, (m) => `\\${m}`))
  const { data: missionRows } = await related.limit(200)
  const missionIds = (missionRows ?? []).map((row) => row.id as string)
  if (missionIds.length === 0) return new Map()

  const { data: reportRows } = await missions
    .from("visit_reports")
    .select("id")
    .eq("company_id", access.companyId)
    .in("mission_id", missionIds)
  const reportIds = (reportRows ?? []).map((row) => row.id as string)
  if (reportIds.length === 0) return new Map()

  const { data: rows } = await missions
    .from("report_contacts")
    .select("full_name, disc_primary, disc_secondary, disc_note, disc_assessed_by_name, disc_assessed_at")
    .eq("company_id", access.companyId)
    .in("report_id", reportIds)
    .not("disc_primary", "is", null)
    .order("disc_assessed_at", { ascending: false, nullsFirst: false })
    .limit(200)

  const known = new Map<string, KnownDisc>()
  for (const row of rows ?? []) {
    const key = (row.full_name as string).trim().toLowerCase()
    if (!key || known.has(key)) continue
    const disc = normalizeDisc(row.disc_primary, row.disc_secondary)
    if (!disc.primary) continue
    known.set(key, {
      discPrimary: disc.primary,
      discSecondary: disc.secondary,
      discNote: (row.disc_note as string | null) ?? "",
      discAssessedByName: (row.disc_assessed_by_name as string | null) ?? null,
      discAssessedAt: (row.disc_assessed_at as string | null) ?? null,
    })
  }
  return known
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
  /** How an import identifies this person. Names repeat; emails do not. */
  email: string | null
  /** The photo set in LeadEngine, shown wherever this person is listed. */
  avatarUrl: string | null
  /**
   * May lead a visit: their role holds Laporan kunjungan → Buat, so they
   * can write the report the sales utama owes. Anyone listed may support.
   */
  canLead: boolean
}

/**
 * People who can be put on a mission: every active member of any company
 * in the group who has Sales Mission access, with whether the matrix lets
 * them lead. Read through a definer function, because membership rows live
 * under each unit and row security shows a unit member only their own
 * unit's rows. Membership itself is LeadEngine's; Sales Mission never
 * writes it. Memoised per request: a page asks for this list several times.
 */
export const listTenantSales = cache(async (access: SalesMissionAccess): Promise<TenantSalesOption[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase.schema("sales_mission").rpc("fn_group_people")
  if (error) console.error("[listTenantSales]", error.code, error.message)
  const rows = (data ?? []) as Array<{ id: string; full_name: string; email: string | null; avatar_url: string | null; can_lead: boolean | null }>
  return rows.map((row) => ({
    id: row.id,
    name: row.full_name,
    email: row.email ?? null,
    avatarUrl: row.avatar_url?.trim() || null,
    canLead: row.can_lead !== false,
  }))
})

/** Ids of everyone who may be put on a mission, for checking a submitted team. */
export async function listAssignableIds(access: SalesMissionAccess): Promise<{ members: Set<string>; leads: Set<string> }> {
  const people = await listTenantSales(access)
  return {
    members: new Set(people.map((person) => person.id)),
    leads: new Set(people.filter((person) => person.canLead).map((person) => person.id)),
  }
}

/**
 * Every active member's upcoming visits, keyed by user, for the schedule
 * picker. One query for the tenant rather than one per person: the picker
 * re-reads this as the assignees change and must not cost a round trip each
 * time.
 *
 * Past visits are left out. They cannot clash with a new one, and a rep's
 * whole history is far more than a picker needs to draw.
 */
export async function listTeamSchedules(
  access: SalesMissionAccess,
  from: Date
): Promise<Array<{ userId: string; name: string; blocks: Array<{ missionId: string; scheduledStart: string | null; scheduledEnd: string | null; location: string | null }> }>> {
  const { supabase, missions } = await missionSchema()

  // Through a definer function rather than the table: row security now
  // hides missions outside the viewer's Cakupan lihat, but a clash with a
  // colleague's visit is a clash whoever may see that visit. The function
  // returns times and places, never the client or the purpose.
  const { data: rows, error } = await missions.rpc("fn_schedule_blocks", {
    p_company_id: access.companyId,
    p_user_ids: null,
    p_from: new Date(from.getTime() - 24 * 3600 * 1000).toISOString(),
    p_to: new Date(from.getTime() + 400 * 24 * 3600 * 1000).toISOString(),
  })
  if (error) console.error("[listTeamSchedules]", error.code, error.message)
  const blocks = (rows ?? []) as Array<{ user_id: string; mission_id: string; scheduled_start: string | null; scheduled_end: string | null; location: string | null }>
  if (blocks.length === 0) return []

  const names = await resolveNames(supabase, blocks.map((row) => row.user_id))

  const people = new Map<string, { userId: string; name: string; blocks: Array<{ missionId: string; scheduledStart: string | null; scheduledEnd: string | null; location: string | null }> }>()
  for (const row of blocks) {
    const person = people.get(row.user_id) ?? { userId: row.user_id, name: names.get(row.user_id) ?? "Nama tidak diketahui", blocks: [] }
    person.blocks.push({
      missionId: row.mission_id,
      scheduledStart: row.scheduled_start ?? null,
      scheduledEnd: row.scheduled_end ?? null,
      location: row.location ?? null,
    })
    people.set(row.user_id, person)
  }

  return [...people.values()]
}

/** Why and when a mission was cancelled, from the last CANCELLED history row. */
export async function getCancellation(
  access: SalesMissionAccess,
  missionId: string
): Promise<{ reason: string | null; byName: string; at: string } | null> {
  const { supabase, missions } = await missionSchema()
  const { data } = await missions
    .from("status_history")
    .select("reason, changed_by, created_at")
    .eq("company_id", access.companyId)
    .eq("mission_id", missionId)
    .eq("to_status", "CANCELLED")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data) return null
  const names = await resolveNames(supabase, [data.changed_by as string])
  return {
    reason: (data.reason as string | null) ?? null,
    byName: names.get(data.changed_by as string) ?? "Nama tidak diketahui",
    at: data.created_at as string,
  }
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

  const base = () => missions.from("missions").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("company_id", access.companyId)

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

export interface ReportVersion {
  version: number
  reason: string | null
  changedByName: string | null
  createdAt: string
}

/** The versions a sent report went through, newest first. Empty until it was changed once. */
export async function listReportVersions(access: SalesMissionAccess, reportId: string): Promise<ReportVersion[]> {
  const { supabase, missions } = await missionSchema()
  const { data } = await missions
    .from("visit_report_versions")
    .select("version, reason, changed_by, created_at")
    .eq("company_id", access.companyId)
    .eq("report_id", reportId)
    .order("version", { ascending: false })
  const rows = data ?? []
  const names = await resolveNames(supabase, rows.map((row) => row.changed_by as string))
  return rows.map((row) => ({
    version: Number(row.version),
    reason: (row.reason as string | null) ?? null,
    changedByName: names.get(row.changed_by as string) ?? null,
    createdAt: row.created_at as string,
  }))
}
