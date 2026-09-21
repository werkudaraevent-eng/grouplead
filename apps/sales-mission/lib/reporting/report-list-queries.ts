import { createClient } from "@/utils/supabase/server"
import type { SalesMissionAccess } from "@/lib/sales-mission-access"
import { summarizeFollowUpsByReport, type FollowUpSummary } from "@/lib/missions/follow-up-queries"
import { labelOf, type ChoiceSet } from "@/lib/missions/report-choices"
import { dateRangeFor } from "@/lib/missions/mission-filter"
import type { ReportStatus } from "@/lib/missions/visit-report-schema"
import type { ReportRecord } from "./kpi"
import { UNASSIGNED_SALES, ZERO_UUID, type ReportQuery } from "./report-filter"
import type { ReportSort } from "./report-paging"

/**
 * Daftar laporan: the page of ids comes from the database (fn_list_reports),
 * the rows are hydrated by id. Same split as the mission list, for the same
 * reason: PostgREST caps a plain select at 1000 rows, an RPC pages.
 */

/** One row of the list: the report, the mission it belongs to, and the people on it, resolved. */
export interface ReportListItem {
  reportId: string
  missionId: string
  clientCompanyName: string
  missionType: string
  location: string | null
  scheduledStart: string | null
  actualStart: string | null
  actualEnd: string | null
  primarySalesId: string | null
  primarySalesName: string | null
  primarySalesAvatarUrl: string | null
  status: ReportStatus
  visitOutcome: string | null
  visitOutcomeLabel: string | null
  interestLevel: string | null
  interestLevelLabel: string | null
  opportunityExists: boolean
  estimatedValue: number | null
  nextActionType: string
  nextActionLabel: string
  nextActionOwnerId: string | null
  nextActionOwnerName: string | null
  followUpDate: string | null
  /** The tracked follow-up, when the unit tracks them and the report has one. */
  followUp: FollowUpSummary | null
  contactCount: number
  pushedLeadId: string | null
  submittedAt: string | null
  updatedAt: string
}

export interface ReportPageRequest {
  query: ReportQuery
  sort: ReportSort
  page: number
  size: number
  now: Date
}

const orNull = <T,>(list: T[]): T[] | null => (list.length > 0 ? list : null)

function rpcArgs(access: SalesMissionAccess, request: Omit<ReportPageRequest, "page" | "size">, page: number, size: number) {
  const range = dateRangeFor(request.query, request.now)
  // ILIKE metacharacters in the search text would otherwise be wildcards.
  const q = request.query.q.trim().replace(/[\\%_]/g, (match) => `\\${match}`)
  const sales = request.query.sales.map((value) => (value === UNASSIGNED_SALES ? ZERO_UUID : value))
  return {
    p_company_id: access.companyId,
    p_q: q || null,
    p_status: orNull(request.query.status),
    p_outcome: orNull(request.query.outcome),
    p_interest: orNull(request.query.interest),
    p_next_action: orNull(request.query.nextAction),
    p_sales: orNull(sales),
    p_opportunity: request.query.opportunity,
    p_pushed: request.query.pushed,
    p_from: range?.[0] ?? null,
    p_to: range?.[1] ?? null,
    p_sort: request.sort,
    p_page: page,
    p_size: size,
  }
}

/** Ids on the page, in order, and how many match in all. */
export async function listReportIdsPage(access: SalesMissionAccess, request: ReportPageRequest): Promise<{ ids: string[]; total: number }> {
  const supabase = await createClient()
  const { data, error } = await supabase.schema("sales_mission").rpc("fn_list_reports", rpcArgs(access, request, request.page, request.size))
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as Array<{ id: string; total: number | string }>
  return { ids: rows.map((row) => row.id), total: rows.length > 0 ? Number(rows[0].total) : 0 }
}

const chunk = <T,>(list: T[], size: number) => Array.from({ length: Math.ceil(list.length / size) }, (_, index) => list.slice(index * size, (index + 1) * size))

