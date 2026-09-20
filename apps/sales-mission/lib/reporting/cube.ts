import { KIND_LABELS, type ChoiceSet } from "@/lib/missions/report-choices"
import { UNASSIGNED_LABEL } from "@/lib/reporting/kpi"

/**
 * The cube behind Ringkasan.
 *
 * Every card is one question: a measure (what is counted) over the page's
 * period, grouped by one dimension and optionally split by a second. The
 * six built-in cards and the cards a person composes are the same shape,
 * so the database has one function (`fn_report_cube`) and this module
 * holds what the form may offer, what a saved card must satisfy, and how
 * the rows come back as buckets with labels. Pure: no I/O, no Date in the
 * local timezone (days are `YYYY-MM-DD` strings in mission time).
 */

export const MEASURES = ["visits", "appointments", "planning", "leads_pushed", "opportunities", "estimated_value"] as const
export type Measure = (typeof MEASURES)[number]

/** The platform's own words: a prospect, an activity, a report. */
export const MEASURE_LABELS: Record<Measure, string> = {
  visits: "Laporan",
  appointments: "Aktivitas",
  planning: "Prospek",
  leads_pushed: "Lead ke CRM",
  opportunities: "Peluang",
  estimated_value: "Nilai estimasi",
}

export const MEASURE_HINTS: Record<Measure, string> = {
  visits: "Laporan kunjungan yang sudah dikirim, menurut hari kunjungannya: kunjungan yang benar-benar terjadi.",
  appointments: "Aktivitas terjadwal yang tidak dibatalkan atau ditolak, menurut jadwalnya: janji temu yang disepakati.",
  planning: "Prospek baru yang masuk, menurut tanggal dibuat: rencana yang akan dihubungi.",
  leads_pushed: "Lead yang dikirim ke LeadEngine, menurut tanggal kirim.",
  opportunities: "Laporan terkirim yang menandai adanya peluang.",
  estimated_value: "Jumlah nilai estimasi dari laporan yang menandai peluang, dalam rupiah.",
}

export type Unit = "count" | "currency"
export const MEASURE_UNITS: Record<Measure, Unit> = {
  visits: "count",
  appointments: "count",
  planning: "count",
  leads_pushed: "count",
  opportunities: "count",
  estimated_value: "currency",
}

/** Measures that read prospects; hidden when the viewer has no Lihat on sales_mission_prospect. */
export const PROSPECT_MEASURES: readonly Measure[] = ["planning"]

export const DIMENSIONS = [
  "none",
  "day",
  "week",
  "month",
  "sales",
  "industry",
  "mission_type",
  "client",
  "interest",
  "outcome",
  "lead_category",
  "prospect_status",
] as const
export type Dimension = (typeof DIMENSIONS)[number]

export const TIME_DIMENSIONS = ["day", "week", "month"] as const satisfies readonly Dimension[]
export type TimeDimension = (typeof TIME_DIMENSIONS)[number]

export const DIMENSION_LABELS: Record<Dimension, string> = {
  none: "Tidak dikelompokkan",
  day: "Hari",
  week: "Minggu",
  month: "Bulan",
  sales: "Sales",
  industry: "Industri",
  mission_type: "Jenis aktivitas",
  client: "Klien",
  interest: "Tingkat minat",
  outcome: "Hasil kunjungan",
  lead_category: "Kategori lead",
  prospect_status: "Status prospek",
}

/** Which dimensions each measure carries; anything else comes back as one empty bucket. */
export const APPLICABILITY: Record<Measure, readonly Dimension[]> = {
  visits: ["none", "day", "week", "month", "sales", "industry", "mission_type", "client", "interest", "outcome"],
  opportunities: ["none", "day", "week", "month", "sales", "industry", "mission_type", "client", "interest", "outcome"],
  estimated_value: ["none", "day", "week", "month", "sales", "industry", "mission_type", "client", "interest", "outcome"],
  appointments: ["none", "day", "week", "month", "sales", "industry", "mission_type", "client"],
  planning: ["none", "day", "week", "month", "sales", "industry", "client", "prospect_status"],
  leads_pushed: ["none", "day", "week", "month", "sales", "industry", "mission_type", "client", "lead_category"],
}

