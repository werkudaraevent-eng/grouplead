import { describe, expect, it } from "vitest"
import { defaultColumnState, moveColumn, toggleColumn } from "./list-columns"
import {
  LIST_COLUMN_SPECS,
  canonicalQuery,
  currentViewConfig,
  defaultViewToApply,
  freeViewName,
  isPlainView,
  markedView,
  normalizeViewConfig,
  viewConfigKey,
  viewConfigSchema,
  viewHref,
  viewNameSchema,
  viewSearch,
  type ListViewConfig,
  type SavedListView,
} from "./list-views"

const ACTIVITY_DEFAULTS = defaultColumnState(LIST_COLUMN_SPECS.activities)

const view = (id: string, config: Partial<ListViewConfig>, isDefault = false): SavedListView => ({
  id,
  name: `View ${id}`,
  isDefault,
  config: { query: "", size: 25, columns: ACTIVITY_DEFAULTS, ...config },
})

describe("canonicalQuery", () => {
  it("ignores the order facet values and parameters were picked in", () => {
    expect(canonicalQuery("activities", "status=COMPLETED,ACCEPTED&date=week")).toBe(canonicalQuery("activities", "date=week&status=ACCEPTED,COMPLETED"))
  })

  it("keeps the search text as typed", () => {
    expect(canonicalQuery("activities", "q=b,a")).toBe("q=b%2Ca")
  })

  it("drops what the list's own parser does not know, the page and the size", () => {
    expect(canonicalQuery("activities", "page=3&size=50&bogus=1&status=ACCEPTED")).toBe("status=ACCEPTED")
    expect(canonicalQuery("reports", "sort=submitted:desc")).toBe("")
    expect(canonicalQuery("prospects", "sort=due")).toBe("")
  })
})

describe("viewConfigKey", () => {
  it("is the same for the same screen reached in a different order", () => {
    const a = viewConfigKey("activities", { query: "status=ACCEPTED,COMPLETED&sales=me", size: 25, columns: ACTIVITY_DEFAULTS })
    const b = viewConfigKey("activities", { query: "sales=me&status=COMPLETED,ACCEPTED", size: 25, columns: ACTIVITY_DEFAULTS })
    expect(a).toBe(b)
  })

  it("tells apart the size and the columns", () => {
    const base = { query: "sales=me", size: 25 as const, columns: ACTIVITY_DEFAULTS }
    const key = viewConfigKey("activities", base)
    expect(viewConfigKey("activities", { ...base, size: 50 })).not.toBe(key)
    expect(viewConfigKey("activities", { ...base, columns: toggleColumn(ACTIVITY_DEFAULTS, "location", true) })).not.toBe(key)
    expect(viewConfigKey("activities", { ...base, columns: moveColumn(ACTIVITY_DEFAULTS, 0, 1) })).not.toBe(key)
  })

  it("reads a view saved without columns as the default columns", () => {
    expect(viewConfigKey("activities", { query: "", size: 25 })).toBe(viewConfigKey("activities", { query: "", size: 25, columns: ACTIVITY_DEFAULTS }))
  })
})

describe("normalizeViewConfig", () => {
  it("cleans what comes from the database through the list's rules", () => {
    const config = normalizeViewConfig("prospects", { query: "status=a&page=2&nope=1", size: 999, columns: [{ id: "email", visible: true }, { id: "gone", visible: true }] })
    expect(config.query).toBe("status=a")
    expect(config.size).toBe(25)
    expect(config.columns[0]).toEqual({ id: "email", visible: true })
    expect(config.columns.some((column) => column.id === "gone")).toBe(false)
    expect(config.columns).toHaveLength(LIST_COLUMN_SPECS.prospects.length - 1)
  })

  it("survives anything", () => {
    expect(normalizeViewConfig("reports", null)).toEqual({ query: "", size: 25, columns: defaultColumnState(LIST_COLUMN_SPECS.reports) })
    expect(normalizeViewConfig("reports", "x")).toEqual({ query: "", size: 25, columns: defaultColumnState(LIST_COLUMN_SPECS.reports) })
  })
})