/**
 * The given reports, in the given order, hydrated: reports, then missions,
 * primary assignments, lead pushes and contact counts in parallel, then one
 * profiles read for every name. Labels come from the choice set the caller
 * already holds, so the list and the KPI cannot disagree about a code.
 */
export async function listReportsByIds(access: SalesMissionAccess, ids: string[], choices: ChoiceSet | null): Promise<ReportListItem[]> {
  const items = await listReportRows(access, ids, choices)
  if (items.length === 0) return items
  const followUps = await summarizeFollowUpsByReport(access, items.map((item) => item.reportId), choices)
  return items.map((item) => ({ ...item, followUp: followUps.get(item.reportId) ?? null }))
}

async function listReportRows(access: SalesMissionAccess, ids: string[], choices: ChoiceSet | null): Promise<ReportListItem[]> {
  if (ids.length === 0) return []
  const supabase = await createClient()
  const schema = supabase.schema("sales_mission")

  const reportRows: Record<string, unknown>[] = []
  for (const part of chunk(ids, 500)) {
    const { data } = await schema
      .from("visit_reports")
      .select("id, mission_id, status, visit_outcome, interest_level, opportunity_exists, estimated_value, next_action_type, next_action_owner, follow_up_date, actual_start, actual_end, submitted_at, updated_at")
      .eq("company_id", access.companyId)
      .in("id", part)
    reportRows.push(...((data ?? []) as Record<string, unknown>[]))
  }
  if (reportRows.length === 0) return []
  const reportIds = reportRows.map((row) => row.id as string)
  const missionIds = [...new Set(reportRows.map((row) => row.mission_id as string))]

  const missionById = new Map<string, Record<string, unknown>>()
  const primaryByMission = new Map<string, string>()
  const pushByMission = new Map<string, string>()
  const contactCount = new Map<string, number>()
  await Promise.all([
    ...chunk(missionIds, 500).map(async (part) => {
      const { data } = await schema.from("missions").select("id, client_company_name_snapshot, mission_type, location, scheduled_start").is("deleted_at", null).eq("company_id", access.companyId).in("id", part)
      for (const row of data ?? []) missionById.set(row.id as string, row as Record<string, unknown>)
    }),
    ...chunk(missionIds, 500).map(async (part) => {
      const { data } = await schema.from("assignments").select("mission_id, user_id").eq("company_id", access.companyId).eq("assignment_role", "PRIMARY").in("mission_id", part)
      for (const row of data ?? []) primaryByMission.set(row.mission_id as string, row.user_id as string)
    }),
    ...chunk(missionIds, 500).map(async (part) => {
      const { data } = await schema.from("lead_pushes").select("mission_id, lead_engine_lead_id").eq("company_id", access.companyId).in("mission_id", part)
      for (const row of data ?? []) pushByMission.set(row.mission_id as string, String(row.lead_engine_lead_id))
    }),
    ...chunk(reportIds, 500).map(async (part) => {
      const { data } = await schema.from("report_contacts").select("report_id").eq("company_id", access.companyId).in("report_id", part)
      for (const row of data ?? []) contactCount.set(row.report_id as string, (contactCount.get(row.report_id as string) ?? 0) + 1)
    }),
  ])

  const userIds = [...new Set([...primaryByMission.values(), ...reportRows.map((row) => row.next_action_owner as string | null).filter((value): value is string => Boolean(value))])]
  const people = new Map<string, { name: string; avatarUrl: string | null }>()
  if (userIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", userIds)
    for (const profile of profiles ?? []) {
      if (profile.full_name) people.set(profile.id as string, { name: profile.full_name as string, avatarUrl: (profile.avatar_url as string | null)?.trim() || null })
    }
  }

  const order = new Map(ids.map((id, index) => [id, index]))
  return reportRows
    // A report whose mission was binned between the id page and this read has
    // no mission row; drop it, as the RPC would have.
    .filter((row) => missionById.has(row.mission_id as string))
    .sort((a, b) => (order.get(a.id as string) ?? 0) - (order.get(b.id as string) ?? 0))
    .map((row) => {
      const mission = missionById.get(row.mission_id as string)!
      const primaryId = primaryByMission.get(row.mission_id as string) ?? null
      const ownerId = (row.next_action_owner as string | null) ?? null
      const outcome = (row.visit_outcome as string | null) ?? null
      const interest = (row.interest_level as string | null) ?? null
      const nextAction = (row.next_action_type as string) ?? "NONE"
      return {
        reportId: row.id as string,
        missionId: row.mission_id as string,
        clientCompanyName: (mission.client_company_name_snapshot as string) ?? "—",
        missionType: (mission.mission_type as string) ?? "—",
        location: (mission.location as string | null) ?? null,
        scheduledStart: (mission.scheduled_start as string | null) ?? null,
        actualStart: (row.actual_start as string | null) ?? null,
        actualEnd: (row.actual_end as string | null) ?? null,
        primarySalesId: primaryId,
        primarySalesName: primaryId ? (people.get(primaryId)?.name ?? null) : null,
        primarySalesAvatarUrl: primaryId ? (people.get(primaryId)?.avatarUrl ?? null) : null,
        status: row.status as ReportStatus,
        visitOutcome: outcome,
        visitOutcomeLabel: outcome ? labelOf(choices, "visit_outcome", outcome) : null,
        interestLevel: interest,
        interestLevelLabel: interest ? labelOf(choices, "interest_level", interest) : null,
        opportunityExists: Boolean(row.opportunity_exists),
        estimatedValue: row.estimated_value === null || row.estimated_value === undefined ? null : Number(row.estimated_value),
        nextActionType: nextAction,
        nextActionLabel: labelOf(choices, "next_action_type", nextAction),
        nextActionOwnerId: ownerId,
        nextActionOwnerName: ownerId ? (people.get(ownerId)?.name ?? null) : null,
        followUpDate: (row.follow_up_date as string | null) ?? null,
        followUp: null,
        contactCount: contactCount.get(row.id as string) ?? 0,
        pushedLeadId: pushByMission.get(row.mission_id as string) ?? null,
        submittedAt: (row.submitted_at as string | null) ?? null,
        updatedAt: row.updated_at as string,
      }
    })
}