/** Dimensions too wide to split by: a series per client, or per day, is noise. */
export const SERIES_FORBIDDEN: readonly Dimension[] = ["client", "day", "week", "month"]

export const CHARTS = ["bars", "hbars", "stacked", "lines", "area", "donut", "pie", "table", "number", "trend"] as const
export type ChartKind = (typeof CHARTS)[number]
export const CHART_LABELS: Record<ChartKind, string> = {
  bars: "Batang tegak",
  hbars: "Batang mendatar",
  stacked: "Batang bertumpuk",
  lines: "Garis",
  area: "Area",
  donut: "Donat",
  pie: "Pai",
  table: "Tabel",
  number: "Angka",
  trend: "Angka + tren",
}

/** The grid's four shapes: 1×1, 2×1, 1×2, 2×2 cells. */
export const WIDGET_SIZES = ["sm", "wide", "tall", "lg"] as const
export type WidgetSize = (typeof WIDGET_SIZES)[number]
export const SIZE_LABELS: Record<WidgetSize, string> = { sm: "Kecil", wide: "Lebar", tall: "Tinggi", lg: "Besar" }

/** Cells a size spans: [columns, rows], on the coarse 2×2 scale the presets are named in. */
export const SIZE_CELLS: Record<WidgetSize, [number, number]> = { sm: [1, 1], wide: [2, 1], tall: [1, 2], lg: [2, 2] }

/** The board: twelve columns, rows of 40px, 16px between cards. */
export const GRID_COLS = 12
export const GRID_ROW_HEIGHT = 40
export const GRID_MARGIN = 16

export interface Box {
  w: number
  h: number
}

/** A preset as a box in grid units: a quarter of the width by ~320px, and so on. */
export const SIZE_BOX: Record<WidgetSize, Box> = { sm: { w: 3, h: 7 }, wide: { w: 6, h: 7 }, tall: { w: 3, h: 14 }, lg: { w: 6, h: 14 } }

/** The smallest box for a minimum size: a chart or a table needs width to read; a number or a list does not. */
export const MIN_BOX: Record<WidgetSize, Box> = { sm: { w: 2, h: 4 }, wide: { w: 4, h: 5 }, tall: { w: 2, h: 8 }, lg: { w: 4, h: 8 } }

export function sizeFromCells(columns: number, rows: number): WidgetSize {
  if (columns >= 2 && rows >= 2) return "lg"
  if (columns >= 2) return "wide"
  if (rows >= 2) return "tall"
  return "sm"
}

/** Whether a size is at least the minimum in both directions. */
export function sizeFits(size: WidgetSize, min: WidgetSize): boolean {
  return SIZE_CELLS[size][0] >= SIZE_CELLS[min][0] && SIZE_CELLS[size][1] >= SIZE_CELLS[min][1]
}

export const WIDGET_MODES = ["umum", "sales"] as const
export type WidgetMode = (typeof WIDGET_MODES)[number]
export const MODE_LABELS: Record<WidgetMode, string> = { umum: "Umum", sales: "Per sales" }

export interface CubeWidget {
  id: string
  kind: "builtin" | "custom"
  source: "cube"
  title: string
  measures: readonly [Measure] | readonly [Measure, Measure]
  group: Dimension
  series?: Dimension
  chart: ChartKind
  size: WidgetSize
  /** Replaces the page's Sales facet for this card; shown as a chip on the card. */
  filters?: { sales?: string[] }
  /** Cards that offer the Umum / Per sales switch; the sales split is loaded alongside. */
  modes?: readonly WidgetMode[]
}

/** Cards the cube cannot express; each has its own loader. */
export interface SpecialWidget {
  id: string
  kind: "builtin"
  source: "daily_reports" | "funnel" | "kpi_strip" | "ai_insight"
  title: string
  size: WidgetSize
  /** The card's own box when no preset fits it (a full-width strip); `size` still names its nearest preset. */
  box?: Box
}

