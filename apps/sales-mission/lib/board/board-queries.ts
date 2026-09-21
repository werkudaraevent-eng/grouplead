import { createServiceClient } from "@/utils/supabase/service"
import { mapMissions, type AssignmentRow, type MissionListItem, type MissionRow, type ReportStateMap } from "@/lib/missions/mission-schema"
import { DEFAULT_REPORT_CHOICES } from "@/lib/missions/report-choices"
import { boardRangeBounds, buildBoardSnapshot, type BoardSnapshot, type BoardSnapshotOptions } from "./board-snapshot"
import { missionDayKey } from "@/lib/missions/mission-calendar"

/**
 * Board data for one tenant.
 *
 * Uses the service client because the TV board has no session. That makes the
 * `company_id` filter the only thing standing between one tenant's board and
 * another's, so it is applied to every query here and the company id is a
 * required argument rather than something resolved inside.
 */

const MISSION_COLUMNS =
  "id, client_company_name_snapshot, client_company_id, mission_type, status, objective, location, scheduled_start, scheduled_end, allow_join, created_by, created_at"

/**
 * Missions with their people, for one tenant and one window, with no viewer.
 *
 * Shared by the TV board and the public calendar: both are opened by something
 * holding a token rather than someone holding a session, so both need the same
 * "read this company's missions, resolve the names, no viewerRole" shape.
 * `mapMissions` without a viewer id yields null join state, which is exactly
 * right for a page with no one to join.
 */
export async function listMissionsForCompany(
  companyId: string,
  window: { since: Date | string; until: Date | string }
): Promise<MissionListItem[]> {
  const supabase = createServiceClient()
  const schema = supabase.schema("sales_mission")
  const at = (value: Date | string) => (value instanceof Date ? value.toISOString() : value)

  const { data: missionRows } = await schema
    .from("missions")
    .select(MISSION_COLUMNS)
    .is("deleted_at", null)
    .eq("company_id", companyId)
    .gte("scheduled_start", at(window.since))
    .lte("scheduled_start", at(window.until))
    .order("scheduled_start", { ascending: true, nullsFirst: false })

  const missions = (missionRows ?? []) as MissionRow[]
  if (missions.length === 0) return []

  const { data: assignmentRows } = await schema
    .from("assignments")
    .select("mission_id, user_id, assignment_role, response")
    .eq("company_id", companyId)
    .in("mission_id", missions.map((mission) => mission.id))

  const assignments = (assignmentRows ?? []) as AssignmentRow[]
  const userIds = [...new Set(assignments.map((row) => row.user_id))]
  const names = new Map<string, string>()

  if (userIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds)
    for (const profile of profiles ?? []) {
      const name = (profile.full_name as string | null)?.trim()
      if (name) names.set(profile.id as string, name)
    }
  }

  // Report state per mission, the same shape the signed-in list carries:
  // whether it was written down and, when the screen may show it, what it said.
  const [{ data: reportRows }, choices] = await Promise.all([
    schema
      .from("visit_reports")
      .select("mission_id, status, visit_outcome")
      .eq("company_id", companyId)
      .in("mission_id", missions.map((mission) => mission.id)),
    listOutcomeChoices(companyId),
  ])
  const reports: ReportStateMap = new Map()
  for (const row of reportRows ?? []) {
    const outcome = (row.visit_outcome as string | null) ?? null
    reports.set(row.mission_id as string, {
      status: row.status as "DRAFT" | "SUBMITTED" | "NEEDS_CLARIFICATION",
      visitOutcome: outcome,
      visitOutcomeLabel: outcome ? (choices.get(outcome)?.label ?? outcome) : null,
    })
  }

  return mapMissions(missions, assignments, names, undefined, reports)
}

/**
 * The tenant's outcome choices by code: the label the admin gave and the
 * locked kind the wall colours by. The defaults fill in for a tenant that
 * never opened the editor, the same seed the form uses.
 */
export async function listOutcomeChoices(companyId: string): Promise<Map<string, { label: string; kind: string }>> {
  const supabase = createServiceClient()
  const result = new Map<string, { label: string; kind: string }>()
  for (const seed of DEFAULT_REPORT_CHOICES) {
    if (seed.fieldKey === "visit_outcome") result.set(seed.code, { label: seed.label, kind: seed.kind })
  }
  const { data } = await supabase
    .schema("sales_mission")
    .from("report_choices")
    .select("code, label, kind")
    .eq("company_id", companyId)
    .eq("field_key", "visit_outcome")
  for (const row of data ?? []) result.set(row.code as string, { label: row.label as string, kind: row.kind as string })
  return result
}

/**
 * Everyone who can be put on a visit, for a page with no session.
 *
 * The signed-in list (`listTenantSales`) goes through `fn_group_people`, which
 * asks whether the caller belongs to the group — a question a public page
 * cannot answer. `fn_group_people_all` is the same list without that check,
 * granted to service_role only, and it feeds nothing but the Sales facet.
 */
export async function listBoardPeople(): Promise<Array<{ id: string; name: string; avatarUrl: string | null }>> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.schema("sales_mission").rpc("fn_group_people_all")
  if (error) console.error("[listBoardPeople]", error.code, error.message)
  const rows = (data ?? []) as Array<{ id: string; full_name: string; avatar_url: string | null }>
  return rows.map((row) => ({ id: row.id, name: row.full_name, avatarUrl: row.avatar_url?.trim() || null }))
}

export async function getBoardSnapshot(
  companyId: string,
  now: Date,
  options: BoardSnapshotOptions
): Promise<BoardSnapshot> {
  const supabase = createServiceClient()
  const schema = supabase.schema("sales_mission")

  // Only the days on the board, not the tenant's whole history; the one
  // all-days number ("mission berjalan") is counted separately.
  const [from, to] = boardRangeBounds(options.range ?? "today", missionDayKey(now))
  const [missions, choices, { count: openCount }] = await Promise.all([
    listMissionsForCompany(companyId, { since: `${from}T00:00:00+07:00`, until: `${to}T23:59:59.999+07:00` }),
    options.showOutcomes ? listOutcomeChoices(companyId) : Promise.resolve(new Map<string, { label: string; kind: string }>()),
    schema
      .from("missions")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("company_id", companyId)
      .in("status", ["SCHEDULED", "ASSIGNED", "ACCEPTED", "IN_PROGRESS"]),
  ])

  const outcomeKinds = new Map([...choices].map(([code, choice]) => [code, choice.kind]))
  const snapshot = buildBoardSnapshot(missions, now, { ...options, outcomeKinds })
  return { ...snapshot, counts: { ...snapshot.counts, openMissions: openCount ?? snapshot.counts.openMissions } }
}