export async function listReportsPage(access: SalesMissionAccess, request: ReportPageRequest, choices: ChoiceSet | null): Promise<{ items: ReportListItem[]; total: number }> {
  const { ids, total } = await listReportIdsPage(access, request)
  const items = await listReportsByIds(access, ids, choices)
  return { items, total }
}

/** Only the count. */
export async function countReports(access: SalesMissionAccess, request: Omit<ReportPageRequest, "page" | "size">): Promise<number> {
  const { total } = await listReportIdsPage(access, { ...request, page: 0, size: 1 })
  return total
}

/** Every matching id, for the export. Capped so a broad filter cannot pull a decade. */
export async function listMatchingReportIds(access: SalesMissionAccess, request: Omit<ReportPageRequest, "page" | "size">, cap = 5000): Promise<{ ids: string[]; total: number }> {
  return listReportIdsPage(access, { ...request, page: 0, size: cap })
}

/** A list row as the KPI/CSV record shape, so both exports share toCsvRows. */
export function toReportRecord(item: ReportListItem): ReportRecord {
  return {
    missionId: item.missionId,
    missionType: item.missionType,
    clientCompanyName: item.clientCompanyName,
    primarySalesName: item.primarySalesName,
    reportStatus: item.status,
    visitOutcome: item.visitOutcome,
    interestLevel: item.interestLevel,
    opportunityExists: item.opportunityExists,
    estimatedValue: item.estimatedValue,
    nextActionType: item.nextActionType,
    followUpDate: item.followUpDate,
    submittedAt: item.submittedAt,
    contactCount: item.contactCount,
    pushedLeadId: item.pushedLeadId,
    scheduledStart: item.scheduledStart,
    actualStart: item.actualStart,
    actualEnd: item.actualEnd,
  }
}
