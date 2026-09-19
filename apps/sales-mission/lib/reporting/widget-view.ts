import type { ProspectFunnel } from "@/lib/prospects/prospect-page-queries"
import type { KpiSummary } from "@/lib/reporting/kpi"
import type { ReportListItem } from "@/lib/reporting/report-list-queries"
import {
  DIMENSION_LABELS,
  MEASURE_LABELS,
  MEASURE_UNITS,
  OTHER_KEY,
  UNSET_KEY,
  bucketLabel,
  isTimeDimension,
  pivot,
  ratio,
  shares,
  timeBuckets,
  type CubeRow,
  type CubeWidget,
  type Dimension,
  type LabelContext,
  type Measure,
  type Unit,
  type WidgetConfig,
  type WidgetMode,
} from "./cube"
import type { WidgetData } from "./dashboard-queries"

/**
 * Rows → what a card draws. Plain, serialisable data: the page computes
 * it on the server and the client grid only renders, so reordering and
 * resizing never refetch. Colours are tokens, assigned here so a series
 * keeps its colour across every card that shows it.
 */

export interface Series {
  key: string
  label: string
  color: string
}

export interface Category {
  key: string
  label: string
  /** A longer label for tooltips ("Kam, 17 Sep"). */
  long?: string
}

export type WidgetView =
  | { type: "day_bars"; categories: Category[]; series: Series[]; values: number[][]; stacked: boolean; unit: Unit; horizontal: boolean }
  | { type: "lines"; categories: Category[]; series: Series[]; values: number[][]; unit: Unit; area: boolean }
  | { type: "list_bars"; rows: ListRow[]; all: ListRow[]; total: number; unit: Unit; drill: ListDrill | null }
  | { type: "donut"; slices: Array<{ key: string; label: string; value: number; share: number; color: string }>; total: number; unit: Unit; ring: boolean }
  | { type: "number"; value: number; unit: Unit; hint?: string; spark?: number[] }
  | { type: "table"; columns: Array<{ key: string; label: string; unit: Unit | "percent" }>; rows: Array<{ label: string; cells: Array<number | null> }> }
  | { type: "daily"; day: string; items: DailyReportRow[]; total: number }
  | { type: "funnel"; counts: ProspectFunnel }
  | { type: "kpi_strip"; summary: KpiSummary }
  | { type: "empty"; text: string }

/** One row of a bar list. `folded` is set on the "Lainnya" row: how many buckets it stands for. */
export interface ListRow {
  key: string
  label: string
  value: number
  /** Share of the whole total, not of the rows shown. */
  share: number
  color: string
  folded?: number
}

/**
 * Where a row leads when tapped: the list that answers "which ones?". Only
 * the pairs whose list has that facet; anything else has no link.
 */
export interface ListDrill {
  list: "activities" | "reports"
  dimension: "industry" | "mission_type" | "sales"
}

/** The list a bar-list row opens, if that list can be narrowed by this grouping. */
export function listDrill(measure: Measure, group: Dimension): ListDrill | null {
  if (measure === "appointments" && (group === "industry" || group === "mission_type" || group === "sales")) return { list: "activities", dimension: group }
  if ((measure === "visits" || measure === "opportunities" || measure === "estimated_value") && group === "sales") return { list: "reports", dimension: "sales" }
  return null
}

export interface DailyReportRow {
  missionId: string
  client: string
  time: string | null
  salesName: string | null
  salesAvatarUrl: string | null
  outcome: string | null
  interest: string | null
  opportunity: boolean
}

/** Series colours: one measure keeps one token; people take the chart ramp in order; the rest is muted. */
const MEASURE_COLORS: Record<string, string> = {
  visits: "var(--chart-1)",
  appointments: "var(--chart-2)",
  planning: "var(--chart-3)",
  leads_pushed: "var(--chart-4)",
  opportunities: "var(--chart-5)",
  estimated_value: "var(--chart-1)",
}
const INTEREST_COLORS: Record<string, string> = {
  hql: "var(--chart-1)",
  hot: "var(--chart-5)",
  warm: "var(--chart-4)",
  cold: "var(--chart-2)",
  none: "var(--muted-foreground)",
}
const RAMP = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"]
const MUTED = "var(--muted-foreground)"

function seriesColor(dimension: Dimension | "measure", key: string, index: number): string {
  if (key === OTHER_KEY || key === UNSET_KEY) return MUTED
  if (dimension === "measure") return MEASURE_COLORS[key] ?? RAMP[index % RAMP.length]
  if (dimension === "interest") return INTEREST_COLORS[key] ?? MUTED
  return RAMP[index % RAMP.length]
}

const TOP_SERIES = 6
const TOP_ROWS = 12

const category = (dimension: Dimension, key: string, ctx: LabelContext): Category => ({
  key,
  label: bucketLabel(dimension, key, ctx),
  long: dimension === "day" ? bucketLabel(dimension, key, ctx, { long: true }) : undefined,
})

/**
 * The card's view for its configuration, its rows, the person's mode and
 * the page's labels.
 */
