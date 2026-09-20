import { describe, expect, it } from "vitest"
import { BUILTIN_WIDGETS } from "./cube"
import {
  MAX_CUSTOM_WIDGETS,
  defaultLayout,
  hideWidget,
  layoutSchema,
  mergeLayout,
  modeOf,
  applyPreset,
  boxOf,
  presetOf,
  removeCustom,
  reorder,
  resolveWidgets,
  samePositions,
  setPositions,
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

const all = { canSeeProspects: true, canSeeInsight: true }

describe("mergeLayout", () => {
  it("is the default for nothing, garbage, or an unparseable shape", () => {
    expect(mergeLayout(null, all)).toEqual(defaultLayout())
    expect(mergeLayout("nonsense", all)).toEqual(defaultLayout())
    expect(mergeLayout({ order: "not-a-list" }, all)).toEqual(defaultLayout())
  })

  it("drops unknown ids, keeps the saved order, and appends built-ins it has never seen", () => {
    const layout = mergeLayout({ order: ["ai_insight", "daily_reports", "ghost", "visits_per_day"], hidden: ["interest_mix"] }, all)
    expect(layout.order.slice(0, 3)).toEqual(["ai_insight", "daily_reports", "visits_per_day"])
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
    const layout = mergeLayout({ custom: [custom("c_planning01", "planning"), custom("c_visits0001")] }, { canSeeProspects: false, canSeeInsight: true })
    const ids = [...layout.order, ...layout.hidden]
    expect(ids).not.toContain("appointments_vs_planning")
    expect(ids).not.toContain("funnel")
    expect(layout.custom.map((widget) => widget.id)).toEqual(["c_visits0001"])
  })

  it("removes the insight card for a viewer without Insight AI, and keeps the rest", () => {
    const layout = mergeLayout({ order: ["ai_insight", "visits_per_day"] }, { canSeeProspects: true, canSeeInsight: false })
    expect([...layout.order, ...layout.hidden]).not.toContain("ai_insight")
    expect(layout.order[0]).toBe("visits_per_day")
    expect(layout.positions.ai_insight).toBeUndefined()
  })

  it("puts the insight card first, full width, on a board that has never seen it", () => {
    const saved = { order: ["daily_reports", "visits_per_day"], positions: { daily_reports: { x: 0, y: 0, w: 6, h: 14 }, visits_per_day: { x: 6, y: 0, w: 6, h: 7 } } }
    const layout = mergeLayout(saved, all)
    expect(layout.order.slice(0, 3)).toEqual(["ai_insight", "daily_reports", "visits_per_day"])
    expect(layout.positions.ai_insight).toEqual({ x: 0, y: 0, w: 12, h: 6 })
    // Once placed or hidden, the board's own word stands.
    const moved = mergeLayout({ ...saved, order: [...saved.order, "ai_insight"], positions: { ...saved.positions, ai_insight: { x: 0, y: 20, w: 6, h: 6 } } }, all)
    expect(moved.order.indexOf("ai_insight")).toBe(2)
    expect(moved.positions.ai_insight).toEqual({ x: 0, y: 20, w: 6, h: 6 })
    expect(mergeLayout({ ...saved, hidden: ["ai_insight"] }, all).hidden).toContain("ai_insight")
  })

  it("keeps positions and modes only for known cards, clamped to the board and the minimum", () => {
    const layout = mergeLayout(
      { positions: { interest_mix: { x: 11, y: 2, w: 3, h: 7 }, visits_per_day: { x: 0, y: 0, w: 1, h: 1 }, ghost: { x: 0, y: 0, w: 3, h: 3 } }, modes: { visits_per_day: "sales", interest_mix: "sales" } },
      all
    )
    expect(layout.positions.interest_mix).toEqual({ x: 9, y: 2, w: 3, h: 7 })
    expect(layout.positions.visits_per_day).toEqual({ x: 0, y: 0, w: 4, h: 5 })
    expect(layout.positions.ghost).toBeUndefined()
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
    const removed = removeCustom({ ...edited, positions: { c_mine000001: { x: 0, y: 0, w: 3, h: 7 } } }, "c_mine000001")
    expect(removed.custom).toEqual([])
    expect(removed.order).not.toContain("c_mine000001")
    expect(removed.positions).toEqual({})
  })

  it("boxes a card from its position or its preset, never below its minimum", () => {
    const { visible } = resolveWidgets(base)
    const chart = visible.find((widget) => widget.id === "visits_per_day")!
    const donut = visible.find((widget) => widget.id === "interest_mix")!
    expect(boxOf(base, chart)).toEqual({ w: 6, h: 7 })
    expect(boxOf({ ...base, positions: { visits_per_day: { x: 0, y: 0, w: 2, h: 2 } } }, chart)).toEqual({ w: 4, h: 5 })
    expect(boxOf({ ...base, positions: { interest_mix: { x: 0, y: 0, w: 2, h: 4 } } }, donut)).toEqual({ w: 2, h: 4 })
    expect(presetOf({ w: 6, h: 14 })).toBe("lg")
    expect(presetOf({ w: 5, h: 9 })).toBeNull()
  })

  it("takes the grid's report of places and applies a preset in place", () => {
    const moved = setPositions(base, [{ i: "interest_mix", x: 9, y: 7, w: 3, h: 7 }, { i: "ghost", x: 0, y: 0, w: 1, h: 1 }])
    expect(moved.positions.interest_mix).toEqual({ x: 9, y: 7, w: 3, h: 7 })
    expect(moved.positions.ghost).toBeUndefined()
    const preset = applyPreset(moved, "interest_mix", "lg")
    expect(preset.positions.interest_mix).toEqual({ x: 6, y: 7, w: 6, h: 14 })
    expect(samePositions(moved.positions, preset.positions)).toBe(false)
    expect(samePositions(moved.positions, { ...moved.positions })).toBe(true)
  })

  it("resolves configs and a default mode", () => {
    const { visible, hidden } = resolveWidgets(base)
    expect(visible.length + hidden.length).toBe(BUILTIN_WIDGETS.length)
    expect(modeOf(base, visible.find((widget) => widget.id === "visits_per_day")!)).toBe("umum")
    expect(modeOf({ ...base, modes: { visits_per_day: "sales" } }, visible.find((widget) => widget.id === "visits_per_day")!)).toBe("sales")
  })
})
