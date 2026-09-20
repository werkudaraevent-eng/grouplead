import { createClient } from "@/utils/supabase/server"
import { getReadScope, type SalesMissionAccess } from "@/lib/sales-mission-access"
import { insightHref, type InsightItem, type InsightRecord, type InsightScope } from "./insights"

/** What the card shows: the record with each item's link resolved. */
export interface InsightView {
  status: InsightRecord["status"]
  items: Array<InsightItem & { href: string | null }>
  generatedAt: string | null
  model: string | null
  error: string | null
  trigger: InsightRecord["trigger"]
  reportsSeen: number
  scope: InsightScope
  day: string
}

export function toInsightView(record: InsightRecord): InsightView {
  return {
    status: record.status,
    items: record.items.map((item) => ({ ...item, href: insightHref(item.link, record.day) })),
    generatedAt: record.generatedAt,
    model: record.model,
    error: record.error,
    trigger: record.trigger,
    reportsSeen: record.reportsSeen,
    scope: record.scope,
    day: record.day,
  }
}

/**
 * Whose insight this person gets: the unit's when their reach on the module
 * is Semua, otherwise their own, built from the people their reach covers
 * (themselves, plus their team when the reach is Tim).
 */
export async function resolveInsightScope(access: SalesMissionAccess): Promise<{ scope: InsightScope; userId: string | null; salesIds: ReadonlySet<string> | null }> {
  const reach = await getReadScope(access, "sales_mission_ai")
  if (reach === "all") return { scope: "unit", userId: null, salesIds: null }
  const ids = new Set<string>([access.userId])
  if (reach === "team") {
    const supabase = await createClient()
    const { data } = await supabase.schema("sales_mission").rpc("fn_my_subordinate_ids")
    for (const row of (data ?? []) as Array<string | { fn_my_subordinate_ids?: string }>) {
      const id = typeof row === "string" ? row : row.fn_my_subordinate_ids
      if (id) ids.add(id)
    }
  }
  return { scope: "person", userId: access.userId, salesIds: ids }
}