export type WidgetConfig = CubeWidget | SpecialWidget

export function isTimeDimension(dimension: Dimension | undefined): dimension is TimeDimension {
  return dimension !== undefined && (TIME_DIMENSIONS as readonly string[]).includes(dimension)
}

/** Dimensions every chosen measure accepts. */
export function groupsFor(measures: readonly Measure[]): Dimension[] {
  if (measures.length === 0) return []
  return DIMENSIONS.filter((dimension) => measures.every((measure) => APPLICABILITY[measure].includes(dimension)))
}

/** Splits that make sense for the group: not the group itself, not a wide one, and only for a single measure. */
export function seriesFor(measures: readonly Measure[], group: Dimension): Dimension[] {
  if (measures.length !== 1 || group === "none") return []
  return groupsFor(measures).filter((dimension) => dimension !== "none" && dimension !== group && !SERIES_FORBIDDEN.includes(dimension))
}

/**
 * Charts that fit a grouping, the preferred one first (Material data
 * visualisation: comparison → bars, change over time → lines, part of a
 * whole → pie or donut with one measure, a single value → a number).
 */
export function chartsFor(group: Dimension, series: Dimension | undefined, measureCount: 1 | 2): ChartKind[] {
  const split = series !== undefined && series !== "none"
  if (group === "none") return measureCount === 1 ? ["number", "trend", "table"] : ["table"]
  if (isTimeDimension(group)) return split ? ["stacked", "lines", "area", "table"] : ["bars", "lines", "area", "table"]
  if (split) return ["stacked", "table"]
  return measureCount === 1 ? ["hbars", "bars", "donut", "pie", "table"] : ["hbars", "bars", "table"]
}

/** Why a card is not sound, in a sentence, or null. Shared by the form and the saved-layout validation. */
export function validateWidget(config: Pick<CubeWidget, "measures" | "group" | "series" | "chart" | "title">): string | null {
  const measures = config.measures
  if (measures.length < 1 || measures.length > 2) return "Pilih satu ukuran, atau dua untuk dibandingkan."
  if (!measures.every((measure) => (MEASURES as readonly string[]).includes(measure))) return "Ukuran tidak dikenal."
  if (measures.length === 2 && measures[0] === measures[1]) return "Dua ukuran yang dibandingkan harus berbeda."
  if (!config.title.trim() || config.title.trim().length > 60) return "Judul 1 sampai 60 karakter."
  if (!groupsFor(measures).includes(config.group)) return `${DIMENSION_LABELS[config.group] ?? config.group} tidak berlaku untuk ukuran ini.`
  const series = config.series && config.series !== "none" ? config.series : undefined
  if (series) {
    if (measures.length === 2) return "Dua ukuran tidak bisa dipecah lagi."
    if (!seriesFor(measures, config.group).includes(series)) return `Tidak bisa dipecah per ${DIMENSION_LABELS[series]?.toLowerCase() ?? series}.`
  }
  if (!chartsFor(config.group, series, measures.length as 1 | 2).includes(config.chart)) {
    return `Bentuk ${CHART_LABELS[config.chart]?.toLowerCase() ?? config.chart} tidak cocok untuk pengelompokan ini.`
  }
  return null
}

/** "Kunjungan per industri", "Kunjungan vs Appointment per hari", "Peluang per sales · tingkat minat". */
export function defaultTitle(config: Pick<CubeWidget, "measures" | "group" | "series">): string {
  const measures = config.measures.map((measure) => MEASURE_LABELS[measure]).join(" vs ")
  const group = config.group !== "none" ? ` per ${DIMENSION_LABELS[config.group].toLowerCase()}` : ""
  const series = config.series && config.series !== "none" ? ` · ${DIMENSION_LABELS[config.series].toLowerCase()}` : ""
  return `${measures}${group}${series}`
}

export type BuiltinWidget = WidgetConfig & {
  defaultHidden: boolean
  /** One line for the "Tambah widget" sheet. */
  description: string
  /** Needs Lihat on prospects; dropped for viewers without it. */
  needsProspects?: boolean
  /** Needs the unit's Insight AI switch and Lihat on Insight AI; dropped otherwise. */
  needsInsight?: boolean
  /** New to a saved board, the card goes to the top rather than the bottom. */
  first?: boolean
}

