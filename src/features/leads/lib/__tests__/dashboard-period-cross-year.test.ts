import { describe, it, expect } from "vitest"
import {
    findPriorYearPipelineId,
    splitLeadsByBasisWithPrior,
    splitDashboardLeadsByPeriodWithPrior,
} from "../dashboard-period"

const NOW = new Date(2026, 4, 20) // May 20 2026

type MinimalPipeline = { id: string; fiscal_year?: number | null; is_default?: boolean }

type MinimalLead = {
    id: number
    pipeline_id?: string | null
    received_date?: string | null
    closed_won_date?: string | null
    month_event?: string | null
    pipeline_stage?: { name?: string; closed_status?: string | null } | null
    actual_value?: number | null
    estimated_value?: number | null
}

// ─── findPriorYearPipelineId ─────────────────────────────────────────────────
describe("findPriorYearPipelineId", () => {
    const pipelines: MinimalPipeline[] = [
        { id: "p2026", fiscal_year: 2026 },
        { id: "p2025", fiscal_year: 2025 },
        { id: "p2024", fiscal_year: 2024 },
    ]

    it("returns the pipeline one fiscal year earlier", () => {
        expect(findPriorYearPipelineId(pipelines, "p2026")).toBe("p2025")
        expect(findPriorYearPipelineId(pipelines, "p2025")).toBe("p2024")
    })

    it("returns null when no prior-year pipeline exists", () => {
        expect(findPriorYearPipelineId(pipelines, "p2024")).toBeNull()
    })

    it("returns null when the active pipeline has no fiscal_year", () => {
        const withNull: MinimalPipeline[] = [{ id: "px", fiscal_year: null }, ...pipelines]
        expect(findPriorYearPipelineId(withNull, "px")).toBeNull()
    })

    it("returns null for an undefined/empty active id", () => {
        expect(findPriorYearPipelineId(pipelines, undefined)).toBeNull()
        expect(findPriorYearPipelineId(pipelines, null)).toBeNull()
    })

    it("returns null when the active id is not in the list", () => {
        expect(findPriorYearPipelineId(pipelines, "ghost")).toBeNull()
    })

    it("prefers the is_default pipeline when several share the prior year", () => {
        const dupes: MinimalPipeline[] = [
            { id: "p2026", fiscal_year: 2026 },
            { id: "p2025a", fiscal_year: 2025 },
            { id: "p2025b", fiscal_year: 2025, is_default: true },
        ]
        expect(findPriorYearPipelineId(dupes, "p2026")).toBe("p2025b")
    })

    it("falls back to the first match when none is default", () => {
        const dupes: MinimalPipeline[] = [
            { id: "p2026", fiscal_year: 2026 },
            { id: "p2025a", fiscal_year: 2025 },
            { id: "p2025b", fiscal_year: 2025 },
        ]
        expect(findPriorYearPipelineId(dupes, "p2026")).toBe("p2025a")
    })
})

// ─── splitLeadsByBasisWithPrior ──────────────────────────────────────────────
describe("splitLeadsByBasisWithPrior", () => {
    // Custom range covering all of 2025; previous range is all of 2024.
    const range = { start: "2025-01-01", end: "2025-12-31" }

    const currentLeads: MinimalLead[] = [
        { id: 1, received_date: "2025-03-10" },
        { id: 2, received_date: "2025-07-22" },
        // A stray 2024-dated lead in the active pipeline must NOT leak into previous.
        { id: 3, received_date: "2024-06-01" },
    ]
    const priorLeads: MinimalLead[] = [
        { id: 10, received_date: "2024-04-15" },
        { id: 11, received_date: "2024-09-30" },
    ]

    it("takes current bucket from active leads only", () => {
        const r = splitLeadsByBasisWithPrior(currentLeads, priorLeads, "received", "custom", NOW, range)
        expect(r.current.map(l => l.id).sort()).toEqual([1, 2])
    })

    it("takes previous bucket from the prior-year leads only", () => {
        const r = splitLeadsByBasisWithPrior(currentLeads, priorLeads, "received", "custom", NOW, range)
        // Prior pipeline's 2024 leads land in the previous (2024) bucket.
        expect(r.previous.map(l => l.id).sort()).toEqual([10, 11])
    })

    it("does not double-count active-pipeline leads dated in the prior year", () => {
        const r = splitLeadsByBasisWithPrior(currentLeads, priorLeads, "received", "custom", NOW, range)
        // Lead 3 (2024, but in the active pipeline) must not appear in previous.
        expect(r.previous.map(l => l.id)).not.toContain(3)
    })

    it("yields an empty previous bucket when there is no prior-year data", () => {
        const r = splitLeadsByBasisWithPrior(currentLeads, [], "received", "custom", NOW, range)
        expect(r.previous).toEqual([])
        expect(r.current.map(l => l.id).sort()).toEqual([1, 2])
    })
})

// ─── splitDashboardLeadsByPeriodWithPrior ────────────────────────────────────
describe("splitDashboardLeadsByPeriodWithPrior", () => {
    const range = { start: "2025-01-01", end: "2025-12-31" }

    // Revenue-date basis uses month_event ("April 2025") or event dates.
    const currentLeads: MinimalLead[] = [
        { id: 1, month_event: "March 2025" },
        { id: 2, month_event: "August 2025" },
    ]
    const priorLeads: MinimalLead[] = [
        { id: 10, month_event: "May 2024" },
    ]

    it("splits current from active and previous from prior", () => {
        const r = splitDashboardLeadsByPeriodWithPrior(currentLeads, priorLeads, "custom", NOW, range)
        expect(r.current.map(l => l.id).sort()).toEqual([1, 2])
        expect(r.previous.map(l => l.id)).toEqual([10])
    })

    it("yields empty previous when no prior leads", () => {
        const r = splitDashboardLeadsByPeriodWithPrior(currentLeads, [], "custom", NOW, range)
        expect(r.previous).toEqual([])
    })
})
