import { describe, expect, it } from "vitest"
import {
  BUILTIN_WIDGETS,
  DEFAULT_HIDDEN,
  DEFAULT_ORDER,
  OTHER_KEY,
  bucketLabel,
  chartsFor,
  defaultTitle,
  groupsFor,
  pivot,
  ratio,
  seriesFor,
  shares,
  timeBuckets,
  validateWidget,
  weekKeyOf,
} from "./cube"

describe("timeBuckets", () => {
  it("fills every day across a month edge", () => {
    expect(timeBuckets("day", "2026-09-29", "2026-10-02")).toEqual(["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"])
  })

  it("knows a leap day", () => {
    expect(timeBuckets("day", "2028-02-28", "2028-03-01")).toEqual(["2028-02-28", "2028-02-29", "2028-03-01"])
  })

  it("keys weeks by their Monday, starting from the week that holds `from`", () => {
    // 2026-09-17 is a Thursday; its week starts on the 14th.
    expect(weekKeyOf("2026-09-17")).toBe("2026-09-14")
    expect(timeBuckets("week", "2026-09-17", "2026-10-01")).toEqual(["2026-09-14", "2026-09-21", "2026-09-28"])
  })

  it("keys months across a year edge", () => {
    expect(timeBuckets("month", "2026-11-15", "2027-02-03")).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"])
  })

  it("is empty for a range that ends before it starts", () => {
    expect(timeBuckets("day", "2026-09-20", "2026-09-19")).toEqual([])
  })
})

describe("pivot", () => {
  const rows = [
    { bucket: "2026-09-15", series: "a", value: 2 },
    { bucket: "2026-09-15", series: "b", value: 1 },
    { bucket: "2026-09-17", series: "a", value: 1 },
    { bucket: "2026-09-17", series: "c", value: 4 },
  ]

  it("fills the given time buckets with zeros", () => {
    const grid = pivot(rows, { buckets: timeBuckets("day", "2026-09-15", "2026-09-17") })
    expect(grid.buckets).toEqual(["2026-09-15", "2026-09-16", "2026-09-17"])
    expect(grid.totals.get("2026-09-16")).toBe(0)
    expect(grid.value("2026-09-16", "a")).toBe(0)
    expect(grid.total).toBe(8)
  })

  it("orders categories and series by size, then name", () => {
    const grid = pivot([
      { bucket: "Retail", series: "", value: 1 },
      { bucket: "Banking", series: "", value: 5 },
      { bucket: "Asuransi", series: "", value: 1 },
    ])
    expect(grid.buckets).toEqual(["Banking", "Asuransi", "Retail"])
    expect(grid.series).toEqual([""])
  })

  it("folds series beyond the top N into Lainnya and keeps the totals", () => {
    const grid = pivot(rows, { topSeries: 2 })
    expect(grid.series).toEqual(["c", "a", OTHER_KEY])
    expect(grid.value("2026-09-15", OTHER_KEY)).toBe(1)
    expect(grid.seriesTotals.get(OTHER_KEY)).toBe(1)
    expect(grid.seriesTotals.get("c")).toBe(4)
  })
})

describe("shares and ratio", () => {
  it("sums to exactly 100", () => {
    expect(shares([1, 1, 1])).toEqual([34, 33, 33])
    expect(shares([0, 0])).toEqual([0, 0])
    expect(shares([2, 1]).reduce((a, b) => a + b, 0)).toBe(100)
  })

  it("has no ratio without a whole", () => {
    expect(ratio(3, 4)).toBe(75)
    expect(ratio(3, 0)).toBeNull()
  })
})

describe("applicability", () => {
  it("intersects the dimensions of two measures", () => {
    expect(groupsFor(["visits", "appointments"])).not.toContain("interest")
    expect(groupsFor(["visits", "appointments"])).toContain("industry")
    expect(groupsFor(["planning"])).toContain("prospect_status")
    expect(groupsFor(["visits"])).not.toContain("prospect_status")
  })

  it("never splits by the group, a wide dimension, or with two measures", () => {
    expect(seriesFor(["visits"], "day")).not.toContain("day")
    expect(seriesFor(["visits"], "day")).not.toContain("client")
    expect(seriesFor(["visits"], "day")).toContain("sales")
    expect(seriesFor(["visits", "appointments"], "day")).toEqual([])
    expect(seriesFor(["visits"], "none")).toEqual([])
  })

  it("offers charts that fit the grouping", () => {
    expect(chartsFor("none", undefined, 1)).toEqual(["number", "trend", "table"])
    expect(chartsFor("day", undefined, 1)).toEqual(["bars", "lines", "area", "table"])
    expect(chartsFor("day", "sales", 1)).toEqual(["stacked", "lines", "area", "table"])
    expect(chartsFor("industry", undefined, 1)).toContain("pie")
    expect(chartsFor("industry", undefined, 1)[0]).toBe("hbars")
    expect(chartsFor("industry", undefined, 1)).toContain("donut")
    expect(chartsFor("industry", undefined, 2)).not.toContain("donut")
  })
})

