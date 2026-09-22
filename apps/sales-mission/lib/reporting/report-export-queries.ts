import { summarizeFollowUpsByReport } from "@/lib/missions/follow-up-queries"
import type { ChoiceSet } from "@/lib/missions/report-choices"
import type { SalesMissionAccess } from "@/lib/sales-mission-access"
import type { ReportStatus } from "@/lib/missions/visit-report-schema"
import { createClient } from "@/utils/supabase/server"
import type { ExportContact, ExportSupportingNote, ReportExportRow } from "./report-export"

/**
 * Read side of the visit-report export.
 *
 * Everything goes through the person's own session, so row security answers
 * "whose reports are these" exactly as it does on the screen that linked here;
 * the company filter is stated on every query anyway, as everywhere else. No
 * service client: an export is the last place to widen what someone may read.
 *
 * Set-based, chunked at 500 ids like the list's hydration, because an export
 * of a quarter is thousands of reports and a query per report would be a
 * minute of round trips.
 */

const REPORT_COLUMNS =
  "id, mission_id, status, visit_outcome, meeting_summary, client_needs, product_interest, interest_level, opportunity_exists, estimated_value, competitor_mentioned, next_action_type, next_action_owner, follow_up_date, actual_start, actual_end, clarification_note, submitted_by, submitted_at"

const MISSION_COLUMNS =
  "id, client_company_name_snapshot, mission_type, location, address, industry, objective, scheduled_start, scheduled_end"

const CONTACT_COLUMNS =
  "report_id, full_name, job_title, phone, email, is_decision_maker, disc_primary, disc_secondary, disc_note, disc_assessed_by_name, disc_assessed_at, created_at"

const chunk = <T,>(list: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, index) => list.slice(index * size, (index + 1) * size))

const str = (value: unknown): string | null => {
  const text = typeof value === "string" ? value.trim() : ""
  return text === "" ? null : text
}

const list = (value: unknown): string[] => (Array.isArray(value) ? value.map(String).filter(Boolean) : [])

/**
 * Every report of the export, in the order the ids were given, with the
 * activity, the people, the answers, the notes, the follow-up and the lead
 * push already resolved. The builder turns this into cells; nothing here
 * decides how anything is written.
 */
