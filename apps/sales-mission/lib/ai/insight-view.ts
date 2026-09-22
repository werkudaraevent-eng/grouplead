import { createClient } from "@/utils/supabase/server"
import { canPerform, getReadScope, type SalesMissionAccess } from "@/lib/sales-mission-access"
import { getMissionSettings } from "@/lib/missions/mission-queries"
import { paths } from "@/lib/paths"
import { insightHref, type InsightItem, type InsightRecord, type InsightScope } from "./insights"

/** One piece of evidence behind an item: the activity whose report it came from. */
export interface InsightEvidence {
  missionId: string
  client: string
  href: string
}

export type InsightViewItem = InsightItem & { href: string | null; evidence: InsightEvidence[] }

/** What the card and the brief show: the record with each item's links resolved. */
export interface InsightView {
  status: InsightRecord["status"]
  items: InsightViewItem[]
  generatedAt: string | null
  model: string | null
  error: string | null
  trigger: InsightRecord["trigger"]
  reportsSeen: number
  scope: InsightScope
  day: string
}

/**
 * The record as the view, with the link keys turned into URLs. Evidence
 * needs the clients' names, which only a query can give, so the pure form
 * leaves it empty and `buildInsightView` fills it.
 */
export function toInsightView(record: InsightRecord, clients?: ReadonlyMap<string, string>): InsightView {
  return {
    status: record.status,
    items: record.items.map((item) => ({
      ...item,
      href: insightHref(item.link, record.day),
      evidence: (item.missionIds ?? []).flatMap((missionId) => {
        const client = clients?.get(missionId)
        return client ? [{ missionId, client, href: paths.activity(missionId, { fokus: "laporan" }) }] : []
      }),
    })),
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
 * The view with its evidence links named. The client names come from the
 * person's own session, so an item may never label a link with a record
 * that person cannot open; an id RLS hides simply loses its link.
 */
export async function buildInsightView(access: SalesMissionAccess, record: InsightRecord): Promise<InsightView> {
  const ids = [...new Set(record.items.flatMap((item) => item.missionIds ?? []))]
  if (ids.length === 0) return toInsightView(record)
  const supabase = await createClient()
  const { data } = await supabase
    .schema("sales_mission")
    .from("missions")
    .select("id, client_company_name_snapshot")
    .eq("company_id", access.companyId)
    .in("id", ids)
  const clients = new Map<string, string>()
  for (const row of data ?? []) clients.set(row.id as string, (row.client_company_name_snapshot as string | null) ?? "Klien")
  return toInsightView(record, clients)
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

/** The line that says whose numbers these are, on the card and on the brief. */
export function insightScopeNote(scope: InsightScope): string | null {
  return scope === "person" ? "tentang orang dalam cakupan Anda" : null
}

/** Whether the insight card exists for this person: the unit's switch is on and they may read Insight AI. */
export async function canSeeInsight(access: SalesMissionAccess): Promise<boolean> {
  const [settings, allowed] = await Promise.all([getMissionSettings(access), canPerform(access, "sales_mission_ai", "read")])
  return settings.aiInsightsEnabled && allowed
}
