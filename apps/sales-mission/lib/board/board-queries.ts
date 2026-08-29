import { createServiceClient } from "@/utils/supabase/service"
import { mapMissions, type AssignmentRow, type MissionRow } from "@/lib/missions/mission-schema"
import { buildBoardSnapshot, type BoardSnapshot } from "./board-snapshot"

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

export async function getBoardSnapshot(
  companyId: string,
  now: Date,
  options: { masked: boolean }
): Promise<BoardSnapshot> {
  const supabase = createServiceClient()
  const schema = supabase.schema("sales_mission")

  const { data: missionRows } = await schema
    .from("missions")
    .select(MISSION_COLUMNS)
    .eq("company_id", companyId)
    .order("scheduled_start", { ascending: true, nullsFirst: false })

  const missions = (missionRows ?? []) as MissionRow[]
  if (missions.length === 0) return buildBoardSnapshot([], now, options)

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

  return buildBoardSnapshot(mapMissions(missions, assignments, names), now, options)
}
