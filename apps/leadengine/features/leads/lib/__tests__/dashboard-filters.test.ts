import { describe, expect, it } from "vitest"
import { dashboardFilterCount, dashboardFilterDiff, defaultPipelineId } from "../dashboard-filters"

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
