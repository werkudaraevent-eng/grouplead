import { describe, expect, it } from "vitest"
import { builtinWidget } from "./cube"
import { formatCompact, formatValue, presentWidget } from "./widget-view"
import type { WidgetData } from "./dashboard-queries"

const ctx = { people: new Map([["u1", "Sri"], ["u2", "Mya"]]) }
const range = { from: "2026-09-15", to: "2026-09-17" }

const cube = (byMeasure: WidgetData extends { source: "cube" } ? never : Record<string, { umum: Array<{ bucket: string; series: string; value: number }>; sales?: Array<{ bucket: string; series: string; value: number }> }>): WidgetData => ({
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

    const sales = presentWidget(config, data, "sales", ctx, range)
    if (sales.type !== "table") throw new Error(sales.type)
    expect(sales.columns.map((column) => column.label)).toEqual(["Appointment", "Kunjungan", "Rasio"])
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
  })

  it("formats units", () => {
    expect(formatValue(1234, "count")).toBe("1.234")
    expect(formatValue(null, "percent")).toBe("—")
    expect(formatValue(1500000, "currency")).toBe("Rp 1.500.000")
    expect(formatCompact(1500000, "currency")).toBe("1,5 jt")
  })
})
