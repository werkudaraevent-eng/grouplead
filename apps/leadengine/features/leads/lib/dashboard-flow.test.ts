import { describe, expect, it } from "vitest"
import { FLOW_MAX_HEIGHT, FLOW_MIN_HEIGHT, flowHeight, flowItems, flowKind, gridRowsToPx } from "./dashboard-flow"
import { getDefaultLayout, DEFAULT_HIDDEN_WIDGETS, WIDGET_IDS } from "./dashboard-layout"

const builtIn = (id: string) => flowKind(id)
const allCharts = () => "chart" as const

describe("gridRowsToPx", () => {
    it("matches react-grid-layout's cell height (rows plus the gaps between them)", () => {
        expect(gridRowsToPx(1)).toBe(50)
        expect(gridRowsToPx(3)).toBe(3 * 50 + 2 * 22)
        expect(gridRowsToPx(7)).toBe(7 * 50 + 6 * 22)
    })

    it("never goes below one row", () => {
        expect(gridRowsToPx(0)).toBe(50)
        expect(gridRowsToPx(-2)).toBe(50)
    })
})

describe("flowHeight", () => {
    it("keeps a desk height that fits a phone", () => {
        expect(flowHeight(6)).toBe(gridRowsToPx(6))
    })

    it("caps a tall card and lifts a short one", () => {
        expect(flowHeight(12)).toBe(FLOW_MAX_HEIGHT)
        expect(flowHeight(3)).toBe(FLOW_MIN_HEIGHT)
    })

    it("gives a card without a saved height a chart's usual height", () => {
        expect(flowHeight(undefined)).toBe(gridRowsToPx(6))
    })
})

describe("flowItems", () => {
    it("reflows the default dashboard: number cards first, two to a row, then each chart full width", () => {
        const items = flowItems({
            ids: WIDGET_IDS,
            layout: getDefaultLayout(),
            hidden: new Set(DEFAULT_HIDDEN_WIDGETS),
            kind: builtIn,
        })
        expect(items.map((item) => item.id)).toEqual([
            "kpi-incoming-lead",
            "kpi-lead-events",
            "kpi-lead-conversion",
            "kpi-won",
            "kpi-lost",
            "revenue-chart",
            "pipeline",
            "sales-perf",
            "top-revenue",
            "lead-source",
            "classification",
            "stream",
        ])
        expect(items.filter((item) => item.span === "half").map((item) => item.id)).toEqual([
            "kpi-incoming-lead",
            "kpi-lead-events",
            "kpi-lead-conversion",
            "kpi-won",
            "kpi-lost",
        ])
        const byId = (id: string) => items.find((item) => item.id === id)
        // A number card and a list take their content's height; a list stops at
        // its desk height and scrolls inside; a chart takes that height.
        expect(byId("kpi-won")).toMatchObject({ height: null, maxHeight: null })
        expect(byId("revenue-chart")).toMatchObject({ span: "full", height: flowHeight(7), maxHeight: null })
        expect(byId("lead-source")).toMatchObject({ span: "full", height: null, maxHeight: flowHeight(6) })
        expect(byId("pipeline")).toMatchObject({ height: null, maxHeight: flowHeight(7) })
    })

    it("follows the person's arrangement: top to bottom, then left to right", () => {
        const items = flowItems({
            ids: ["a", "b", "c", "d"],
            layout: [
                { i: "a", x: 6, y: 4, h: 6 },
                { i: "b", x: 0, y: 4, h: 6 },
                { i: "c", x: 0, y: 0, h: 3 },
                { i: "d", x: 3, y: 0, h: 3 },
            ],
            hidden: new Set(),
            kind: allCharts,
        })
        expect(items.map((item) => item.id)).toEqual(["c", "d", "b", "a"])
    })

    it("leaves out hidden cards and custom widgets that are not part of the view", () => {
        const items = flowItems({
            ids: ["kpi-won", "pipeline", "custom-1", "custom-2"],
            layout: [
                { i: "kpi-won", x: 0, y: 0, h: 3 },
                { i: "pipeline", x: 0, y: 3, h: 7 },
                { i: "custom-2", x: 0, y: 10, h: 5 },
            ],
            hidden: new Set(["pipeline"]),
            kind: builtIn,
        })
        expect(items.map((item) => item.id)).toEqual(["kpi-won", "custom-2"])
    })

    it("puts a built-in card with no saved position after the placed ones, in its own order", () => {
        const items = flowItems({
            ids: ["x", "y", "z"],
            layout: [{ i: "z", x: 0, y: 0, h: 6 }],
            hidden: new Set(),
            kind: allCharts,
        })
        expect(items.map((item) => item.id)).toEqual(["z", "x", "y"])
        expect(items[1].height).toBe(flowHeight(undefined))
    })

    it("sizes a custom number card to its content like the built-in ones", () => {
        const items = flowItems({
            ids: ["custom-k"],
            layout: [{ i: "custom-k", x: 0, y: 0, h: 3 }],
            hidden: new Set(),
            kind: (id) => flowKind(id, "kpi"),
        })
        expect(items).toEqual([{ id: "custom-k", span: "half", height: null, maxHeight: null }])
    })
})

describe("flowKind", () => {
    it("makes every KPI card, built-in or custom, a number card", () => {
        expect(flowKind("kpi-won")).toBe("number")
        expect(flowKind("custom-9", "kpi")).toBe("number")
    })

    it("lets rows, the funnel and the donuts take their content's height", () => {
        for (const id of ["pipeline", "sales-perf", "top-revenue", "lead-source", "classification", "stream", "contact-analytics"]) {
            expect(flowKind(id)).toBe("list")
        }
    })

    it("gives charts, goal widgets and custom charts a fixed height", () => {
        expect(flowKind("revenue-chart")).toBe("chart")
        expect(flowKind("goal-trend")).toBe("chart")
        expect(flowKind("custom-3", "bar")).toBe("chart")
        expect(flowKind("custom-4", "list")).toBe("chart")
    })
})