const cube = (
  id: string,
  title: string,
  measures: CubeWidget["measures"],
  group: Dimension,
  chart: ChartKind,
  size: WidgetSize,
  extra: Partial<Pick<CubeWidget, "series" | "modes">> & Pick<BuiltinWidget, "defaultHidden" | "description" | "needsProspects">
): BuiltinWidget => ({ id, kind: "builtin", source: "cube", title, measures, group, chart, size, ...extra })

export const BUILTIN_WIDGETS: readonly BuiltinWidget[] = [
  {
    // One card in the grid like any other (Google Analytics Insights):
    // movable, resizable, hideable from Atur widget. It is about today
    // whatever the toolbar says, and its description says so.
    id: "ai_insight",
    kind: "builtin",
    source: "ai_insight",
    title: "Insight hari ini",
    size: "wide",
    box: { w: GRID_COLS, h: 6 },
    defaultHidden: false,
    needsInsight: true,
    first: true,
    description: "3 sampai 5 kalimat yang ditulis AI dari angka hari ini; selalu hari ini, tidak mengikuti periode di atas.",
  },
  cube("visits_per_day", "Laporan per hari", ["visits"], "day", "bars", "wide", {
    modes: ["umum", "sales"],
    defaultHidden: false,
    description: "Berapa laporan kunjungan tiap hari; Per sales menumpuk per orang.",
  }),
  cube("visits_vs_appointments", "Laporan vs aktivitas", ["visits", "appointments"], "day", "bars", "wide", {
    modes: ["umum", "sales"],
    defaultHidden: false,
    description: "Aktivitas yang dijadwalkan dibanding laporan kunjungan yang benar-benar dikirim.",
  }),
  cube("appointments_vs_planning", "Aktivitas vs prospek", ["appointments", "planning"], "day", "bars", "wide", {
    modes: ["umum", "sales"],
    defaultHidden: false,
    needsProspects: true,
    description: "Prospek baru yang masuk dibanding aktivitas yang jadi dijadwalkan.",
  }),
  cube("interest_mix", "Tingkat minat", ["visits"], "interest", "donut", "sm", {
    defaultHidden: false,
    description: "HQL, panas, hangat, dingin, dan tidak berminat dari laporan kunjungan.",
  }),
  cube("visits_by_industry", "Laporan per industri", ["visits"], "industry", "hbars", "sm", {
    defaultHidden: false,
    description: "Industri klien mana yang paling sering dikunjungi.",
  }),
  {
    id: "daily_reports",
    kind: "builtin",
    source: "daily_reports",
    title: "Laporan harian",
    size: "lg",
    defaultHidden: false,
    description: "Daftar laporan kunjungan pada satu hari, dengan tautan ke aktivitasnya.",
  },
  cube("number_visits", "Laporan", ["visits"], "none", "trend", "sm", { defaultHidden: true, description: "Satu angka dengan tren harian: laporan pada periode ini." }),
  cube("number_opportunities", "Peluang", ["opportunities"], "none", "number", "sm", { defaultHidden: true, description: "Satu angka: laporan yang menandai peluang." }),
  cube("number_estimated_value", "Nilai estimasi", ["estimated_value"], "none", "number", "sm", { defaultHidden: true, description: "Satu angka: jumlah nilai estimasi peluang." }),
  cube("number_leads_pushed", "Lead ke CRM", ["leads_pushed"], "none", "number", "sm", { defaultHidden: true, description: "Satu angka: lead yang dikirim ke LeadEngine." }),
  {
    id: "kpi_strip",
    kind: "builtin",
    source: "kpi_strip",
    title: "Angka utama",
    size: "wide",
    defaultHidden: true,
    description: "Next action terbuka, kontak ditemukan, tepat waktu, dan laporan yang perlu klarifikasi.",
  },
  cube("by_client", "Laporan per klien", ["visits"], "client", "hbars", "tall", { defaultHidden: true, description: "Klien yang paling sering dikunjungi." }),
  cube("by_mission_type", "Laporan per jenis aktivitas", ["visits"], "mission_type", "hbars", "tall", { defaultHidden: true, description: "Sales mission, follow-up, dan jenis lainnya." }),
  cube("leads_by_category", "Lead ke CRM per kategori", ["leads_pushed"], "lead_category", "hbars", "tall", { defaultHidden: true, description: "HQL, Hot, Warm, Cold seperti yang dikirim ke LeadEngine." }),
  {
    id: "funnel",
    kind: "builtin",
    source: "funnel",
    title: "Corong prospek",
    size: "tall",
    defaultHidden: true,
    needsProspects: true,
    description: "Dari prospek masuk sampai lead ke CRM, satu tahap per baris.",
  },
]