describe("validateWidget", () => {
  const base = { title: "Uji", measures: ["visits"] as const, group: "day" as const, chart: "bars" as const }

  it("accepts a sound card and every built-in", () => {
    expect(validateWidget(base)).toBeNull()
    for (const widget of BUILTIN_WIDGETS) {
      if (widget.source === "cube") expect(validateWidget(widget), widget.id).toBeNull()
    }
  })

  it("refuses combinations that mean nothing", () => {
    expect(validateWidget({ ...base, measures: ["appointments"], group: "interest" })).toMatch(/tidak berlaku/)
    expect(validateWidget({ ...base, group: "prospect_status" })).toMatch(/tidak berlaku/)
    expect(validateWidget({ ...base, series: "client" })).toMatch(/dipecah/)
    expect(validateWidget({ ...base, measures: ["visits", "appointments"], series: "sales" })).toMatch(/Dua ukuran/)
    expect(validateWidget({ ...base, measures: ["visits", "visits"] })).toMatch(/berbeda/)
    expect(validateWidget({ ...base, chart: "donut" })).toMatch(/Bentuk/)
    expect(validateWidget({ ...base, group: "industry", chart: "number" })).toMatch(/Bentuk/)
    expect(validateWidget({ ...base, title: " " })).toMatch(/Judul/)
  })
})

describe("labels", () => {
  const ctx = { people: new Map([["u1", "Sri Wijayati"]]) }

  it("names days, weeks and months in Indonesian", () => {
    expect(bucketLabel("day", "2026-09-17", ctx)).toBe("17 Sep")
    expect(bucketLabel("week", "2026-09-14", ctx)).toBe("14–20 Sep")
    expect(bucketLabel("week", "2026-09-28", ctx)).toBe("28 Sep–4 Okt")
    expect(bucketLabel("month", "2026-09", ctx)).toBe("Sep 2026")
  })

  it("names people, kinds, the unset and the rest", () => {
    expect(bucketLabel("sales", "u1", ctx)).toBe("Sri Wijayati")
    expect(bucketLabel("sales", "u9", ctx)).toBe("Mantan anggota")
    expect(bucketLabel("sales", "", ctx)).toBe("Belum ditugaskan")
    expect(bucketLabel("interest", "hot", ctx)).toBe("Panas")
    expect(bucketLabel("industry", "", ctx)).toBe("Belum diisi")
    expect(bucketLabel("industry", OTHER_KEY, ctx)).toBe("Lainnya")
  })

  it("titles a card from its parts", () => {
    expect(defaultTitle({ measures: ["visits"], group: "industry" })).toBe("Laporan per industri")
    expect(defaultTitle({ measures: ["visits", "appointments"], group: "day" })).toBe("Laporan vs Aktivitas per hari")
    expect(defaultTitle({ measures: ["opportunities"], group: "sales", series: "interest" })).toBe("Peluang per sales · tingkat minat")
  })
})

describe("sizes", () => {
  it("snaps cells to a size and knows a minimum", async () => {
    const { sizeFromCells, sizeFits, minSizeFor, builtinWidget } = await import("./cube")
    expect(sizeFromCells(1, 1)).toBe("sm")
    expect(sizeFromCells(2, 1)).toBe("wide")
    expect(sizeFromCells(1, 2)).toBe("tall")
    expect(sizeFromCells(2, 2)).toBe("lg")
    expect(sizeFits("tall", "wide")).toBe(false)
    expect(sizeFits("lg", "wide")).toBe(true)
    expect(minSizeFor(builtinWidget("visits_per_day")!)).toBe("wide")
    expect(minSizeFor(builtinWidget("interest_mix")!)).toBe("sm")
    expect(minSizeFor(builtinWidget("visits_by_industry")!)).toBe("sm")
    expect(minSizeFor(builtinWidget("daily_reports")!)).toBe("wide")
  })

  it("fills whole rows of the twelve-column board by default", async () => {
    const { SIZE_BOX, GRID_COLS } = await import("./cube")
    const area = BUILTIN_WIDGETS.filter((widget) => !widget.defaultHidden).reduce((sum, widget) => sum + SIZE_BOX[widget.size].w * SIZE_BOX[widget.size].h, 0)
    expect(area % GRID_COLS).toBe(0)
  })
})

describe("built-ins", () => {
  it("show six cards by default and hide the rest", () => {
    expect(DEFAULT_ORDER).toEqual(["visits_per_day", "visits_vs_appointments", "appointments_vs_planning", "interest_mix", "visits_by_industry", "daily_reports"])
    expect(DEFAULT_HIDDEN.length).toBe(BUILTIN_WIDGETS.length - DEFAULT_ORDER.length)
    expect(new Set(BUILTIN_WIDGETS.map((widget) => widget.id)).size).toBe(BUILTIN_WIDGETS.length)
  })
})
