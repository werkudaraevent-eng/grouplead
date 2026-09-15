import { createClient } from "@/utils/supabase/server"
import type { SalesMissionAccess } from "@/lib/sales-mission-access"
import { listProspectsByIds } from "./prospect-queries"
import { MANUAL_SOURCE, UNASSIGNED, ZERO_UUID, splitStatusFacet, type ProspectQuery } from "./prospect-filter"
import type { ProspectSort } from "./prospect-paging"
import type { ProspectListItem } from "./prospect-schema"

/**
 * One page of the prospect list, filtered and ordered in the database by
 * fn_list_prospects, then hydrated by id. See the mission list for the
 * reasoning; this is the same pipeline.
 */

export interface ProspectPageRequest {
  query: ProspectQuery
  sort: ProspectSort
  page: number
  size: number
  /** YYYY-MM-DD in mission time, the day "due" is measured against. */
  today: string
}

const orNull = <T,>(list: T[]): T[] | null => (list.length > 0 ? list : null)

function rpcArgs(access: SalesMissionAccess, request: Omit<ProspectPageRequest, "page" | "size">, page: number, size: number) {
  const q = request.query.q.trim().replace(/[\\%_]/g, (match) => `\\${match}`)
  const { statusIds, states } = splitStatusFacet(request.query.status)
  const owner = request.query.owner.map((value) => (value === UNASSIGNED ? ZERO_UUID : value))
  const batch = request.query.batch.map((value) => (value === MANUAL_SOURCE ? ZERO_UUID : value))
  return {
    p_company_id: access.companyId,
    p_q: q || null,
    p_status: orNull(statusIds),
    p_state: orNull(states),
    p_owner: orNull(owner),
    p_batch: orNull(batch),
    p_due: request.query.due ? request.today : null,
    p_sort: request.sort,
    p_page: page,
    p_size: size,
  }
}

export async function listProspectIdsPage(access: SalesMissionAccess, request: ProspectPageRequest): Promise<{ ids: string[]; total: number }> {
  const supabase = await createClient()
  const { data, error } = await supabase.schema("sales_mission").rpc("fn_list_prospects", rpcArgs(access, request, request.page, request.size))
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as Array<{ id: string; total: number | string }>
  return { ids: rows.map((row) => row.id), total: rows.length > 0 ? Number(rows[0].total) : 0 }
}

export async function listProspectsPage(access: SalesMissionAccess, request: ProspectPageRequest): Promise<{ items: ProspectListItem[]; total: number }> {
  const { ids, total } = await listProspectIdsPage(access, request)
  const items = await listProspectsByIds(access, ids)
  return { items, total }
}

export async function countProspects(access: SalesMissionAccess, request: Omit<ProspectPageRequest, "page" | "size">): Promise<number> {
  const { total } = await listProspectIdsPage(access, { ...request, page: 0, size: 1 })
  return total
}

/** Every matching id, capped so a typo cannot pull the whole list. */
export async function listMatchingProspectIds(
  access: SalesMissionAccess,
  request: Omit<ProspectPageRequest, "page" | "size">,
  cap = 500
): Promise<{ ids: string[]; total: number }> {
  return listProspectIdsPage(access, { ...request, page: 0, size: cap })
}

export interface ProspectFunnel {
  total: number
  contacted: number
  inProgress: number
  confirmed: number
  completed: number
  leadPushed: number
}

export async function getProspectFunnel(access: SalesMissionAccess, range: { from: string; to: string } | null): Promise<ProspectFunnel> {
  const supabase = await createClient()
  const { data } = await supabase.schema("sales_mission").rpc("fn_prospect_funnel", {
    p_company_id: access.companyId,
    p_from: range?.from ?? null,
    p_to: range?.to ?? null,
  })
  const row = ((data ?? []) as Array<Record<string, number | string>>)[0] ?? {}
  const n = (key: string) => Number(row[key] ?? 0)
  return { total: n("total"), contacted: n("contacted"), inProgress: n("in_progress"), confirmed: n("confirmed"), completed: n("completed"), leadPushed: n("lead_pushed") }
}

/** Existing prospects hit by the import's keys, for the duplicate check. */
export async function findProspectDuplicates(
  access: SalesMissionAccess,
  keys: { phones: string[]; pairs: string[] }
): Promise<Array<{ matchKey: string; clientCompanyName: string; contactName: string | null }>> {
  const supabase = await createClient()
  const chunk = <T,>(list: T[], size: number) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size))
  const results: Array<{ matchKey: string; clientCompanyName: string; contactName: string | null }> = []
  const calls: Array<{ phones: string[]; pairs: string[] }> = []
  for (const phones of chunk(keys.phones, 1000)) calls.push({ phones, pairs: [] })
  for (const pairs of chunk(keys.pairs, 1000)) calls.push({ phones: [], pairs })
  for (const call of calls) {
    const { data } = await supabase.schema("sales_mission").rpc("fn_prospect_dedupe", {
      p_company_id: access.companyId,
      p_phones: call.phones.length ? call.phones : null,
      p_pairs: call.pairs.length ? call.pairs : null,
    })
    for (const row of (data ?? []) as Array<{ match_key: string; client_company_name: string; contact_name: string | null }>) {
      results.push({ matchKey: row.match_key, clientCompanyName: row.client_company_name, contactName: row.contact_name })
    }
  }
  return results
}
