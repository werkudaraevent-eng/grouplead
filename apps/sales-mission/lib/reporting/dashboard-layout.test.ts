import { describe, expect, it } from "vitest"
import { BUILTIN_WIDGETS } from "./cube"
import {
  MAX_CUSTOM_WIDGETS,
  defaultLayout,
  hideWidget,
  layoutSchema,
  mergeLayout,
  modeOf,
  removeCustom,
  reorder,
  resolveWidgets,
  showWidget,
  upsertCustom,
  type DashboardLayout,
} from "./dashboard-layout"

const custom = (id: string, measure: "visits" | "planning" = "visits") => ({
  id,
  kind: "custom" as const,
  source: "cube" as const,
  title: "Kartu saya",
  measures: [measure] as const,
  group: "industry" as const,
  chart: "bars" as const,
  size: "sm" as const,
})

const all = { canSeeProspects: true }

describe("mergeLayout", () => {
  it("is the default for nothing, garbage, or an unparseable shape", () => {
    expect(mergeLayout(null, all)).toEqual(defaultLayout())
    expect(mergeLayout("nonsense", all)).toEqual(defaultLayout())
    expect(mergeLayout({ order: "not-a-list" }, all)).toEqual(defaultLayout())
  })

  it("drops unknown ids, keeps the saved order, and appends built-ins it has never seen", () => {
    const layout = mergeLayout({ order: ["daily_reports", "ghost", "visits_per_day"], hidden: ["interest_mix"] }, all)
    expect(layout.order.slice(0, 2)).toEqual(["daily_reports", "visits_per_day"])
    expect(layout.order).not.toContain("ghost")
    expect(layout.hidden).toContain("interest_mix")
    expect(layout.order).toContain("visits_vs_appointments")
    expect(layout.hidden).toContain("funnel")
    const ids = [...layout.order, ...layout.hidden]
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("lets a visible id win over a hidden one", () => {
    const layout = mergeLayout({ order: ["interest_mix"], hidden: ["interest_mix"] }, all)
    expect(layout.order).toContain("interest_mix")
    expect(layout.hidden).not.toContain("interest_mix")
  })

  it("removes what needs prospects for a viewer without the right", () => {
    const layout = mergeLayout({ custom: [custom("c_planning01", "planning"), custom("c_visits0001")] }, { canSeeProspects: false })
    const ids = [...layout.order, ...layout.hidden]
    expect(ids).not.toContain("appointments_vs_planning")
    expect(ids).not.toContain("funnel")
    expect(layout.custom.map((widget) => widget.id)).toEqual(["c_visits0001"])
  })

  it("keeps sizes and modes only for known cards that offer them", () => {
    const layout = mergeLayout({ sizes: { interest_mix: "lg", ghost: "sm" }, modes: { visits_per_day: "sales", interest_mix: "sales" } }, all)
    expect(layout.sizes).toEqual({ interest_mix: "lg" })
    expect(layout.modes).toEqual({ visits_per_day: "sales" })
  })

  it("refuses a bad custom id and a thirteenth card at the schema", () => {
    expect(layoutSchema.safeParse({ custom: [custom("bad id")] }).success).toBe(false)
    const many = Array.from({ length: MAX_CUSTOM_WIDGETS + 1 }, (_, index) => custom(`c_card${String(index).padStart(6, "0")}`))
    expect(layoutSchema.safeParse({ custom: many }).success).toBe(false)
    expect(layoutSchema.safeParse({ custom: many.slice(0, MAX_CUSTOM_WIDGETS) }).success).toBe(true)
  })

  it("refuses a custom card the cube cannot answer", () => {
    expect(layoutSchema.safeParse({ custom: [{ ...custom("c_wrong00001"), group: "prospect_status" }] }).success).toBe(false)
  })
})

describe("edits", () => {
  const base: DashboardLayout = mergeLayout(null, all)

  it("reorders within the visible set and keeps strays at the end", () => {
    const next = reorder(base, ["daily_reports", "ghost", "visits_per_day"])
    expect(next.order.slice(0, 2)).toEqual(["daily_reports", "visits_per_day"])
    expect(next.order.length).toBe(base.order.length)
  })

  it("hides and shows, keeping an id in exactly one list", () => {
    const hidden = hideWidget(base, "interest_mix")
    expect(hidden.order).not.toContain("interest_mix")
    expect(hidden.hidden).toContain("interest_mix")
    const shown = showWidget(hidden, "interest_mix", 0)
    expect(shown.order[0]).toBe("interest_mix")
    expect(shown.hidden).not.toContain("interest_mix")
  })

  it("adds a custom card visible at the end, edits it in place, and removes every trace", () => {
    const added = upsertCustom(base, custom("c_mine000001"))
    expect(added.order.at(-1)).toBe("c_mine000001")
    const edited = upsertCustom(added, { ...custom("c_mine000001"), title: "Diubah" })
    expect(edited.custom.find((widget) => widget.id === "c_mine000001")?.title).toBe("Diubah")
    expect(edited.order.filter((id) => id === "c_mine000001").length).toBe(1)
    const removed = removeCustom({ ...edited, sizes: { c_mine000001: "lg" } }, "c_mine000001")
    expect(removed.custom).toEqual([])
    expect(removed.order).not.toContain("c_mine000001")
    expect(removed.sizes).toEqual({})
  })

  it("resolves configs with the person's size and a default mode", () => {
    const layout = { ...base, sizes: { interest_mix: "lg" as const } }
    const { visible, hidden } = resolveWidgets(layout)
    expect(visible.find((widget) => widget.id === "interest_mix")?.size).toBe("lg")
    expect(visible.length + hidden.length).toBe(BUILTIN_WIDGETS.length)
    expect(modeOf(layout, visible.find((widget) => widget.id === "visits_per_day")!)).toBe("umum")
    expect(modeOf({ ...layout, modes: { visits_per_day: "sales" } }, visible.find((widget) => widget.id === "visits_per_day")!)).toBe("sales")
  })
})
