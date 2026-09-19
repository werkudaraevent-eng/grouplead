import { describe, expect, it } from "vitest"
import { builtinWidget, type CubeWidget } from "./cube"
import { formatCompact, formatValue, presentWidget } from "./widget-view"
import type { WidgetData } from "./dashboard-queries"

const ctx = { people: new Map([["u1", "Sri"], ["u2", "Mya"]]) }
const range = { from: "2026-09-15", to: "2026-09-17" }

const cube = (byMeasure: WidgetData extends { source: "cube" } ? never : Record<string, { umum: Array<{ bucket: string; series: string; value: number }>; sales?: Array<{ bucket: string; series: string; value: number }>; trend?: Array<{ bucket: string; series: string; value: number }> }>): WidgetData => ({
  source: "cube",
  byMeasure,
  truncated: false,
})

describe("presentWidget", () => {
  it("draws visits per day with every day present, and stacks per sales in that mode", () => {
    const config = builtinWidget("visits_per_day")!
    const data = cube({
      visits: {
        umum: [{ bucket: "2026-09-15", series: "", value: 2 }, { bucket: "2026-09-17", series: "", value: 1 }],
        sales: [{ bucket: "2026-09-15", series: "u1", value: 2 }, { bucket: "2026-09-17", series: "u2", value: 1 }],
      },
    })
    const umum = presentWidget(config, data, "umum", ctx, range)
    expect(umum.type).toBe("day_bars")
    if (umum.type !== "day_bars") return
    expect(umum.categories.map((item) => item.label)).toEqual(["15 Sep", "16 Sep", "17 Sep"])
    expect(umum.values).toEqual([[2], [0], [1]])
    expect(umum.stacked).toBe(false)

    const sales = presentWidget(config, data, "sales", ctx, range)
    if (sales.type !== "day_bars") throw new Error(sales.type)
    expect(sales.stacked).toBe(true)
    expect(sales.series.map((item) => item.label)).toEqual(["Sri", "Mya"])
    expect(sales.values[0]).toEqual([2, 0])
  })

  it("puts two measures side by side, appointment first, and per sales as a table with a ratio", () => {
    const config = builtinWidget("visits_vs_appointments")!
    const data = cube({
      visits: { umum: [{ bucket: "2026-09-15", series: "", value: 1 }], sales: [{ bucket: "2026-09-15", series: "u1", value: 1 }] },
      appointments: { umum: [{ bucket: "2026-09-15", series: "", value: 2 }], sales: [{ bucket: "2026-09-15", series: "u1", value: 2 }] },
    })
    const umum = presentWidget(config, data, "umum", ctx, range)
    if (umum.type !== "day_bars") throw new Error(umum.type)
    expect(umum.series.map((item) => item.key)).toEqual(["appointments", "visits"])
    expect(umum.values[0]).toEqual([2, 1])
    expect(umum.horizontal).toBe(false)

    const bySalesConfig: CubeWidget = { id: "c_test000001", kind: "custom", source: "cube", title: "Uji", measures: ["visits", "appointments"], group: "sales", chart: "hbars", size: "wide" }
    const bySales = presentWidget(bySalesConfig, data, "umum", ctx, range)
    if (bySales.type !== "day_bars") throw new Error(bySales.type)
    expect(bySales.horizontal).toBe(true)

    const sales = presentWidget(config, data, "sales", ctx, range)
    if (sales.type !== "table") throw new Error(sales.type)
    expect(sales.columns.map((column) => column.label)).toEqual(["Aktivitas", "Laporan", "Rasio"])
    expect(sales.rows[0]).toEqual({ label: "Sri", cells: [2, 1, 50] })
  })

  it("shares a donut to 100 and labels interest kinds", () => {
    const view = presentWidget(builtinWidget("interest_mix")!, cube({ visits: { umum: [{ bucket: "hot", series: "", value: 1 }, { bucket: "warm", series: "", value: 1 }, { bucket: "", series: "", value: 1 }] } }), "umum", ctx, range)
    if (view.type !== "donut") throw new Error(view.type)
    expect(view.slices.reduce((sum, slice) => sum + slice.share, 0)).toBe(100)
    expect(view.slices.map((slice) => slice.label)).toContain("Panas")
    expect(view.slices.map((slice) => slice.label)).toContain("Belum diisi")
  })

  it("lists industries by size", () => {
    const view = presentWidget(builtinWidget("visits_by_industry")!, cube({ visits: { umum: [{ bucket: "Retail", series: "", value: 1 }, { bucket: "Banking", series: "", value: 3 }] } }), "umum", ctx, range)
    if (view.type !== "list_bars") throw new Error(view.type)
    expect(view.rows.map((row) => row.label)).toEqual(["Banking", "Retail"])
    expect(view.rows[0].share).toBe(75)
    expect(view.rows[0].color).toBe("var(--chart-1)")
    expect(view.drill).toBeNull()
  })

  it("folds the rows past the top twelve into Lainnya, with shares of the whole", () => {
    const rows = Array.from({ length: 15 }, (_, i) => ({ bucket: `Industri ${String.fromCharCode(65 + i)}`, series: "", value: 15 - i }))
    const view = presentWidget(builtinWidget("visits_by_industry")!, cube({ visits: { umum: rows } }), "umum", ctx, range)
    if (view.type !== "list_bars") throw new Error(view.type)
    expect(view.rows).toHaveLength(13)
    const other = view.rows[12]
    expect(other.label).toBe("Lainnya (3 industri)")
    expect(other.folded).toBe(3)
    expect(other.value).toBe(3 + 2 + 1)
    expect(view.all).toHaveLength(15)
    expect(view.total).toBe(120)
    // Shares are of all 120 visits, so the visible rows plus Lainnya make 100.
    expect(view.rows.reduce((sum, row) => sum + row.share, 0)).toBe(100)
    expect(view.rows[0].share).toBe(Math.round((15 / 120) * 100))
  })

  it("links a bar list into the list that can answer it", () => {
    const byIndustry: CubeWidget = { id: "c_actind0001", kind: "custom", source: "cube", title: "Aktivitas per industri", measures: ["appointments"], group: "industry", chart: "hbars", size: "sm" }
    const view = presentWidget(byIndustry, cube({ appointments: { umum: [{ bucket: "Retail", series: "", value: 1 }] } }), "umum", ctx, range)
    if (view.type !== "list_bars") throw new Error(view.type)
    expect(view.drill).toEqual({ list: "activities", dimension: "industry" })
    expect(view.rows[0].color).toBe("var(--chart-2)")
    expect(view.rows[0].param).toBe("Retail")
  })

  it("turns an outcome kind into the tenant's codes for the Laporan list, and pins opportunities", () => {
    const choices = {
      visit_outcome: [
        { fieldKey: "visit_outcome", code: "MET_DM", label: "Bertemu DM", kind: "met_decision_maker", displayOrder: 1 },
        { fieldKey: "visit_outcome", code: "MET_OWNER", label: "Bertemu pemilik", kind: "met_decision_maker", displayOrder: 2 },
        { fieldKey: "visit_outcome", code: "ABSENT", label: "Tidak ada", kind: "absent", displayOrder: 3 },
      ],
      interest_level: [],
      next_action_type: [],
    } as unknown as NonNullable<Parameters<typeof presentWidget>[3]["choices"]>
    const byOutcome: CubeWidget = { id: "c_oppout0001", kind: "custom", source: "cube", title: "Peluang per hasil", measures: ["opportunities"], group: "outcome", chart: "hbars", size: "sm" }
    const view = presentWidget(byOutcome, cube({ opportunities: { umum: [{ bucket: "met_decision_maker", series: "", value: 2 }, { bucket: "unknown", series: "", value: 1 }] } }), "umum", { ...ctx, choices }, range)
    if (view.type !== "list_bars") throw new Error(view.type)
    expect(view.drill).toEqual({ list: "reports", dimension: "outcome", extra: { opp: "1" } })
    expect(view.rows[0].param).toBe("MET_DM,MET_OWNER")
    // A kind the tenant has no code for cannot be opened.
    expect(view.rows[1].param).toBeNull()
  })

  it("never links prospects or time groupings", () => {
    const byOwner: CubeWidget = { id: "c_plan000001", kind: "custom", source: "cube", title: "Prospek per sales", measures: ["planning"], group: "sales", chart: "hbars", size: "sm" }
    const view = presentWidget(byOwner, cube({ planning: { umum: [{ bucket: "u1", series: "", value: 1 }] } }), "umum", ctx, range)
    if (view.type !== "list_bars") throw new Error(view.type)
    expect(view.drill).toBeNull()
    expect(view.rows[0].param).toBeNull()
  })

  it("draws a pie without a ring, an area as lines, and a trend under a number", () => {
    const pie: CubeWidget = { id: "c_pie0000001", kind: "custom", source: "cube", title: "Pai", measures: ["visits"], group: "interest", chart: "pie", size: "sm" }
    const pieView = presentWidget(pie, cube({ visits: { umum: [{ bucket: "hot", series: "", value: 2 }] } }), "umum", ctx, range)
    if (pieView.type !== "donut") throw new Error(pieView.type)
    expect(pieView.ring).toBe(false)

    const area: CubeWidget = { id: "c_area000001", kind: "custom", source: "cube", title: "Area", measures: ["visits"], group: "day", chart: "area", size: "wide" }
    const areaView = presentWidget(area, cube({ visits: { umum: [{ bucket: "2026-09-15", series: "", value: 2 }] } }), "umum", ctx, range)
    if (areaView.type !== "lines") throw new Error(areaView.type)
    expect(areaView.area).toBe(true)

    const trend: CubeWidget = { id: "c_trend00001", kind: "custom", source: "cube", title: "Tren", measures: ["visits"], group: "none", chart: "trend", size: "sm" }
    const trendView = presentWidget(trend, cube({ visits: { umum: [{ bucket: "", series: "", value: 3 }], trend: [{ bucket: "2026-09-15", series: "", value: 2 }, { bucket: "2026-09-17", series: "", value: 1 }] } }), "umum", ctx, range)
    if (trendView.type !== "number") throw new Error(trendView.type)
    expect(trendView.value).toBe(3)
    expect(trendView.spark).toEqual([2, 0, 1])
  })

  it("formats units", () => {
    expect(formatValue(1234, "count")).toBe("1.234")
    expect(formatValue(null, "percent")).toBe("—")
    expect(formatValue(1500000, "currency")).toBe("Rp 1.500.000")
    expect(formatCompact(1500000, "currency")).toBe("1,5 jt")
  })
})
