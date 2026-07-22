import { PipelineStage, TransitionRule } from "@/types"

/**
 * Returns true when moving from `fromStage` to `toStage` constitutes a
 * backward transition (lower sort_order in the same pipeline).
 *
 * Same stage returns false. Cross-pipeline moves return false (treated as
 * neutral — caller should validate pipeline equality separately).
 */
export function isBackwardTransition(
    fromStage: Pick<PipelineStage, "id" | "sort_order"> | null | undefined,
    toStage: Pick<PipelineStage, "id" | "sort_order"> | null | undefined,
): boolean {
    if (!fromStage || !toStage) return false
    if (fromStage.id === toStage.id) return false
    return toStage.sort_order < fromStage.sort_order
}

/**
 * Finds the matching transition rule for a stage transition.
 * Prefers a rule with an explicit `from_stage_id` over a wildcard
 * (`from_stage_id === null`) rule for the same destination.
 */
export function findMatchingTransitionRule(
    rules: TransitionRule[],
    fromStageId: string,
    toStageId: string,
): TransitionRule | null {
    const explicit = rules.find(
        (r) => r.from_stage_id === fromStageId && r.to_stage_id === toStageId,
    )
    if (explicit) return explicit
    const wildcard = rules.find(
        (r) => r.from_stage_id === null && r.to_stage_id === toStageId,
    )
    return wildcard ?? null
}

/**
 * Returns true when the rule has any prompt-worthy requirement
 * (required fields, mandatory note, or mandatory attachment).
 * Rules with empty constraints can be applied silently.
 */
export function ruleRequiresPrompt(rule: TransitionRule | null | undefined): boolean {
    if (!rule) return false
    return (
        (rule.required_fields?.length ?? 0) > 0 ||
        rule.note_required === true ||
        rule.attachment_required === true
    )
}

/**
 * Sorts pipeline stages canonically: open stages first by sort_order,
 * then closed stages by sort_order. Mirrors the order users see in kanban.
 */
export function sortStages(stages: PipelineStage[]): PipelineStage[] {
    return [...stages].sort((a, b) => {
        if (a.stage_type !== b.stage_type) return a.stage_type === "open" ? -1 : 1
        return a.sort_order - b.sort_order
    })
}