export const DEFAULT_ORDER: readonly string[] = BUILTIN_WIDGETS.filter((widget) => !widget.defaultHidden).map((widget) => widget.id)
export const DEFAULT_HIDDEN: readonly string[] = BUILTIN_WIDGETS.filter((widget) => widget.defaultHidden).map((widget) => widget.id)

/**
 * The smallest cell a card still reads in (Android home-screen widgets
 * declare the same): an axis chart or a table needs two columns; a
 * number, a donut, a list or the funnel manage in one.
 */
export function minSizeFor(config: WidgetConfig): WidgetSize {
  if (config.source === "daily_reports" || config.source === "kpi_strip" || config.source === "ai_insight") return "wide"
  if (config.source === "funnel") return "sm"
  if (config.source !== "cube") return "wide"
  if (config.group === "none") return "sm"
  if (config.chart === "donut" || config.chart === "pie") return "sm"
  if (config.chart === "hbars" && !(config.series && config.series !== "none")) return "sm"
  return "wide"
}

export function minBoxFor(config: WidgetConfig): Box {
  return MIN_BOX[minSizeFor(config)]
}

/** A box no smaller than the card's minimum in either direction, and never wider than the board. */
export function clampBox(box: Box, min: Box): Box {
  return { w: Math.min(GRID_COLS, Math.max(min.w, Math.round(box.w))), h: Math.max(min.h, Math.round(box.h)) }
}

export function builtinWidget(id: string): BuiltinWidget | undefined {
  return BUILTIN_WIDGETS.find((widget) => widget.id === id)
}

/* ------------------------------------------------------------------ *
 * Rows → buckets
 * ------------------------------------------------------------------ */

export interface CubeRow {
  bucket: string
  series: string
  value: number
}

/** Series key for everything beyond the top N. */
export const OTHER_KEY = "__other__"
/** Bucket or series key for a fact with nothing in that dimension. */
export const UNSET_KEY = ""

