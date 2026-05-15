import { describe, it, expect } from "vitest"
import {
    findMatchingTransitionRule,
    isBackwardTransition,
    ruleRequiresPrompt,
    sortStages,
} from "../stage-transitions"
import type { PipelineStage, TransitionRule } from "@/types"

const mkStage = (
    overrides: Partial<PipelineStage> & Pick<PipelineStage, "id" | "sort_order">,
): PipelineStage => ({
    name: `Stage ${overrides.id}`,
    color: "blue",
    is_default: false,
    stage_type: "open",
    created_at: "",
    ...overrides,
})

const mkRule = (overrides: Partial<TransitionRule> & Pick<TransitionRule, "id" | "to_stage_id">): TransitionRule => ({
    pipeline_id: "p1",
    from_stage_id: null,
    required_fields: [],
    note_required: false,
    attachment_required: false,
    checklist: [],
    created_at: "",
    ...overrides,
})

describe("isBackwardTransition", () => {
    const stageA = mkStage({ id: "a", sort_order: 1 })
    const stageB = mkStage({ id: "b", sort_order: 2 })
    const stageC = mkStage({ id: "c", sort_order: 3 })

    it("returns false when moving forward", () => {
        expect(isBackwardTransition(stageA, stageB)).toBe(false)
        expect(isBackwardTransition(stageA, stageC)).toBe(false)
    })

    it("returns true when moving backward", () => {
        expect(isBackwardTransition(stageB, stageA)).toBe(true)
        expect(isBackwardTransition(stageC, stageA)).toBe(true)
    })

    it("returns false when staying on the same stage", () => {
        expect(isBackwardTransition(stageA, stageA)).toBe(false)
    })

    it("returns false when either stage is missing", () => {
        expect(isBackwardTransition(null, stageA)).toBe(false)
        expect(isBackwardTransition(stageA, undefined)).toBe(false)
        expect(isBackwardTransition(null, null)).toBe(false)
    })
})

describe("findMatchingTransitionRule", () => {
    const explicit = mkRule({ id: "r1", from_stage_id: "a", to_stage_id: "b", required_fields: ["amount"] })
    const wildcard = mkRule({ id: "r2", from_stage_id: null, to_stage_id: "b", note_required: true })
    const otherTarget = mkRule({ id: "r3", from_stage_id: "a", to_stage_id: "c" })

    it("prefers an explicit from→to rule over a wildcard rule", () => {
        const found = findMatchingTransitionRule([wildcard, explicit, otherTarget], "a", "b")
        expect(found?.id).toBe("r1")
    })

    it("falls back to a wildcard rule when no explicit match exists", () => {
        const found = findMatchingTransitionRule([wildcard, otherTarget], "x", "b")
        expect(found?.id).toBe("r2")
    })

    it("returns null when no rule targets the destination", () => {
        expect(findMatchingTransitionRule([wildcard, otherTarget], "a", "z")).toBeNull()
    })
})

describe("ruleRequiresPrompt", () => {
    it("returns false for null/undefined", () => {
        expect(ruleRequiresPrompt(null)).toBe(false)
        expect(ruleRequiresPrompt(undefined)).toBe(false)
    })

    it("returns false for an empty rule", () => {
        const rule = mkRule({ id: "r", to_stage_id: "b" })
        expect(ruleRequiresPrompt(rule)).toBe(false)
    })

    it("returns true when required_fields is non-empty", () => {
        expect(
            ruleRequiresPrompt(mkRule({ id: "r", to_stage_id: "b", required_fields: ["amount"] })),
        ).toBe(true)
    })

    it("returns true when note_required is set", () => {
        expect(
            ruleRequiresPrompt(mkRule({ id: "r", to_stage_id: "b", note_required: true })),
        ).toBe(true)
    })

    it("returns true when attachment_required is set", () => {
        expect(
            ruleRequiresPrompt(mkRule({ id: "r", to_stage_id: "b", attachment_required: true })),
        ).toBe(true)
    })
})

describe("sortStages", () => {
    it("places open stages before closed stages, each ordered by sort_order", () => {
        const stages: PipelineStage[] = [
            mkStage({ id: "won", sort_order: 4, stage_type: "closed" }),
            mkStage({ id: "lead", sort_order: 1, stage_type: "open" }),
            mkStage({ id: "lost", sort_order: 5, stage_type: "closed" }),
            mkStage({ id: "proposal", sort_order: 3, stage_type: "open" }),
            mkStage({ id: "estimasi", sort_order: 2, stage_type: "open" }),
        ]
        const sorted = sortStages(stages).map((s) => s.id)
        expect(sorted).toEqual(["lead", "estimasi", "proposal", "won", "lost"])
    })

    it("does not mutate the input array", () => {
        const stages: PipelineStage[] = [
            mkStage({ id: "b", sort_order: 2 }),
            mkStage({ id: "a", sort_order: 1 }),
        ]
        const snapshot = stages.map((s) => s.id)
        sortStages(stages)
        expect(stages.map((s) => s.id)).toEqual(snapshot)
    })
})
