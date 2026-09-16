import { createServiceClient } from "@/utils/supabase/service"
import { mapMissions, type AssignmentRow, type MissionListItem, type MissionRow } from "@/lib/missions/mission-schema"

/**
 * One person's visits for their calendar feed.
 *
 * Read through the service client, because the calendar server that fetches
 * the feed has no session. That makes the `company_id` and `user_id` filters
 * the only boundary, so both are required arguments and both are applied to
 * every query. Only visits the person is on (as sales utama or supporting,
 * and has not declined); cancelled ones are included so a subscribed
 * calendar sees the cancellation rather than a silent disappearance.
 */

const FEED_COLUMNS =
  "id, client_company_name_snapshot, client_company_id, mission_type, status, objective, location, scheduled_start, scheduled_end, allow_join, created_by, created_at, updated_at, building, address"

export async function listMissionsForFeed(
  companyId: string,
  userId: string,
  window: { since: Date; until: Date }
): Promise<{ missions: MissionListItem[]; displayName: string | null }> {
  const supabase = createServiceClient()
  const schema = supabase.schema("sales_mission")

  const [{ data: memberships }, { data: profile }] = await Promise.all([
    schema
      .from("assignments")
      .select("mission_id")
      .eq("company_id", companyId)
      .eq("user_id", userId)
      .neq("response", "REJECTED"),
    supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
  ])
  const displayName = (profile?.full_name as string | null)?.trim() || null
  const missionIds = [...new Set((memberships ?? []).map((row) => row.mission_id as string))]
  if (missionIds.length === 0) return { missions: [], displayName }

  const { data: missionRows } = await schema
    .from("missions")
    .select(FEED_COLUMNS)
    .eq("company_id", companyId)
    .in("id", missionIds)
    .is("deleted_at", null)
    .not("scheduled_start", "is", null)
    .gte("scheduled_start", window.since.toISOString())
    .lte("scheduled_start", window.until.toISOString())
    .order("scheduled_start", { ascending: true })

  const missions = (missionRows ?? []) as MissionRow[]
  if (missions.length === 0) return { missions: [], displayName }

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
    for (const row of profiles ?? []) {
      const name = (row.full_name as string | null)?.trim()
      if (name) names.set(row.id as string, name)
    }
  }

  return { missions: mapMissions(missions, assignments, names, userId), displayName }
}
