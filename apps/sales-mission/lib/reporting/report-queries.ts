import { createClient } from "@/utils/supabase/server"
import type { SalesMissionAccess } from "@/lib/sales-mission-access"
import type {
  InterestLevel,
  NextActionType,
  ReportStatus,
  VisitOutcome,
} from "@/lib/missions/visit-report-schema"
import type { ReportRecord } from "./kpi"

/**
 * Flatten visit reports into the shape the KPI functions expect.
 *
 * Assembled with a handful of set-based queries rather than one per report:
 * reporting reads the whole period at once, so an N+1 here would be felt on
 * every dashboard load.
 */
export async function listReportRecords(access: SalesMissionAccess): Promise<ReportRecord[]> {
  const supabase = await createClient()
  const schema = supabase.schema("sales_mission")

  const { data: reports } = await schema
    .from("visit_reports")
    .select(
      "id, mission_id, status, visit_outcome, interest_level, opportunity_exists, estimated_value, next_action_type, follow_up_date, submitted_at, actual_start, actual_end"
    )
    .eq("company_id", access.companyId)
    .order("submitted_at", { ascending: false, nullsFirst: false })

  if (!reports?.length) return []

  const missionIds = [...new Set(reports.map((row) => row.mission_id as string))]
  const reportIds = reports.map((row) => row.id as string)

  const [{ data: missions }, { data: assignments }, { data: contacts }, { data: pushes }] =
    await Promise.all([
      schema
        .from("missions")
        .select("id, mission_type, client_company_name_snapshot, scheduled_start")
        .is("deleted_at", null)
        .eq("company_id", access.companyId)
        .in("id", missionIds),
      schema
        .from("assignments")
        .select("mission_id, user_id")
        .eq("company_id", access.companyId)
        .eq("assignment_role", "PRIMARY")
        .in("mission_id", missionIds),
      schema
        .from("report_contacts")
        .select("report_id")
        .eq("company_id", access.companyId)
        .in("report_id", reportIds),
      schema
        .from("lead_pushes")
        .select("mission_id, lead_engine_lead_id")
        .eq("company_id", access.companyId)
        .in("mission_id", missionIds),
    ])

  const missionById = new Map(
    (missions ?? []).map((row) => [
      row.id as string,
      {
        missionType: (row.mission_type as string) ?? "—",
        clientCompanyName: (row.client_company_name_snapshot as string) ?? "—",
        scheduledStart: (row.scheduled_start as string | null) ?? null,
      },
    ])
  )

  const primaryByMission = new Map(
    (assignments ?? []).map((row) => [row.mission_id as string, row.user_id as string])
  )

  const userIds = [...new Set(primaryByMission.values())]
  const names = new Map<string, string>()
  if (userIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds)
    for (const profile of profiles ?? []) {
      const name = (profile.full_name as string | null)?.trim()
      if (name) names.set(profile.id as string, name)
    }
  }

  // One pass to count contacts per report rather than a query per report.
  const contactCounts = new Map<string, number>()
  for (const row of contacts ?? []) {
    const key = row.report_id as string
    contactCounts.set(key, (contactCounts.get(key) ?? 0) + 1)
  }

  const pushByMission = new Map(
    (pushes ?? []).map((row) => [row.mission_id as string, row.lead_engine_lead_id as string])
  )

  // A report on a mission in the bin goes with the mission: the missions
  // read above already skips deleted rows, so a report with no mission here
  // is one whose visit was withdrawn, and it must not count.
  return reports.filter((row) => missionById.has(row.mission_id as string)).map((row) => {
    const missionId = row.mission_id as string
    const mission = missionById.get(missionId)
    const primaryId = primaryByMission.get(missionId)

    return {
      missionId,
      missionType: mission?.missionType ?? "—",
      scheduledStart: mission?.scheduledStart ?? null,
      actualStart: (row.actual_start as string | null) ?? null,
      actualEnd: (row.actual_end as string | null) ?? null,
      clientCompanyName: mission?.clientCompanyName ?? "—",
      primarySalesName: primaryId ? names.get(primaryId) ?? null : null,
      reportStatus: row.status as ReportStatus,
      visitOutcome: (row.visit_outcome as VisitOutcome | null) ?? null,
      interestLevel: (row.interest_level as InterestLevel | null) ?? null,
      opportunityExists: Boolean(row.opportunity_exists),
      estimatedValue: row.estimated_value === null ? null : Number(row.estimated_value),
      nextActionType: (row.next_action_type as NextActionType) ?? "NONE",
      followUpDate: (row.follow_up_date as string | null) ?? null,
      submittedAt: (row.submitted_at as string | null) ?? null,
      contactCount: contactCounts.get(row.id as string) ?? 0,
      pushedLeadId: pushByMission.get(missionId) ?? null,
    }
  })
}