/** Calendar arithmetic on a `YYYY-MM-DD` key, in UTC so the local zone never leaks in. */
export function shiftDayKey(key: string, days: number): string {
  const date = new Date(`${key}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** Monday of the ISO week holding `key`. */
export function weekKeyOf(key: string): string {
  const weekday = (new Date(`${key}T00:00:00Z`).getUTCDay() + 6) % 7
  return shiftDayKey(key, -weekday)
}

export function monthKeyOf(key: string): string {
  return key.slice(0, 7)
}

/** Every day, ISO week (as its Monday) or month between `from` and `to`, inclusive. */
export function timeBuckets(group: TimeDimension, from: string, to: string): string[] {
  if (!from || !to || from > to) return []
  const out: string[] = []
  if (group === "day") {
    for (let key = from; key <= to; key = shiftDayKey(key, 1)) out.push(key)
    return out
  }
  if (group === "week") {
    for (let key = weekKeyOf(from); key <= to; key = shiftDayKey(key, 7)) out.push(key)
    return out
  }
  let key = `${monthKeyOf(from)}-01`
  const last = monthKeyOf(to)
  while (monthKeyOf(key) <= last) {
    out.push(monthKeyOf(key))
    key = `${monthKeyOf(shiftDayKey(key, 32))}-01`
  }
  return out
}

export interface Pivot {
  /** Bucket keys in display order: the given time buckets, or categories by value descending. */
  buckets: string[]
  /** Series keys in display order: by total descending, the rest folded into OTHER_KEY; [""] when unsplit. */
  series: string[]
  value: (bucket: string, series: string) => number
  totals: Map<string, number>
  seriesTotals: Map<string, number>
  total: number
}

/**
 * Rows to a grid. Time buckets are filled so an empty day is a zero, not a
 * gap; categorical buckets sort by size. Beyond `topSeries` the smaller
 * series fold into one "Lainnya" so a stacked chart stays legible.
 */
export function pivot(rows: CubeRow[], options: { buckets?: string[]; topSeries?: number; series?: string[] } = {}): Pivot {
  const seriesTotals = new Map<string, number>()
  const bucketTotals = new Map<string, number>()
  for (const row of rows) {
    seriesTotals.set(row.series, (seriesTotals.get(row.series) ?? 0) + row.value)
    bucketTotals.set(row.bucket, (bucketTotals.get(row.bucket) ?? 0) + row.value)
  }

  let series: string[]
  if (options.series) {
    series = [...options.series]
  } else {
    series = [...seriesTotals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([key]) => key)
    if (series.length === 0) series = [UNSET_KEY]
  }
  const folded = new Set<string>()
  if (options.topSeries && series.length > options.topSeries) {
    for (const key of series.slice(options.topSeries)) folded.add(key)
    series = [...series.slice(0, options.topSeries), OTHER_KEY]
  }

  const cells = new Map<string, number>()
  const cellKey = (bucket: string, key: string) => `${bucket} ${key}`
  for (const row of rows) {
    const key = folded.has(row.series) ? OTHER_KEY : row.series
    const id = cellKey(row.bucket, key)
    cells.set(id, (cells.get(id) ?? 0) + row.value)
  }

  let buckets: string[]
  if (options.buckets) {
    buckets = [...options.buckets]
  } else {
    buckets = [...bucketTotals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([key]) => key)
  }
  const totals = new Map<string, number>()
  for (const bucket of buckets) totals.set(bucket, bucketTotals.get(bucket) ?? 0)
  const outSeriesTotals = new Map<string, number>()
  for (const key of series) {
    outSeriesTotals.set(
      key,
      key === OTHER_KEY ? [...folded].reduce((sum, item) => sum + (seriesTotals.get(item) ?? 0), 0) : (seriesTotals.get(key) ?? 0)
    )
  }

  return {
    buckets,
    series,
    value: (bucket, key) => cells.get(cellKey(bucket, key)) ?? 0,
    totals,
    seriesTotals: outSeriesTotals,
    total: rows.reduce((sum, row) => sum + row.value, 0),
  }
}

/** Whole-number percentages that sum to exactly 100 (largest remainder); all zero when the total is zero. */
export function shares(values: number[]): number[] {
  const total = values.reduce((sum, value) => sum + value, 0)
  if (total <= 0) return values.map(() => 0)
  const raw = values.map((value) => (value / total) * 100)
  const floors = raw.map((value) => Math.floor(value))
  let remaining = 100 - floors.reduce((sum, value) => sum + value, 0)
  const order = raw
    .map((value, index) => ({ index, fraction: value - floors[index] }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
  for (const { index } of order) {
    if (remaining <= 0) break
    floors[index] += 1
    remaining -= 1
  }
  return floors
}

/** Part of whole as a whole percentage, or null when there is no whole. */
export function ratio(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null
}

/* ------------------------------------------------------------------ *
 * Labels
 * ------------------------------------------------------------------ */

export interface LabelContext {
  /** User id → display name, for the sales dimension. */
  people: ReadonlyMap<string, string>
  /** The tenant's report choices, so an outcome or interest kind can be turned into the codes a list filters by. */
  choices?: ChoiceSet | null
}

/**
 * Where a bar-list row leads when tapped: the list that answers "which
 * ones?", narrowed to the row. A pair is listed only when that list has a
 * facet for the grouping and a period, so the count on the card and the
 * rows in the list agree. Prospects have no period facet, so `planning`
 * never links; a time grouping is the period itself, so it never links.
 */
export interface ListDrill {
  list: "activities" | "reports"
  dimension: "industry" | "mission_type" | "sales" | "client" | "outcome" | "interest"
  /** Extra facets that pin the list to the measure (an opportunity, a pushed lead). */
  extra?: Record<string, string>
}

export function listDrill(measure: Measure, group: Dimension): ListDrill | null {
  if (measure === "appointments") {
    if (group === "industry" || group === "mission_type" || group === "sales" || group === "client") return { list: "activities", dimension: group }
    return null
  }
  const reportGroup = group === "sales" || group === "client" || group === "outcome" || group === "interest" ? group : null
  if (!reportGroup) return null
  if (measure === "visits") return { list: "reports", dimension: reportGroup }
  if (measure === "opportunities" || measure === "estimated_value") return { list: "reports", dimension: reportGroup, extra: { opp: "1" } }
  if (measure === "leads_pushed" && (reportGroup === "sales" || reportGroup === "client")) return { list: "reports", dimension: reportGroup, extra: { pushed: "1" } }
  return null
}

/** The value the list's facet takes for a bucket key, or null when no list can name it (an unset bucket, an unknown kind). */
export function drillParam(drill: ListDrill, key: string, ctx: LabelContext): string | null {
  switch (drill.dimension) {
    case "industry":
      return key || "__none__"
    case "sales":
      return key ? key : drill.list === "reports" ? "none" : null
    case "mission_type":
    case "client":
      return key || null
    case "outcome":
    case "interest": {
      const field = drill.dimension === "outcome" ? "visit_outcome" : "interest_level"
      const codes = (ctx.choices?.[field] ?? []).filter((choice) => choice.kind === key).map((choice) => choice.code)
      return codes.length ? codes.join(",") : null
    }
  }
}

const PROSPECT_STATUS_LABELS: Record<string, string> = {
  open: "Belum dihubungi",
  in_progress: "Sedang dihubungi",
  won: "Confirmed",
  lost: "Ditolak",
}

const UNSET_LABEL = "Belum diisi"
const OTHER_LABEL = "Lainnya"
const FORMER_MEMBER = "Mantan anggota"

const dayFormat = new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", day: "numeric", month: "short" })
const dayLongFormat = new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" })
const monthFormat = new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", month: "short", year: "numeric" })

const asDate = (key: string) => new Date(`${key}T00:00:00Z`)

/** A label for a bucket key, in the reader's words. */
export function bucketLabel(dimension: Dimension, key: string, ctx: LabelContext, options: { long?: boolean } = {}): string {
  if (key === OTHER_KEY) return OTHER_LABEL
  switch (dimension) {
    case "day":
      return (options.long ? dayLongFormat : dayFormat).format(asDate(key))
    case "week": {
      const end = shiftDayKey(key, 6)
      const startDate = asDate(key)
      const endDate = asDate(end)
      if (monthKeyOf(key) === monthKeyOf(end)) return `${startDate.getUTCDate()}–${dayFormat.format(endDate)}`
      return `${dayFormat.format(startDate)}–${dayFormat.format(endDate)}`
    }
    case "month":
      return monthFormat.format(asDate(`${key}-01`))
    case "sales":
      if (key === UNSET_KEY) return UNASSIGNED_LABEL
      return ctx.people.get(key) ?? FORMER_MEMBER
    case "interest":
      return key === UNSET_KEY ? UNSET_LABEL : (KIND_LABELS.interest_level[key] ?? key)
    case "outcome":
      return key === UNSET_KEY ? UNSET_LABEL : (KIND_LABELS.visit_outcome[key] ?? key)
    case "prospect_status":
      return key === UNSET_KEY ? UNSET_LABEL : (PROSPECT_STATUS_LABELS[key] ?? key)
    case "none":
      return ""
    default:
      return key === UNSET_KEY ? UNSET_LABEL : key
  }
}