export function presentWidget(
  config: WidgetConfig,
  data: WidgetData,
  mode: WidgetMode,
  ctx: LabelContext,
  range: { from: string; to: string }
): WidgetView {
  if (config.source === "daily_reports") {
    if (data.source !== "daily_reports") return { type: "empty", text: "Data tidak tersedia." }
    return {
      type: "daily",
      day: data.day,
      total: data.total,
      items: data.items.map((item) => toDailyRow(item)),
    }
  }
  if (config.source === "funnel") {
    return data.source === "funnel" ? { type: "funnel", counts: data.counts } : { type: "empty", text: "Data tidak tersedia." }
  }
  if (config.source === "kpi_strip") {
    return data.source === "kpi_strip" ? { type: "kpi_strip", summary: data.summary } : { type: "empty", text: "Data tidak tersedia." }
  }
  if (config.source !== "cube" || data.source !== "cube") return { type: "empty", text: "Data tidak tersedia." }
  return presentCube(config, data, mode, ctx, range)
}

function presentCube(
  config: CubeWidget,
  data: Extract<WidgetData, { source: "cube" }>,
  mode: WidgetMode,
  ctx: LabelContext,
  range: { from: string; to: string }
): WidgetView {
  const unit: Unit = MEASURE_UNITS[config.measures[0]]
  const group = config.group
  const split = config.series && config.series !== "none" ? config.series : undefined
  const buckets = isTimeDimension(group) ? timeBuckets(group, range.from, range.to) : undefined
  const perSales = mode === "sales" && config.modes?.includes("sales")

  // One number.
  if (group === "none" && config.measures.length === 1) {
    const rows = data.byMeasure[config.measures[0]]?.umum ?? []
    const value = rows.reduce((sum, row) => sum + row.value, 0)
    if (config.chart === "table") return table([{ key: "value", label: MEASURE_LABELS[config.measures[0]], unit }], [{ label: MEASURE_LABELS[config.measures[0]], cells: [value] }])
    const trendRows = data.byMeasure[config.measures[0]]?.trend
    if (config.chart === "trend" && trendRows) {
      const days = timeBuckets("day", range.from, range.to)
      const daily = pivot(trendRows, { buckets: days })
      return { type: "number", value, unit, spark: days.map((day) => daily.totals.get(day) ?? 0), hint: `${days.length} hari` }
    }
    return { type: "number", value, unit }
  }

  // Two measures: Umum is two series side by side per bucket; Per sales is a table per person.
  if (config.measures.length === 2) {
    const [first, second] = config.measures as readonly [Measure, Measure]
    if (perSales) {
      const a = pivot(data.byMeasure[first]?.sales ?? [], {})
      const b = pivot(data.byMeasure[second]?.sales ?? [], {})
      const people = [...new Set([...a.series, ...b.series])]
      const rows = people
        .map((id) => {
          const x = a.seriesTotals.get(id) ?? 0
          const y = b.seriesTotals.get(id) ?? 0
          return { label: bucketLabel("sales", id, ctx), cells: [y, x, ratio(x, y)], sort: y }
        })
        .sort((p, q) => q.sort - p.sort || p.label.localeCompare(q.label))
        .map(({ label, cells }) => ({ label, cells }))
      return table(
        [
          { key: second, label: MEASURE_LABELS[second], unit: MEASURE_UNITS[second] },
          { key: first, label: MEASURE_LABELS[first], unit },
          { key: "ratio", label: "Rasio", unit: "percent" },
        ],
        rows
      )
    }
    const a = pivot(data.byMeasure[first]?.umum ?? [], { buckets })
    const b = pivot(data.byMeasure[second]?.umum ?? [], { buckets })
    const keys = buckets ?? [...new Set([...a.buckets, ...b.buckets])]
    const categories = keys.map((key) => category(group, key, ctx))
    const series: Series[] = [
      { key: second, label: MEASURE_LABELS[second], color: seriesColor("measure", second, 1) },
      { key: first, label: MEASURE_LABELS[first], color: seriesColor("measure", first, 0) },
    ]
    const values = keys.map((key) => [b.totals.get(key) ?? 0, a.totals.get(key) ?? 0])
    if (config.chart === "table") {
      return table(
        [
          { key: second, label: MEASURE_LABELS[second], unit: MEASURE_UNITS[second] },
          { key: first, label: MEASURE_LABELS[first], unit },
          { key: "ratio", label: "Rasio", unit: "percent" },
        ],
        categories.map((item, index) => ({ label: item.label, cells: [values[index][0], values[index][1], ratio(values[index][1], values[index][0])] }))
      )
    }
    if (config.chart === "lines" || config.chart === "area") return { type: "lines", categories, series, values, unit, area: config.chart === "area" }
    return { type: "day_bars", categories, series, values, stacked: false, unit, horizontal: config.chart === "hbars" }
  }

  // One measure, grouped, optionally split (by the configured series or by sales in Per sales mode).
  const measure = config.measures[0]
  const seriesDimension: Dimension | undefined = perSales ? "sales" : split
  const rows = perSales ? (data.byMeasure[measure]?.sales ?? data.byMeasure[measure]?.umum ?? []) : (data.byMeasure[measure]?.umum ?? [])
  const grid = pivot(rows, { buckets, topSeries: seriesDimension ? TOP_SERIES : undefined })
  const keys = buckets ?? grid.buckets.slice(0, config.chart === "donut" || config.chart === "pie" ? 8 : TOP_ROWS)
  const categories = keys.map((key) => category(group, key, ctx))

  if ((config.chart === "donut" || config.chart === "pie") && !seriesDimension) {
    const values = keys.map((key) => grid.totals.get(key) ?? 0)
    const pct = shares(values)
    const slices = keys.map((key, index) => ({
      key,
      label: bucketLabel(group, key, ctx),
      value: values[index],
      share: pct[index],
      color: seriesColor(group, key, index),
    }))
    return { type: "donut", slices, total: grid.total, unit, ring: config.chart === "donut" }
  }

  if (!seriesDimension) {
    if (config.chart === "table") return table([{ key: measure, label: MEASURE_LABELS[measure], unit }], categories.map((item) => ({ label: item.label, cells: [grid.totals.get(item.key) ?? 0] })))
    if (isTimeDimension(group) || config.chart === "bars") {
      // Standing bars: dates always; names only when asked for.
      const series: Series[] = [{ key: measure, label: MEASURE_LABELS[measure], color: seriesColor("measure", measure, 0) }]
      const values = keys.map((key) => [grid.totals.get(key) ?? 0])
      if (config.chart === "lines" || config.chart === "area") return { type: "lines", categories, series, values, unit, area: config.chart === "area" }
      return { type: "day_bars", categories, series, values, stacked: false, unit, horizontal: false }
    }
    /*
      A bar list shows the top rows and folds the rest into one "Lainnya"
      row, so a category that did not make the cut is still counted and
      the reader can see there is more; the shares are of the whole, so
      the visible rows never add up to a hundred while something is
      hidden. `all` carries every bucket for the "Lihat semua" sheet.
    */
    const color = seriesColor("measure", measure, 0)
    const everyKey = grid.buckets
    const everyValue = everyKey.map((key) => grid.totals.get(key) ?? 0)
    const everyShare = shares(everyValue)
    const all: ListRow[] = everyKey.map((key, index) => ({
      key,
      label: bucketLabel(group, key, ctx),
      value: everyValue[index],
      share: everyShare[index],
      color: key === UNSET_KEY ? MUTED : color,
    }))
    const shown = all.slice(0, TOP_ROWS)
    const rest = all.slice(TOP_ROWS)
    const rows: ListRow[] = rest.length === 0
      ? shown
      : [
          ...shown,
          {
            key: OTHER_KEY,
            label: `Lainnya (${rest.length} ${DIMENSION_LABELS[group].toLowerCase()})`,
            value: rest.reduce((sum, row) => sum + row.value, 0),
            share: rest.reduce((sum, row) => sum + row.share, 0),
            color: MUTED,
            folded: rest.length,
          },
        ]
    return { type: "list_bars", rows, all, total: grid.total, unit, drill: listDrill(measure, group) }
  }

  const series: Series[] = grid.series.map((key, index) => ({ key, label: bucketLabel(seriesDimension, key, ctx), color: seriesColor(seriesDimension, key, index) }))
  const values = keys.map((key) => grid.series.map((item) => grid.value(key, item)))
  if (config.chart === "table") {
    return table(
      series.map((item) => ({ key: item.key, label: item.label, unit })),
      categories.map((item, index) => ({ label: item.label, cells: values[index] }))
    )
  }
  if (config.chart === "lines" || config.chart === "area") return { type: "lines", categories, series, values, unit, area: config.chart === "area" }
  return { type: "day_bars", categories, series, values, stacked: true, unit, horizontal: !isTimeDimension(group) }
}

function table(columns: Array<{ key: string; label: string; unit: Unit | "percent" }>, rows: Array<{ label: string; cells: Array<number | null> }>): WidgetView {
  return { type: "table", columns, rows }
}

const timeFormat = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })

function toDailyRow(item: ReportListItem): DailyReportRow {
  const at = item.actualStart ?? item.scheduledStart
  return {
    missionId: item.missionId,
    client: item.clientCompanyName,
    time: at ? timeFormat.format(new Date(at)) : null,
    salesName: item.primarySalesName,
    salesAvatarUrl: item.primarySalesAvatarUrl,
    outcome: item.visitOutcomeLabel,
    interest: item.interestLevelLabel,
    opportunity: item.opportunityExists,
  }
}

/** A value in the reader's units. */
export function formatValue(value: number | null, unit: Unit | "percent"): string {
  if (value === null) return "—"
  if (unit === "percent") return `${value}%`
  if (unit === "currency") return `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value)}`
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value)
}

/** Short form for axes and chips: 1,2 jt / 850 rb. */
export function formatCompact(value: number, unit: Unit): string {
  if (unit === "currency") {
    if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} M`
    if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`
    if (Math.abs(value) >= 1_000) return `${(value / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 0 })} rb`
  }
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value)
}
