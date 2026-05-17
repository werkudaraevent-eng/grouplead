import { describe, it, expect } from "vitest"
import {
    suggestTargetStage,
    suggestStageMappings,
    type StageInfo,
} from "../suggest-stage-mapping"

const stages: StageInfo[] = [
    { id: "s-tentative", name: "Tentative", sort_order: 1, closed_status: null },
    { id: "s-confirmed", name: "Confirmed", sort_order: 2, closed_status: null },
    { id: "s-postponed", name: "On Hold", sort_order: 3, closed_status: null },
    { id: "s-won", name: "Closed Won", sort_order: 4, closed_status: "won" },
    { id: "s-lost", name: "Closed Lost", sort_order: 5, closed_status: "lost" },
]

describe("suggestTargetStage", () => {
    it("maps MATERIALIZED → Closed Won", () => {
        expect(suggestTargetStage("MATERIALIZED", stages)?.targetStageId).toBe("s-won")
    })

    it("maps TURNDOWN/CANCELLED/LOST → Closed Lost", () => {
        expect(suggestTargetStage("LOST", stages)?.targetStageId).toBe("s-lost")
        expect(suggestTargetStage("TURNDOWN", stages)?.targetStageId).toBe("s-lost")
        expect(suggestTargetStage("CANCELLED", stages)?.targetStageId).toBe("s-lost")
    })

    it("maps TENTATIVE → first open stage", () => {
        expect(suggestTargetStage("TENTATIVE", stages)?.targetStageId).toBe("s-tentative")
    })

    it("maps CONFIRMED → middle open stage", () => {
        expect(suggestTargetStage("CONFIRMED", stages)?.targetStageId).toBe("s-confirmed")
    })

    it("maps POSTPONED → last open stage", () => {
        expect(suggestTargetStage("POSTPONED", stages)?.targetStageId).toBe("s-postponed")
    })

    it("returns null for unknown values", () => {
        expect(suggestTargetStage("XYZZY", stages)).toBe(null)
    })

    it("matches stage name directly", () => {
        expect(suggestTargetStage("Tentative", stages)?.targetStageId).toBe("s-tentative")
    })
})

describe("suggestStageMappings", () => {
    it("builds a complete mapping object from source values", () => {
        const sources = ["MATERIALIZED", "TENTATIVE", "CONFIRMED", "LOST", "POSTPONED", "CANCELLED"]
        const out = suggestStageMappings(sources, stages)
        expect(out).toEqual({
            MATERIALIZED: "s-won",
            TENTATIVE: "s-tentative",
            CONFIRMED: "s-confirmed",
            LOST: "s-lost",
            POSTPONED: "s-postponed",
            CANCELLED: "s-lost",
        })
    })

    it("omits unknown values", () => {
        const out = suggestStageMappings(["XYZZY", "MATERIALIZED"], stages)
        expect(out).toEqual({ MATERIALIZED: "s-won" })
    })
})
