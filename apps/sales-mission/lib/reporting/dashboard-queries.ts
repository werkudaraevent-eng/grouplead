import { cache } from "react"
import { createClient } from "@/utils/supabase/server"
import type { SalesMissionAccess } from "@/lib/sales-mission-access"
import { listTenantSales } from "@/lib/missions/mission-queries"
import type { ChoiceSet } from "@/lib/missions/report-choices"
import { getProspectFunnel, type ProspectFunnel } from "@/lib/prospects/prospect-page-queries"
import { listReportsPage, type ReportListItem } from "@/lib/reporting/report-list-queries"
import { EMPTY_REPORT_QUERY } from "@/lib/reporting/report-filter"
import { listReportRecords } from "@/lib/reporting/report-queries"
import { buildKpiReport, type KpiSummary } from "@/lib/reporting/kpi"
import { type CubeRow, type Dimension, type LabelContext, type Measure, type WidgetConfig } from "./cube"

/**
 * Reads for Ringkasan. One call of the cube per (measure, group, series,
 * period, sales) and never twice in a request: two cards asking the same
 * question share the answer.
 */

export interface CubeArgs {
  measure: Measure
  group: Dimension
  series: Dimension
  from: string
  to: string
  sales: string[] | null
}

/** PostgREST's default row cap; a result this long may have been cut. */
export const CUBE_ROW_CAP = 1000

const runCube = cache(async (companyId: string, key: string): Promise<CubeRow[]> => {
  const args = JSON.parse(key) as CubeArgs
  const supabase = await createClient()
  const { data, error } = await supabase.schema("sales_mission").rpc("fn_report_cube", {
    p_company_id: companyId,
    p_from: args.from,
    p_to: args.to,
    p_measure: args.measure,
    p_group: args.group,
    p_series: args.series,
    p_sales: args.sales && args.sales.length ? args.sales : null,
  })
  if (error) {
    console.error("[fn_report_cube]", error.code, error.message, key)
    return []
  }
  const rows = (data ?? []) as Array<{ bucket: string; series: string; value: number | string }>
  if (rows.length >= CUBE_ROW_CAP) console.warn("[fn_report_cube] result at the row cap", key)
  return rows.map((row) => ({ bucket: row.bucket ?? "", series: row.series ?? "", value: Number(row.value) || 0 }))
})

export function queryCube(access: SalesMissionAccess, args: CubeArgs): Promise<CubeRow[]> {
  // cache() compares arguments by identity; a string key makes equal asks equal.
  const key = JSON.stringify({ ...args, sales: args.sales && args.sales.length ? [...args.sales].sort() : null })
  return runCube(access.companyId, key)
}

export interface LoadContext {
  range: { from: string; to: string }
  /** The page's Sales facet, resolved ("me" → id). */
  sales: string[]
  /** The daily card's day. */
  day: string
  choices: ChoiceSet
  now: Date
}

export type WidgetData =
  | { source: "cube"; byMeasure: Record<string, { umum: CubeRow[]; sales?: CubeRow[]; trend?: CubeRow[] }>; truncated: boolean }
  | { source: "daily_reports"; day: string; items: ReportListItem[]; total: number }
  | { source: "funnel"; counts: ProspectFunnel }
  | { source: "kpi_strip"; summary: KpiSummary }

/** The rows one card needs, for its configuration and the page's context. */
export async function loadWidgetData(access: SalesMissionAccess, config: WidgetConfig, ctx: LoadContext): Promise<WidgetData> {
  switch (config.source) {
    case "cube": {
      const sales = config.filters?.sales?.length ? config.filters.sales : ctx.sales
      const series = config.series && config.series !== "none" ? config.series : "none"
      const wantsSales = Boolean(config.modes?.includes("sales")) && config.group !== "sales" && series === "none"
      // "Angka + tren" draws the period day by day under the number.
      const wantsTrend = config.chart === "trend" && config.group === "none"
      const byMeasure: Record<string, { umum: CubeRow[]; sales?: CubeRow[]; trend?: CubeRow[] }> = {}
      let truncated = false
      await Promise.all(
        config.measures.map(async (measure) => {
          const base = { measure, group: config.group, from: ctx.range.from, to: ctx.range.to, sales }
          const [umum, split, trend] = await Promise.all([
            queryCube(access, { ...base, series }),
            wantsSales ? queryCube(access, { ...base, series: "sales" }) : Promise.resolve(undefined),
            wantsTrend ? queryCube(access, { ...base, group: "day", series: "none" }) : Promise.resolve(undefined),
          ])
          if (umum.length >= CUBE_ROW_CAP || (split && split.length >= CUBE_ROW_CAP)) truncated = true
          byMeasure[measure] = { umum, sales: split, trend }
        })
      )
      return { source: "cube", byMeasure, truncated }
    }
    case "daily_reports": {
      const { items, total } = await listReportsPage(
        access,
        {
          query: { ...EMPTY_REPORT_QUERY, status: ["SUBMITTED", "NEEDS_CLARIFICATION"], sales: ctx.sales, date: "custom", from: ctx.day, to: ctx.day },
          sort: "actual:asc",
          page: 0,
          size: 50,
          now: ctx.now,
        },
        ctx.choices
      )
      return { source: "daily_reports", day: ctx.day, items, total }
    }
    case "funnel":
      return { source: "funnel", counts: await getProspectFunnel(access, ctx.range) }
    case "kpi_strip": {
      // The old whole-tenant read; hidden by default, so nobody pays for it unknowingly.
      const records = await listReportRecords(access)
      return { source: "kpi_strip", summary: buildKpiReport(records, ctx.now, ctx.range, ctx.choices).summary }
    }
  }
}

/** User ids that appear as a series or bucket, for the label context. */
export function salesIdsSeen(data: WidgetData[]): string[] {
  const ids = new Set<string>()
  const uuid = /^[0-9a-f-]{36}$/i
  for (const item of data) {
    if (item.source !== "cube") continue
    for (const { umum, sales } of Object.values(item.byMeasure)) {
      for (const row of [...umum, ...(sales ?? [])]) {
        if (uuid.test(row.bucket)) ids.add(row.bucket)
        if (uuid.test(row.series)) ids.add(row.series)
      }
    }
  }
  return [...ids]
}

/** Names for the people the cards mention: the tenant's list first, then a profiles read for former members. */
export async function labelContext(access: SalesMissionAccess, seen: string[]): Promise<LabelContext> {
  const people = new Map<string, string>()
  for (const person of await listTenantSales(access)) people.set(person.id, person.name)
  const missing = seen.filter((id) => !people.has(id))
  if (missing.length) {
    const supabase = await createClient()
    const { data } = await supabase.from("profiles").select("id, full_name").in("id", missing)
    for (const row of data ?? []) if (row.full_name) people.set(row.id as string, row.full_name as string)
  }
  return { people }
}
