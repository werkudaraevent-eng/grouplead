import { createServiceClient } from "@/utils/supabase/service"
import { mapMissions, type AssignmentRow, type MissionListItem, type MissionRow } from "@/lib/missions/mission-schema"

/**
 * The visits a calendar feed carries.
 *
 * Read through the service client, because the calendar server that fetches
 * the feed has no session. That makes the `company_id` and `user_id` filters
 * the only boundary, so both are required arguments and both are applied to
 * every query. Cancelled visits are included so a subscribed calendar sees
 * the cancellation rather than a silent disappearance.
 *
 * Two scopes. "own": only visits the person is on (as sales utama or
 * supporting, and has not declined). "team": every visit the person's role
 * may see, decided by the same rule as the missions row-security policy,
 * asked of the database for this user id (`fn_visible_owner_ids_for`): all
 * of the tenant's visits for a read scope of Semua, the visits of the
 * person and their reports_to chain for Tim.
 */

export type FeedScope = "own" | "team"

const FEED_COLUMNS =
  "id, client_company_name_snapshot, client_company_id, mission_type, status, objective, location, scheduled_start, scheduled_end, allow_join, created_by, created_at, updated_at, building, address"

export async function listMissionsForFeed(
  companyId: string,
  userId: string,
  window: { since: Date; until: Date },
  scope: FeedScope = "own"
): Promise<{ missions: MissionListItem[]; displayName: string | null }> {
  const supabase = createServiceClient()
  const schema = supabase.schema("sales_mission")

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle()
  const displayName = (profile?.full_name as string | null)?.trim() || null

  const inWindow = () =>
    schema
      .from("missions")
      .select(FEED_COLUMNS)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .not("scheduled_start", "is", null)
      .gte("scheduled_start", window.since.toISOString())
      .lte("scheduled_start", window.until.toISOString())
      .order("scheduled_start", { ascending: true })

  let missions: MissionRow[] = []
  let assignments: AssignmentRow[] = []

  if (scope === "own") {
    const { data: memberships } = await schema.from("assignments").select("mission_id").eq("company_id", companyId).eq("user_id", userId).neq("response", "REJECTED")
    const missionIds = [...new Set((memberships ?? []).map((row) => row.mission_id as string))]
    if (missionIds.length === 0) return { missions: [], displayName }
    const { data: missionRows } = await inWindow().in("id", missionIds)
    missions = (missionRows ?? []) as MissionRow[]
    if (missions.length === 0) return { missions: [], displayName }
    const { data: assignmentRows } = await schema
      .from("assignments")
      .select("mission_id, user_id, assignment_role, response")
      .eq("company_id", companyId)
      .in("mission_id", missions.map((mission) => mission.id))
    assignments = (assignmentRows ?? []) as AssignmentRow[]
  } else {
    const { data: ownerData, error } = await schema.rpc("fn_visible_owner_ids_for", { p_user: userId, p_module: "sales_mission_mission" })
    if (error) {
      console.error("[calendar feed] visible owners", error.code, error.message)
      return { missions: [], displayName }
    }
    const owners = (ownerData as string[] | null) ?? null
    const { data: missionRows } = await inWindow()
    const candidates = (missionRows ?? []) as MissionRow[]
    if (candidates.length === 0) return { missions: [], displayName }
    const { data: assignmentRows } = await schema
      .from("assignments")
      .select("mission_id, user_id, assignment_role, response")
      .eq("company_id", companyId)
      .in("mission_id", candidates.map((mission) => mission.id))
    assignments = (assignmentRows ?? []) as AssignmentRow[]
    if (owners === null) {
      missions = candidates
    } else {
      // The missions row-security rule, applied here for this user.
      const visible = new Set(owners)
      const byMission = new Map<string, AssignmentRow[]>()
      for (const row of assignments) {
        const list = byMission.get(row.mission_id) ?? []
        list.push(row)
        byMission.set(row.mission_id, list)
      }
      missions = candidates.filter((mission) => {
        if (visible.has(mission.created_by)) return true
        const team = byMission.get(mission.id) ?? []
        return team.some((row) => row.user_id === userId || (row.assignment_role === "PRIMARY" && visible.has(row.user_id)))
      })
    }
    if (missions.length === 0) return { missions: [], displayName }
  }

  const userIds = [...new Set(assignments.map((row) => row.user_id))]
  const names = new Map<string, string>()
  if (userIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds)
    for (const row of profiles ?? []) {
      const name = (row.full_name as string | null)?.trim()
      if (name) names.set(row.id as string, name)
    }
  }

  return { missions: mapMissions(missions, assignments, names, userId), displayName }
}
