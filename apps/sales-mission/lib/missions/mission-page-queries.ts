import { createClient } from "@/utils/supabase/server"
import type { SalesMissionAccess } from "@/lib/sales-mission-access"
import { listMissionsByIds } from "./mission-queries"
import { dateRangeFor, type MissionFilter, type MissionQuery } from "./mission-filter"
import type { MissionListItem } from "./mission-schema"
import type { MissionSort } from "./mission-paging"

/**
 * One page of the mission list, filtered and ordered in the database.
 *
 * See fn_list_missions in the migration of the same name for the rules; the
 * function returns ids in order plus the total, and the rows are then loaded
 * through the same pipeline every other list uses, so a page looks exactly
 * like the old in-memory list did, just not all of it at once.
 */

export { PAGE_SIZES, SORTS, parsePageParams } from "./mission-paging"
export type { MissionSort, PageSize } from "./mission-paging"

export interface MissionPageRequest {
  query: MissionQuery
  lens: MissionFilter
  sort: MissionSort
  page: number
  size: number
  now: Date
}

const orNull = <T,>(list: T[]): T[] | null => (list.length > 0 ? list : null)

function rpcArgs(access: SalesMissionAccess, request: Omit<MissionPageRequest, "page" | "size">, page: number, size: number) {
  const range = dateRangeFor(request.query, request.now)
  // ILIKE metacharacters in the search text would otherwise be wildcards.
  const q = request.query.q.trim().replace(/[\\%_]/g, (match) => `\\${match}`)
  return {
    p_company_id: access.companyId,
    p_q: q || null,
    p_status: orNull(request.query.status),
    p_type: orNull(request.query.type),
    p_sales: orNull(request.query.sales),
    p_creator: orNull(request.query.creator),
    p_location: orNull(request.query.location),
    p_report: orNull(request.query.report),
    p_from: range?.[0] ?? null,
    p_to: range?.[1] ?? null,
    p_lens: request.lens,
    p_viewer: access.userId,
    p_now: request.now.toISOString(),
    p_sort: request.sort,
    p_page: page,
    p_size: size,
  }
}

/** Ids on the page, in order, and how many match in all. */
export async function listMissionIdsPage(
  access: SalesMissionAccess,
  request: MissionPageRequest
): Promise<{ ids: string[]; total: number }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .schema("sales_mission")
    .rpc("fn_list_missions", rpcArgs(access, request, request.page, request.size))
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as Array<{ id: string; total: number | string }>
  return { ids: rows.map((row) => row.id), total: rows.length > 0 ? Number(rows[0].total) : 0 }
}

export async function listMissionsPage(
  access: SalesMissionAccess,
  request: MissionPageRequest
): Promise<{ items: MissionListItem[]; total: number }> {
  const { ids, total } = await listMissionIdsPage(access, request)
  const items = await listMissionsByIds(access, ids)
  return { items, total }
}

/** Only the count, for the lens chips. */
export async function countMissions(access: SalesMissionAccess, request: Omit<MissionPageRequest, "page" | "size">): Promise<number> {
  const { total } = await listMissionIdsPage(access, { ...request, page: 0, size: 1 })
  return total
}

/** Every matching id, for "select all" and for the export. Capped so a typo cannot pull a decade. */
export async function listMatchingMissionIds(
  access: SalesMissionAccess,
  request: Omit<MissionPageRequest, "page" | "size">,
  cap = 5000
): Promise<{ ids: string[]; total: number }> {
  return listMissionIdsPage(access, { ...request, page: 0, size: cap })
}

/** Distinct types and locations the tenant has used, for the facets. */
export async function listMissionFacets(access: SalesMissionAccess): Promise<{ types: string[]; locations: string[] }> {
  const supabase = await createClient()
  const { data } = await supabase.schema("sales_mission").rpc("fn_mission_facets", { p_company_id: access.companyId })
  const rows = (data ?? []) as Array<{ kind: string; value: string }>
  return {
    types: rows.filter((row) => row.kind === "type").map((row) => row.value),
    locations: rows.filter((row) => row.kind === "location").map((row) => row.value),
  }
}