export async function loadReportExport(
  access: SalesMissionAccess,
  ids: string[],
  choices: ChoiceSet | null
): Promise<ReportExportRow[]> {
  if (ids.length === 0) return []

  const supabase = await createClient()
  const schema = supabase.schema("sales_mission")

  const reportRows: Record<string, unknown>[] = []
  for (const part of chunk(ids, 500)) {
    const { data } = await schema
      .from("visit_reports")
      .select(REPORT_COLUMNS)
      .eq("company_id", access.companyId)
      .in("id", part)
    reportRows.push(...((data ?? []) as Record<string, unknown>[]))
  }
  if (reportRows.length === 0) return []

  const reportIds = reportRows.map((row) => row.id as string)
  const missionIds = [...new Set(reportRows.map((row) => row.mission_id as string))]

  const missionById = new Map<string, Record<string, unknown>>()
  const primaryByMission = new Map<string, string>()
  const supportingByMission = new Map<string, string[]>()
  const pushByMission = new Map<string, { leadId: string; category: string | null }>()
  const contactsByReport = new Map<string, ExportContact[]>()
  const customByReport = new Map<string, Record<string, unknown>>()
  const noteRowsByMission = new Map<string, Array<{ authorId: string | null; note: string; createdAt: string }>>()

  await Promise.all([
    ...chunk(missionIds, 500).map(async (part) => {
      const { data } = await schema
        .from("missions")
        .select(MISSION_COLUMNS)
        .is("deleted_at", null)
        .eq("company_id", access.companyId)
        .in("id", part)
      for (const row of data ?? []) missionById.set(row.id as string, row as Record<string, unknown>)
    }),
    ...chunk(missionIds, 500).map(async (part) => {
      const { data } = await schema
        .from("assignments")
        .select("mission_id, user_id, assignment_role")
        .eq("company_id", access.companyId)
        .in("mission_id", part)
      for (const row of data ?? []) {
        const missionId = row.mission_id as string
        if (row.assignment_role === "PRIMARY") primaryByMission.set(missionId, row.user_id as string)
        else if (row.assignment_role === "SUPPORTING") {
          const current = supportingByMission.get(missionId)
          if (current) current.push(row.user_id as string)
          else supportingByMission.set(missionId, [row.user_id as string])
        }
      }
    }),
    ...chunk(missionIds, 500).map(async (part) => {
      const { data } = await schema
        .from("lead_pushes")
        .select("mission_id, lead_engine_lead_id, category")
        .eq("company_id", access.companyId)
        .in("mission_id", part)
      for (const row of data ?? []) {
        pushByMission.set(row.mission_id as string, {
          leadId: String(row.lead_engine_lead_id),
          category: str(row.category),
        })
      }
    }),
    ...chunk(missionIds, 500).map(async (part) => {
      const { data } = await schema
        .from("supporting_notes")
        .select("mission_id, author_id, note, created_at")
        .eq("company_id", access.companyId)
        .in("mission_id", part)
        .order("created_at", { ascending: true })
      for (const row of data ?? []) {
        const missionId = row.mission_id as string
        const item = {
          authorId: (row.author_id as string | null) ?? null,
          note: (row.note as string) ?? "",
          createdAt: row.created_at as string,
        }
        const current = noteRowsByMission.get(missionId)
        if (current) current.push(item)
        else noteRowsByMission.set(missionId, [item])
      }
    }),
    ...chunk(reportIds, 500).map(async (part) => {
      const { data } = await schema
        .from("report_contacts")
        .select(CONTACT_COLUMNS)
        .eq("company_id", access.companyId)
        .in("report_id", part)
        .order("created_at", { ascending: true })
      for (const row of data ?? []) {
        const reportId = row.report_id as string
        const contact: ExportContact = {
          fullName: (row.full_name as string) ?? "",
          jobTitle: str(row.job_title),
          phone: str(row.phone),
          email: str(row.email),
          isDecisionMaker: Boolean(row.is_decision_maker),
          discPrimary: str(row.disc_primary),
          discSecondary: str(row.disc_secondary),
          discNote: str(row.disc_note),
          discAssessedByName: str(row.disc_assessed_by_name),
          discAssessedAt: (row.disc_assessed_at as string | null) ?? null,
        }
        const current = contactsByReport.get(reportId)
        if (current) current.push(contact)
        else contactsByReport.set(reportId, [contact])
      }
    }),
    ...chunk(reportIds, 500).map(async (part) => {
      const { data } = await schema
        .from("report_field_values")
        .select("report_id, reporting_key, value")
        .eq("company_id", access.companyId)
        .in("report_id", part)
      for (const row of data ?? []) {
        const reportId = row.report_id as string
        const answers = customByReport.get(reportId) ?? {}
        answers[row.reporting_key as string] = row.value
        customByReport.set(reportId, answers)
      }
    }),
  ])

  const userIds = [
    ...new Set(
      [
        ...primaryByMission.values(),
        ...[...supportingByMission.values()].flat(),
        ...[...noteRowsByMission.values()].flat().map((note) => note.authorId),
        ...reportRows.map((row) => row.next_action_owner as string | null),
        ...reportRows.map((row) => row.submitted_by as string | null),
      ].filter((value): value is string => Boolean(value))
    ),
  ]

  const names = new Map<string, string>()
  for (const part of chunk(userIds, 500)) {
    const { data } = await supabase.from("profiles").select("id, full_name").in("id", part)
    for (const profile of data ?? []) {
      const name = (profile.full_name as string | null)?.trim()
      if (name) names.set(profile.id as string, name)
    }
  }

  const followUps = await summarizeFollowUpsByReport(access, reportIds, choices)

  const nameOf = (id: string | null | undefined): string | null => (id ? names.get(id) ?? null : null)
  const order = new Map(ids.map((id, index) => [id, index]))

  return reportRows
    // A report whose activity was binned between the id page and this read has
    // no mission row; drop it, as the list does.
    .filter((row) => missionById.has(row.mission_id as string))
    .sort((a, b) => (order.get(a.id as string) ?? 0) - (order.get(b.id as string) ?? 0))
    .map((row) => {
      const reportId = row.id as string
      const missionId = row.mission_id as string
      const mission = missionById.get(missionId)!
      const push = pushByMission.get(missionId) ?? null
      const followUp = followUps.get(reportId) ?? null
      const notes: ExportSupportingNote[] = (noteRowsByMission.get(missionId) ?? []).map((note) => ({
        authorName: nameOf(note.authorId),
        note: note.note,
        createdAt: note.createdAt,
      }))

      return {
        reportId,
        missionId,
        clientCompanyName: (mission.client_company_name_snapshot as string) ?? "",
        missionType: (mission.mission_type as string) ?? "",
        scheduledStart: (mission.scheduled_start as string | null) ?? null,
        scheduledEnd: (mission.scheduled_end as string | null) ?? null,
        actualStart: (row.actual_start as string | null) ?? null,
        actualEnd: (row.actual_end as string | null) ?? null,
        location: str(mission.location),
        address: str(mission.address),
        industry: str(mission.industry),
        objective: str(mission.objective),
        primarySalesName: nameOf(primaryByMission.get(missionId)),
        supportingSalesNames: (supportingByMission.get(missionId) ?? [])
          .map((id) => nameOf(id))
          .filter((name): name is string => Boolean(name)),
        status: row.status as ReportStatus,
        visitOutcome: str(row.visit_outcome),
        meetingSummary: str(row.meeting_summary),
        clientNeeds: list(row.client_needs),
        productInterest: list(row.product_interest),
        interestLevel: str(row.interest_level),
        opportunityExists: Boolean(row.opportunity_exists),
        estimatedValue:
          row.estimated_value === null || row.estimated_value === undefined ? null : Number(row.estimated_value),
        competitorMentioned: str(row.competitor_mentioned),
        nextActionType: str(row.next_action_type),
        nextActionOwnerName: nameOf(row.next_action_owner as string | null),
        followUpDate: (row.follow_up_date as string | null) ?? null,
        custom: customByReport.get(reportId) ?? {},
        contacts: contactsByReport.get(reportId) ?? [],
        clarificationNote: str(row.clarification_note),
        supportingNotes: notes,
        pushedLeadId: push?.leadId ?? null,
        pushedCategory: push?.category ?? null,
        followUp: followUp ? { status: followUp.status, dueDate: followUp.dueDate } : null,
        submittedByName: nameOf(row.submitted_by as string | null),
        submittedAt: (row.submitted_at as string | null) ?? null,
      }
    })
}
