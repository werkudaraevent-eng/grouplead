import { createClient } from "@/utils/supabase/server"
import type { SalesMissionAccess } from "@/lib/sales-mission-access"
import type { AuditAction, AuditRow } from "./describe-audit"

export interface AuditFilter {
  actorId: string | null
  tableName: string | null
  action: AuditAction | null
  /** YYYY-MM-DD, inclusive, mission time. */
  from: string | null
  to: string | null
  /** Matches the entity label, so "Arunika" finds every event on that mission. */
  q: string
  /** Narrow to one mission, for a per-mission history. */
  missionId: string | null
}

export const EMPTY_AUDIT_FILTER: AuditFilter = {
  actorId: null,
  tableName: null,
  action: null,
  from: null,
  to: null,
  q: "",
  missionId: null,
}

const PAGE = 100

/**
 * A page of the tenant's audit log, newest first.
 *
 * Fetches a little more than a page so the caller can tell whether there is
 * more; grouping by transaction happens after, on the client of this
 * function, because one action can span rows that this cut might split.
 */
export async function listAuditLog(
  access: SalesMissionAccess,
  filter: AuditFilter,
  page: number
): Promise<{ rows: AuditRow[]; hasMore: boolean }> {
  const supabase = await createClient()
  let query = supabase
    .schema("sales_mission")
    .from("audit_log")
    .select("id, actor_id, table_name, action, entity_id, mission_id, entity_label, changes, tx_id, created_at")
    .eq("company_id", access.companyId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(page * PAGE, page * PAGE + PAGE)

  if (filter.actorId) query = query.eq("actor_id", filter.actorId)
  if (filter.tableName) query = query.eq("table_name", filter.tableName)
  if (filter.action) query = query.eq("action", filter.action)
  if (filter.missionId) query = query.eq("mission_id", filter.missionId)
  if (filter.from) query = query.gte("created_at", `${filter.from}T00:00:00+07:00`)
  if (filter.to) query = query.lte("created_at", `${filter.to}T23:59:59.999+07:00`)
  if (filter.q.trim()) {
    const escaped = filter.q.trim().replace(/[%_]/g, (match) => `\\${match}`)
    query = query.ilike("entity_label", `%${escaped}%`)
  }

  const { data } = await query
  const raw = data ?? []
  const hasMore = raw.length > PAGE
  const slice = raw.slice(0, PAGE)

  const actorIds = [...new Set(slice.map((row) => row.actor_id as string | null).filter((id): id is string => Boolean(id)))]
  const names = new Map<string, string>()
  if (actorIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", actorIds)
    for (const profile of profiles ?? []) {
      if (profile.full_name) names.set(profile.id as string, profile.full_name as string)
    }
  }

  return {
    hasMore,
    rows: slice.map((row) => ({
      id: Number(row.id),
      actorId: (row.actor_id as string | null) ?? null,
      actorName: row.actor_id ? names.get(row.actor_id as string) ?? "Nama tidak diketahui" : null,
      tableName: row.table_name as string,
      action: row.action as AuditAction,
      entityId: row.entity_id as string,
      missionId: (row.mission_id as string | null) ?? null,
      entityLabel: (row.entity_label as string | null) ?? null,
      changes: (row.changes as Record<string, unknown>) ?? {},
      txId: Number(row.tx_id),
      createdAt: row.created_at as string,
    })),
  }
}