describe("currentViewConfig and isPlainView", () => {
  it("reads the query and size from the address and drops the page", () => {
    const config = currentViewConfig("activities", "date=today&page=2&size=50", ACTIVITY_DEFAULTS)
    expect(config).toEqual({ query: "date=today", size: 50, columns: ACTIVITY_DEFAULTS })
  })

  it("calls the list's first view plain, and anything else worth saving", () => {
    expect(isPlainView("activities", currentViewConfig("activities", "", ACTIVITY_DEFAULTS))).toBe(true)
    expect(isPlainView("activities", currentViewConfig("activities", "page=4", ACTIVITY_DEFAULTS))).toBe(true)
    expect(isPlainView("activities", currentViewConfig("activities", "q=bank", ACTIVITY_DEFAULTS))).toBe(false)
    expect(isPlainView("activities", currentViewConfig("activities", "size=100", ACTIVITY_DEFAULTS))).toBe(false)
    expect(isPlainView("activities", currentViewConfig("activities", "", toggleColumn(ACTIVITY_DEFAULTS, "location", true)))).toBe(false)
  })
})

describe("viewSearch and viewHref", () => {
  it("writes the size only when it is not the default", () => {
    expect(viewSearch("activities", { query: "date=week", size: 25 })).toBe("date=week")
    expect(viewSearch("activities", { query: "date=week", size: 100 })).toBe("date=week&size=100")
  })

  it("goes to each list's own address", () => {
    expect(viewHref("activities", { query: "", size: 25 })).toBe("/workspace/activities")
    expect(viewHref("prospects", { query: "due=1", size: 50 })).toBe("/workspace/prospects?due=1&size=50")
    expect(viewHref("reports", { query: "sort=client:asc", size: 25 })).toBe("/workspace/reports?sort=client%3Aasc")
  })
})

describe("markedView", () => {
  const today = view("a", { query: "date=today" })
  const todayToo = view("b", { query: "date=today" })
  const mine = view("c", { query: "sales=me" })
  const views = [today, todayToo, mine]

  it("marks only a view that is exactly the screen", () => {
    expect(markedView("activities", views, currentViewConfig("activities", "sales=me", ACTIVITY_DEFAULTS))?.id).toBe("c")
    expect(markedView("activities", views, currentViewConfig("activities", "sales=me&date=today", ACTIVITY_DEFAULTS))).toBeNull()
    expect(markedView("activities", views, currentViewConfig("activities", "sales=me", toggleColumn(ACTIVITY_DEFAULTS, "type", false)))).toBeNull()
  })

  it("prefers the view chosen last among equals, then the first", () => {
    const current = currentViewConfig("activities", "date=today", ACTIVITY_DEFAULTS)
    expect(markedView("activities", views, current)?.id).toBe("a")
    expect(markedView("activities", views, current, [null, "b"])?.id).toBe("b")
    expect(markedView("activities", views, current, ["c", "b"])?.id).toBe("b")
  })
})

describe("defaultViewToApply", () => {
  const plain = currentViewConfig("activities", "", ACTIVITY_DEFAULTS)
  const byDefault = view("d", { query: "sales=me" }, true)

  it("applies the default only on a first open with nothing remembered", () => {
    expect(defaultViewToApply("activities", [view("x", {}), byDefault], true, plain)?.id).toBe("d")
    expect(defaultViewToApply("activities", [byDefault], false, plain)).toBeNull()
  })

  it("does nothing without a default, or when the screen already is it", () => {
    expect(defaultViewToApply("activities", [view("x", { query: "sales=me" })], true, plain)).toBeNull()
    expect(defaultViewToApply("activities", [byDefault], true, currentViewConfig("activities", "sales=me", ACTIVITY_DEFAULTS))).toBeNull()
  })
})

describe("names and validation", () => {
  it("finds a free name for a copy", () => {
    expect(freeViewName("Minggu ini", [{ name: "Tim" }])).toBe("Minggu ini")
    expect(freeViewName("Minggu ini", [{ name: "minggu ini" }, { name: "Minggu ini (2)" }])).toBe("Minggu ini (3)")
    expect(freeViewName("x".repeat(60), [{ name: "x".repeat(60) }])).toHaveLength(60)
  })

  it("asks for a name and bounds it", () => {
    expect(viewNameSchema.safeParse("  ").success).toBe(false)
    expect(viewNameSchema.safeParse("x".repeat(61)).success).toBe(false)
    expect(viewNameSchema.parse("  Tim Jakarta ")).toBe("Tim Jakarta")
  })

  it("accepts only known sizes and bounded columns", () => {
    expect(viewConfigSchema.safeParse({ query: "", size: 25, columns: [] }).success).toBe(true)
    expect(viewConfigSchema.safeParse({ query: "", size: 30, columns: [] }).success).toBe(false)
    expect(viewConfigSchema.safeParse({ query: "", size: 25, columns: [{ id: "", visible: true }] }).success).toBe(false)
  })
})
