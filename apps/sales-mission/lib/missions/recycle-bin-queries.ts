import { createClient } from "@/utils/supabase/server"
import type { SalesMissionAccess } from "@/lib/sales-mission-access"
import { purgeCutoff } from "./recycle-bin"

export interface DeletedMission {
  id: string
  clientCompanyName: string
  missionType: string
  location: string | null
  scheduledStart: string | null
  deletedAt: string
  deletedByName: string | null
}

/** What is in the bin, most recently deleted first. */
export async function listDeletedMissions(access: SalesMissionAccess): Promise<DeletedMission[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .schema("sales_mission")
    .from("missions")
    .select("id, client_company_name_snapshot, mission_type, location, scheduled_start, deleted_at, deleted_by")
    .eq("company_id", access.companyId)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })
    .limit(500)
  const rows = data ?? []

  const ids = [...new Set(rows.map((row) => row.deleted_by as string | null).filter((id): id is string => Boolean(id)))]
  const names = new Map<string, string>()
  if (ids.length) {
    const { data: people } = await supabase.from("profiles").select("id, full_name").in("id", ids)
    for (const person of people ?? []) {
      if (person.full_name) names.set(person.id as string, person.full_name as string)
    }
  }

  return rows.map((row) => ({
    id: row.id as string,
    clientCompanyName: (row.client_company_name_snapshot as string) ?? "—",
    missionType: (row.mission_type as string) ?? "—",
    location: (row.location as string | null) ?? null,
    scheduledStart: (row.scheduled_start as string | null) ?? null,
    deletedAt: row.deleted_at as string,
    deletedByName: row.deleted_by ? (names.get(row.deleted_by as string) ?? null) : null,
  }))
}

/**
 * Retention, applied when an admin opens the bin rather than by a scheduler:
 * nothing in the bin needs to vanish at midnight exactly, and the page that
 * shows "3 hari lagi" is the natural moment to make it true. The audit log's
 * DELETE rows keep the full record of each purged mission.
 */
export async function purgeExpiredMissions(access: SalesMissionAccess, now: Date): Promise<number> {
  const supabase = await createClient()
  const { data } = await supabase
    .schema("sales_mission")
    .from("missions")
    .delete()
    .eq("company_id", access.companyId)
    .not("deleted_at", "is", null)
    .lt("deleted_at", purgeCutoff(now))
    .select("id")
  return data?.length ?? 0
}
