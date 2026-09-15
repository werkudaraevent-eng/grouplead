import { createClient } from "@/utils/supabase/server"
import type { SalesMissionAccess } from "@/lib/sales-mission-access"
import { DEFAULT_PROSPECT_STATUSES, type ProspectStatus, type StatusColor, type StatusKind } from "./prospect-status"

const STATUS_COLUMNS = "id, code, label, kind, color, is_active, display_order"

type StatusRow = {
  id: string
  code: string
  label: string
  kind: string
  color: string
  is_active: boolean
  display_order: number
}

function toStatus(row: StatusRow): ProspectStatus {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    kind: row.kind as StatusKind,
    color: row.color as StatusColor,
    isActive: row.is_active,
    displayOrder: row.display_order,
  }
}

/**
 * The tenant's statuses, seeding the defaults on first use the same way
 * listFormFields seeds core fields: insert what is missing, ignore what is
 * there, so a relabelled status is never overwritten.
 */
export async function listProspectStatuses(
  access: SalesMissionAccess,
  options: { includeArchived?: boolean } = {}
): Promise<ProspectStatus[]> {
  const supabase = await createClient()
  const schema = supabase.schema("sales_mission")

  const read = async () => {
    let query = schema
      .from("prospect_statuses")
      .select(STATUS_COLUMNS)
      .eq("company_id", access.companyId)
      .order("display_order", { ascending: true })
    if (!options.includeArchived) query = query.eq("is_active", true)
    const { data } = await query
    return (data ?? []).map((row) => toStatus(row as StatusRow))
  }

  let statuses = await read()
  const present = new Set(statuses.map((status) => status.code))
  const missing = DEFAULT_PROSPECT_STATUSES.filter((seed) => !present.has(seed.code))
  // Only seed the anchors a tenant lacks entirely: a tenant that archived
  // "In Progress" and made its own must not get the default back.
  const needed = statuses.length === 0 ? missing : missing.filter((seed) => !statuses.some((status) => status.kind === seed.kind))

  if (needed.length > 0) {
    await schema.from("prospect_statuses").upsert(
      needed.map((seed) => ({
        company_id: access.companyId,
        code: seed.code,
        label: seed.label,
        kind: seed.kind,
        color: seed.color,
        display_order: seed.displayOrder,
      })),
      { onConflict: "company_id,code", ignoreDuplicates: true }
    )
    statuses = await read()
  }

  return statuses
}

/** How many live prospects sit in each status. */
export async function countProspectsByStatus(access: SalesMissionAccess, statusIds: string[]): Promise<Record<string, number>> {
  const supabase = await createClient()
  const counts = await Promise.all(
    statusIds.map(async (statusId) => {
      const { count } = await supabase
        .schema("sales_mission")
        .from("prospects")
        .select("id", { count: "exact", head: true })
        .eq("company_id", access.companyId)
        .eq("status_id", statusId)
        .is("deleted_at", null)
      return [statusId, count ?? 0] as const
    })
  )
  return Object.fromEntries(counts)
}
