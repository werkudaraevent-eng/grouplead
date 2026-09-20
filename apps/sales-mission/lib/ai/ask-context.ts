/**
 * What "Tanya AI" is allowed to know: the period's numbers, computed by the
 * same cube the widgets use, through the person's own session, so row
 * security and the page's Sales facet bound the answer exactly as they
 * bound the board. Compact by construction: a dozen small tables, labelled
 * in the product's words, never raw rows.
 */

import type { SalesMissionAccess } from "@/lib/sales-mission-access"
import { queryCube } from "@/lib/reporting/dashboard-queries"
import { getProspectFunnel } from "@/lib/prospects/prospect-page-queries"
import { bucketLabel, type Dimension, type LabelContext, type Measure } from "@/lib/reporting/cube"

export interface AskContext {
  period: { from: string; to: string; label: string }
  /** Names of the people the board is narrowed to, or "semua". */
  people: string
  totals: Record<string, number>
  breakdowns: Record<string, Array<{ label: string; value: number }>>
  prospects: Record<string, number>
}

const MEASURE_WORDS: Record<Measure, string> = {
  visits: "laporan_terkirim",
  appointments: "aktivitas_terjadwal",
  planning: "prospek_baru",
  leads_pushed: "lead_ke_leadengine",
  opportunities: "laporan_dengan_peluang",
  estimated_value: "nilai_estimasi_rupiah",
}

const BREAKDOWNS: Array<{ measure: Measure; group: Dimension; key: string; limit: number }> = [
  { measure: "visits", group: "sales", key: "laporan_per_sales", limit: 15 },
  { measure: "appointments", group: "sales", key: "aktivitas_per_sales", limit: 15 },
  { measure: "visits", group: "industry", key: "laporan_per_industri", limit: 12 },
  { measure: "appointments", group: "industry", key: "aktivitas_per_industri", limit: 12 },
  { measure: "visits", group: "outcome", key: "laporan_per_hasil", limit: 8 },
  { measure: "visits", group: "interest", key: "laporan_per_minat", limit: 6 },
  { measure: "visits", group: "mission_type", key: "laporan_per_jenis_aktivitas", limit: 8 },
  { measure: "visits", group: "client", key: "laporan_per_klien", limit: 12 },
  { measure: "opportunities", group: "sales", key: "peluang_per_sales", limit: 15 },
  { measure: "estimated_value", group: "sales", key: "nilai_estimasi_per_sales", limit: 15 },
  { measure: "visits", group: "week", key: "laporan_per_minggu", limit: 10 },
  { measure: "appointments", group: "week", key: "aktivitas_per_minggu", limit: 10 },
  { measure: "leads_pushed", group: "sales", key: "lead_per_sales", limit: 15 },
]

export async function buildAskContext(
  access: SalesMissionAccess,
  range: { from: string; to: string },
  sales: string[],
  ctx: LabelContext,
  canSeeProspects: boolean
): Promise<AskContext> {
  const salesFilter = sales.length ? sales : null
  const totalsEntries = await Promise.all(
    (Object.keys(MEASURE_WORDS) as Measure[])
      .filter((measure) => canSeeProspects || measure !== "planning")
      .map(async (measure) => {
        const rows = await queryCube(access, { measure, group: "none", series: "none", from: range.from, to: range.to, sales: salesFilter })
        return [MEASURE_WORDS[measure], rows.reduce((sum, row) => sum + row.value, 0)] as const
      })
  )
  const breakdownEntries = await Promise.all(
    BREAKDOWNS.map(async ({ measure, group, key, limit }) => {
      const rows = await queryCube(access, { measure, group, series: "none", from: range.from, to: range.to, sales: salesFilter })
      const list = rows
        .map((row) => ({ label: bucketLabel(group, row.bucket, ctx), value: row.value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, limit)
      return [key, list] as const
    })
  )
  const funnel = canSeeProspects ? await getProspectFunnel(access, range) : null

  return {
    period: { from: range.from, to: range.to, label: `${range.from} sampai ${range.to} (WIB)` },
    people: sales.length ? sales.map((id) => ctx.people.get(id) ?? "?").join(", ") : "semua",
    totals: Object.fromEntries(totalsEntries),
    breakdowns: Object.fromEntries(breakdownEntries.filter(([, list]) => list.length > 0)),
    prospects: funnel
      ? { total: funnel.total, dihubungi: funnel.contacted, sedang_dihubungi: funnel.inProgress, confirmed: funnel.confirmed, selesai: funnel.completed, lead_dikirim: funnel.leadPushed }
      : {},
  }
}
