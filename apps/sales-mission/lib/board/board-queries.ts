import { createServiceClient } from "@/utils/supabase/service"
import { mapMissions, type AssignmentRow, type MissionRow } from "@/lib/missions/mission-schema"
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
  const [{ data: missionRows }, { count: openCount }] = await Promise.all([
    schema
      .from("missions")
      .select(MISSION_COLUMNS)
      .eq("company_id", companyId)
      .gte("scheduled_start", `${from}T00:00:00+07:00`)
      .lte("scheduled_start", `${to}T23:59:59.999+07:00`)
      .order("scheduled_start", { ascending: true, nullsFirst: false }),
    schema
      .from("missions")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .in("status", ["SCHEDULED", "ASSIGNED", "ACCEPTED", "IN_PROGRESS"]),
  ])

  const missions = (missionRows ?? []) as MissionRow[]
  const withOpenCount = (snapshot: BoardSnapshot): BoardSnapshot => ({
    ...snapshot,
    counts: { ...snapshot.counts, openMissions: openCount ?? snapshot.counts.openMissions },
  })
  if (missions.length === 0) return withOpenCount(buildBoardSnapshot([], now, options))

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

  return withOpenCount(buildBoardSnapshot(mapMissions(missions, assignments, names), now, options))
}
