import { createClient } from "@/utils/supabase/server"
import type { SalesMissionAccess } from "@/lib/sales-mission-access"
import {
  mapMissions,
  type AssignmentRow,
  type MissionListItem,
  type MissionRow,
} from "./mission-schema"

/**
 * Read side of the mission domain.
 *
 * Every query is scoped by `company_id` in addition to RLS. RLS is the security
 * boundary; the explicit filter keeps the intent visible at the call site and
 * stops a policy change from silently widening a list.
 */

const MISSION_COLUMNS =
  "id, client_company_name_snapshot, client_company_id, mission_type, status, objective, location, scheduled_start, scheduled_end, created_by, created_at"

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

  return mapMissions(missionRows as MissionRow[], assignments, names)
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

  return mapMissions([missionRow as MissionRow], assignments, names)[0] ?? null
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
