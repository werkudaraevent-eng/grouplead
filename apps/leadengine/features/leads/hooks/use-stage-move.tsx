"use client"

import { useCallback, useState, type Dispatch, type SetStateAction } from "react"
import { toast } from "sonner"
import { updatePipelineStageAction } from "@/app/actions/lead-actions"
import type { Lead, PipelineStage, TransitionRule } from "@/types"
import { TransitionPromptModal } from "@/features/leads/components/transition-prompt-modal"
import { StageBackwardConfirmModal } from "@/features/leads/components/stage-backward-confirm-modal"
import {
    findMatchingTransitionRule,
    isBackwardTransition,
    ruleRequiresPrompt,
    topOfStageSortOrder,
} from "@/features/leads/lib/stage-transitions"

/** What a board tells its page once a lead has moved (the page's `handleLeadStageChange`). */
export type LeadStageChange = (
    leadId: number,
    stageId: string,
    stageName: string,
    stageColor: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updates?: Record<string, any>,
) => void

interface TransitionPrompt {
    lead: Lead
    oldStageId: string
    newStageId: string
    rule: TransitionRule
    newSortOrder?: number
}

interface BackwardPrompt {
    lead: Lead
    fromStage: PipelineStage
    toStage: PipelineStage
    newSortOrder: number
}

/**
 * Moving a lead from one stage to another, the one way the Pipeline does
 * it: the kanban's drop, the kanban card's Move menu and the phone's
 * "Move to stage…" all run through here.
 *
 * Before a move runs, a transition rule that asks for fields, a note or an
 * attachment opens its prompt (`TransitionPromptModal`, which saves the
 * move with what it asked for), and a move to an earlier stage asks first
 * (`StageBackwardConfirmModal`). A move with neither runs at once:
 * `updatePipelineStageAction` (the `leads.update` grant, closed dates
 * stamped, the stage history written), a "Moved to …" toast before the
 * answer, the board rolled back with an error if it fails, and the page
 * told through `onLeadStageChange` if it lands.
 *
 * `leads` is what the board draws (its own copy, moved ahead of the
 * server); `initialLeads` is the page's list, which a failed move returns
 * the board to.
 */
