import { describe, expect, it } from "vitest"
import { dashboardFilterCount, dashboardFilterDiff, dashboardFilterRows, defaultPipelineId, unitsMatching } from "../dashboard-filters"

const context = { defaultPipelineId: "p26", unitsApply: true }
const opening = { pipelineId: "p26", companyFilter: "all", period: "this_quarter" }

describe("defaultPipelineId", () => {
    it("takes the pipeline marked default", () => {
        expect(defaultPipelineId([{ id: "p25" }, { id: "p26", is_default: true }])).toBe("p26")
    })

    it("falls back to the first pipeline", () => {
        expect(defaultPipelineId([{ id: "p25" }, { id: "p26" }])).toBe("p25")
    })

    it("is null without pipelines", () => {
        expect(defaultPipelineId([])).toBeNull()
    })
})

describe("dashboardFilterCount", () => {
    it("counts nothing as the dashboard opens", () => {
        expect(dashboardFilterCount(opening, context)).toBe(0)
    })

    it("counts each filter that differs", () => {
        expect(dashboardFilterCount({ ...opening, pipelineId: "p25" }, context)).toBe(1)
        expect(dashboardFilterCount({ ...opening, companyFilter: "c1" }, context)).toBe(1)
        expect(dashboardFilterCount({ ...opening, period: "this_year" }, context)).toBe(1)
        expect(dashboardFilterCount({ pipelineId: "p25", companyFilter: "c1", period: "custom" }, context)).toBe(3)
    })

    it("ignores a business unit that narrows nothing (not a holding view)", () => {
        expect(dashboardFilterCount({ ...opening, companyFilter: "c1" }, { ...context, unitsApply: false })).toBe(0)
    })

    it("ignores the pipeline while no pipeline is known", () => {
        expect(dashboardFilterCount({ ...opening, pipelineId: undefined }, context)).toBe(0)
        expect(dashboardFilterCount({ ...opening, pipelineId: "p25" }, { ...context, defaultPipelineId: null })).toBe(0)
    })
})

describe("dashboardFilterDiff", () => {
    it("says which filters differ", () => {
        expect(dashboardFilterDiff({ ...opening, period: "all_time" }, context)).toEqual({ pipeline: false, unit: false, dateRange: true })
    })
})

describe("dashboardFilterRows", () => {
    const pipelines = [
        { id: "p26", name: "Group Lead 2026" },
        { id: "p25", name: "Group Lead 2025" },
    ]
    const units = [
        { id: "c1", name: "Werkudara Nirwana Event" },
        { id: "c2", name: "Yukti Persada Nadi" },
    ]
    const input = {
        pipelines,
        activePipelineId: "p26",
        defaultPipelineId: "p26",
        units,
        unitsApply: true,
        companyFilter: "all",
        period: "this_quarter",
        customStart: "",
        customEnd: "",
    }

    it("says what each filter is set to as the dashboard opens, none of them applied", () => {
        expect(dashboardFilterRows(input)).toEqual([
            { key: "pipeline", label: "Pipeline", value: "Group Lead 2026 · Default", applied: false },
            { key: "unit", label: "Business unit", value: "All business units", applied: false },
            { key: "dateRange", label: "Date range", value: "This Quarter", applied: false },
        ])
    })

    it("marks what differs and names it", () => {
        const rows = dashboardFilterRows({
            ...input,
            activePipelineId: "p25",
            companyFilter: "c2",
            period: "custom",
            customStart: "2026-05-01",
            customEnd: "2026-05-31",
        })
        expect(rows.map((r) => [r.value, r.applied])).toEqual([
            ["Group Lead 2025", true],
            ["Yukti Persada Nadi", true],
            ["1 May – 31 May 2026", true],
        ])
    })

    it("leaves out the pipeline with one pipeline and the unit outside a holding view", () => {
        const rows = dashboardFilterRows({ ...input, pipelines: [pipelines[0]], unitsApply: false })
        expect(rows.map((r) => r.key)).toEqual(["dateRange"])
    })
})

describe("unitsMatching", () => {
    const units = [
        { id: "c1", name: "Werkudara Nirwana Event" },
        { id: "c2", name: "Yukti Persada Nadi" },
        { id: "c3", name: "Werkudara Tour & Travel" },
    ]

    it("keeps every unit for an empty or blank query", () => {
        expect(unitsMatching(units, "")).toHaveLength(3)
        expect(unitsMatching(units, "   ")).toHaveLength(3)
    })

    it("matches part of a name, ignoring case and the spaces around the query", () => {
        expect(unitsMatching(units, " werkudara ").map((u) => u.id)).toEqual(["c1", "c3"])
        expect(unitsMatching(units, "PERSADA").map((u) => u.id)).toEqual(["c2"])
        expect(unitsMatching(units, "hotel")).toEqual([])
    })
})
