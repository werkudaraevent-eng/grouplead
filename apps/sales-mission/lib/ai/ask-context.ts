/**
 * What "Tanya AI" is allowed to know, all read through the person's own
 * session so row security and the page's Sales facet bound the answer
 * exactly as they bound the board:
 *
 * - the period's numbers, computed by the same cube the widgets use (a
 *   dozen small tables labelled in the product's words);
 * - the rows behind them, capped: the period's activities and reports,
 *   today's and tomorrow's activities whatever the period, prospects whose
 *   next contact is due, and the roster, so "who has none" and "where is
 *   everyone this morning" can be answered (the rows are what the Daftar
 *   and Aktivitas tabs show, so an answer can still be checked there).
 *
 * A capped list says so, and the totals stay whole, so the model never
 * mistakes a slice for everything.
 */

import type { SalesMissionAccess } from "@/lib/sales-mission-access"
import { queryCube } from "@/lib/reporting/dashboard-queries"
import { getProspectFunnel, listProspectsPage } from "@/lib/prospects/prospect-page-queries"
import { EMPTY_PROSPECT_QUERY } from "@/lib/prospects/prospect-filter"
import { listMissions } from "@/lib/missions/mission-queries"
import { listReportsPage } from "@/lib/reporting/report-list-queries"
import { EMPTY_REPORT_QUERY } from "@/lib/reporting/report-filter"
import { bucketLabel, type Dimension, type LabelContext, type Measure } from "@/lib/reporting/cube"
import type { ChoiceSet } from "@/lib/missions/report-choices"
import { shiftDay, wibDayOf, wibDayStart } from "./insight-facts"
import { capByNearestDay, capList, hourBuckets, toActivityRow, toProspectRow, toReportRow, type ActivityRow, type CappedList, type ProspectRow, type ReportRow } from "./ask-rows"

/** Rows handed over at most; the totals say how many there really are. */
export const ROW_CAPS = { activities: 150, reports: 150, day: 60, prospects: 50 } as const

export interface AskContext {
  period: { from: string; to: string; label: string }
  hari_ini: string
  /** Names of the people the board is narrowed to, or "semua". */
  people: string
  /** Everyone on the unit's sales list, so "who has no …" can be answered. */
  daftar_sales: string[]
  totals: Record<string, number>
  breakdowns: Record<string, Array<{ label: string; value: number }>>
  prospects: Record<string, number>
  aktivitas_hari_ini: CappedList<ActivityRow>
  aktivitas_besok: CappedList<ActivityRow>
  aktivitas_periode: CappedList<ActivityRow>
  aktivitas_periode_per_jam: Record<string, number>
  laporan_periode: CappedList<ReportRow>
  prospek_jatuh_tempo: CappedList<ProspectRow>
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
  canSeeProspects: boolean,
  options: { now: Date; choices: ChoiceSet | null; roster: Array<{ id: string; name: string }> }
): Promise<AskContext> {
  const salesFilter = sales.length ? sales : null
  const today = wibDayOf(options.now)
  const tomorrow = shiftDay(today, 1)
  const inScope = (mission: { primarySalesId: string | null; assigneeIds: string[] }) =>
    !salesFilter || salesFilter.some((id) => id === mission.primarySalesId || mission.assigneeIds.includes(id))

  // The rows, read alongside the cube. Today and tomorrow are read whatever
  // the period, because that is what people ask on the road.
  const [periodMissions, nearMissions, reports, dueProspects] = await Promise.all([
    listMissions(access, { since: wibDayStart(range.from), until: wibDayStart(shiftDay(range.to, 1)) }),
    listMissions(access, { since: wibDayStart(today), until: wibDayStart(shiftDay(today, 2)) }),
    listReportsPage(
      access,
      {
        query: { ...EMPTY_REPORT_QUERY, status: ["SUBMITTED", "NEEDS_CLARIFICATION"], sales, date: "custom", from: range.from, to: range.to },
        sort: "submitted:desc",
        page: 0,
        size: ROW_CAPS.reports,
        now: options.now,
      },
      options.choices
    ),
    canSeeProspects
      ? listProspectsPage(access, { query: { ...EMPTY_PROSPECT_QUERY, owner: sales, due: true }, sort: "due", page: 0, size: ROW_CAPS.prospects, today })
      : Promise.resolve({ items: [], total: 0 }),
  ])
  const periodRows = periodMissions.filter(inScope).map(toActivityRow)
  const nearRows = nearMissions.filter(inScope).map(toActivityRow)
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
    hari_ini: today,
    people: sales.length ? sales.map((id) => ctx.people.get(id) ?? "?").join(", ") : "semua",
    daftar_sales: (salesFilter ? options.roster.filter((person) => salesFilter.includes(person.id)) : options.roster).map((person) => person.name),
    totals: Object.fromEntries(totalsEntries),
    breakdowns: Object.fromEntries(breakdownEntries.filter(([, list]) => list.length > 0)),
    prospects: funnel
      ? { total: funnel.total, dihubungi: funnel.contacted, sedang_dihubungi: funnel.inProgress, confirmed: funnel.confirmed, selesai: funnel.completed, lead_dikirim: funnel.leadPushed }
      : {},
    aktivitas_hari_ini: capList(nearRows.filter((row) => row.tanggal === today), ROW_CAPS.day),
    aktivitas_besok: capList(nearRows.filter((row) => row.tanggal === tomorrow), ROW_CAPS.day),
    aktivitas_periode: capByNearestDay(periodRows, today, ROW_CAPS.activities),
    aktivitas_periode_per_jam: hourBuckets(periodRows),
    laporan_periode: { baris: reports.items.map(toReportRow), total: reports.total, terpotong: reports.total > reports.items.length },
    prospek_jatuh_tempo: { baris: dueProspects.items.map((item) => toProspectRow(item, today)), total: dueProspects.total, terpotong: dueProspects.total > dueProspects.items.length },
  }
}