export function useStageMove({
    leads,
    initialLeads,
    setLeads,
    stages,
    transitionRules,
    canMoveLeads,
    onLeadStageChange,
}: {
    leads: Lead[]
    initialLeads: Lead[]
    setLeads: Dispatch<SetStateAction<Lead[]>>
    stages: PipelineStage[]
    transitionRules: TransitionRule[]
    /** `leads.update`; without it nothing moves and no request is made. */
    canMoveLeads: boolean
    onLeadStageChange?: LeadStageChange
}) {
    const [transitionPrompt, setTransitionPrompt] = useState<TransitionPrompt | null>(null)
    const [backwardPrompt, setBackwardPrompt] = useState<BackwardPrompt | null>(null)
    const [backwardPending, setBackwardPending] = useState(false)

    // Persist a stage transition to the server with optimistic-cleanup +
    // toast feedback. Shared by the drop, the menus and the backward
    // confirm, so all of them execute one way.
    const executeStageTransition = useCallback(
        async (
            leadId: number,
            destinationStageId: string,
            newSortOrder: number,
            originalStageId: string,
        ) => {
            const destinationStage = stages.find((s) => s.id === destinationStageId)

            // Optimistic feedback: the card already moved, so confirm
            // immediately rather than waiting for the server round-trip. If
            // the server later rejects, we roll back and show an error.
            const movedToNewStage = originalStageId !== destinationStageId
            if (movedToNewStage) {
                toast.success(`Moved to ${destinationStage?.name || "stage"}`)
            }

            const result = await updatePipelineStageAction(leadId, destinationStageId, newSortOrder)

            if (!result.success) {
                // Map the technical guard message to a friendly one. The
                // server returns "Forbidden: missing update permission on
                // leads" when the role lacks leads.update — surface that as a
                // plain "no permission" message instead of leaking internals.
                const isPermissionError = /forbidden|permission/i.test(result.error ?? "")
                toast.error(
                    isPermissionError
                        ? "You don't have permission to move leads"
                        : "Couldn't move the lead. Please try again.",
                )
                setLeads(initialLeads)
                return false
            }

            if (onLeadStageChange && destinationStage) {
                onLeadStageChange(
                    leadId,
                    destinationStage.id,
                    destinationStage.name,
                    destinationStage.color,
                    { kanban_sort_order: newSortOrder },
                )
            }
            return true
        },
        [stages, initialLeads, onLeadStageChange, setLeads],
    )

    /**
     * Opens what a move must pass before it runs: the rule's prompt, or the
     * backward warning. True when one opened, and the caller stops there.
     */
    const promptBeforeMove = useCallback(
        (lead: Lead, fromStageId: string, toStageId: string, newSortOrder: number): boolean => {
            const matchedRule = findMatchingTransitionRule(transitionRules, fromStageId, toStageId)
            if (ruleRequiresPrompt(matchedRule)) {
                setTransitionPrompt({
                    lead,
                    oldStageId: fromStageId,
                    newStageId: toStageId,
                    rule: matchedRule!,
                    newSortOrder,
                })
                return true
            }

            // Warn before letting the user move a lead backward in the pipeline.
            const fromStage = stages.find((s) => s.id === fromStageId)
            const toStage = stages.find((s) => s.id === toStageId)
            if (fromStage && toStage && isBackwardTransition(fromStage, toStage)) {
                setBackwardPrompt({ lead, fromStage, toStage, newSortOrder })
                return true
            }
            return false
        },
        [stages, transitionRules],
    )

    /**
     * A move chosen from a menu rather than dropped: the lead goes to the
     * top of the stage, through the same rules and warnings as a drop.
     */
    const moveToStage = useCallback(
        (lead: Lead, target: PipelineStage) => {
            if (!canMoveLeads) return
            const originalStageId = lead.pipeline_stage_id
            if (!originalStageId || target.id === originalStageId) return

            // The moved card surfaces at the top of its new stage.
            const newSortOrder = topOfStageSortOrder(leads, target.id)

            if (promptBeforeMove(lead, originalStageId, target.id, newSortOrder)) return

            // Optimistic update so the card moves immediately.
            setLeads((prev) =>
                prev.map((l) =>
                    l.id === lead.id
                        ? {
                              ...l,
                              pipeline_stage_id: target.id,
                              status: target.name,
                              pipeline_stage: { name: target.name, color: target.color },
                              kanban_sort_order: newSortOrder,
                          }
                        : l,
                ),
            )

            void executeStageTransition(lead.id, target.id, newSortOrder, originalStageId)
        },
        [leads, canMoveLeads, promptBeforeMove, setLeads, executeStageTransition],
    )

    const dialogs = (
        <>
            <StageBackwardConfirmModal
                open={!!backwardPrompt}
                fromStageName={backwardPrompt?.fromStage.name ?? ""}
                toStageName={backwardPrompt?.toStage.name ?? ""}
                leadLabel={backwardPrompt?.lead.project_name ?? backwardPrompt?.lead.client_company?.name ?? undefined}
                loading={backwardPending}
                onCancel={() => setBackwardPrompt(null)}
                onConfirm={async () => {
                    if (!backwardPrompt) return
                    setBackwardPending(true)
                    const ok = await executeStageTransition(
                        backwardPrompt.lead.id,
                        backwardPrompt.toStage.id,
                        backwardPrompt.newSortOrder,
                        backwardPrompt.fromStage.id,
                    )
                    setBackwardPending(false)
                    if (ok) setBackwardPrompt(null)
                }}
            />

            <TransitionPromptModal
                prompt={transitionPrompt}
                onClose={() => setTransitionPrompt(null)}
                onSuccess={(leadId, newStageId, updates) => {
                    const destinationStage = stages.find((s) => s.id === newStageId)
                    // Update local leads list with the new stage + updated form fields
                    setLeads((prev) =>
                        prev.map((l) =>
                            l.id === leadId
                                ? { ...l, pipeline_stage_id: newStageId, status: destinationStage?.name ?? l.status, ...updates }
                                : l,
                        ),
                    )
                    setTransitionPrompt(null)

                    if (onLeadStageChange && destinationStage) {
                        onLeadStageChange(leadId, destinationStage.id, destinationStage.name, destinationStage.color, updates)
                    }
                }}
            />
        </>
    )

    return { executeStageTransition, promptBeforeMove, moveToStage, dialogs }
}
