"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, Check, Loader2 } from "lucide-react"
import { Lead, PipelineStage, TransitionRule } from "@/types"
import { cn } from "@/lib/utils"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import { updatePipelineStageAction } from "@/app/actions/lead-actions"
import { toast } from "sonner"
import { TransitionPromptModal } from "./transition-prompt-modal"
import { StageBackwardConfirmModal } from "./stage-backward-confirm-modal"
import {
    findMatchingTransitionRule,
    isBackwardTransition,
    ruleRequiresPrompt,
    sortStages,
} from "@/features/leads/lib/stage-transitions"

// Visual styling per stage color, mirroring the kanban accent palette so the
// inline editor reads consistently with the board view.
const DOT_COLOR: Record<string, string> = {
    blue: "bg-blue-500",
    amber: "bg-amber-500",
    violet: "bg-violet-500",
    emerald: "bg-emerald-500",
    red: "bg-red-500",
    rose: "bg-rose-500",
    pink: "bg-pink-500",
    cyan: "bg-cyan-500",
    orange: "bg-orange-500",
    gray: "bg-slate-400",
    slate: "bg-slate-400",
}

const PILL_STYLE: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    violet: "bg-violet-50 text-violet-700 ring-violet-100",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    red: "bg-rose-50 text-rose-700 ring-rose-100",
    rose: "bg-rose-50 text-rose-700 ring-rose-100",
    pink: "bg-pink-50 text-pink-700 ring-pink-100",
    cyan: "bg-cyan-50 text-cyan-700 ring-cyan-100",
    orange: "bg-orange-50 text-orange-700 ring-orange-100",
    gray: "bg-slate-50 text-slate-600 ring-slate-100",
    slate: "bg-slate-50 text-slate-600 ring-slate-100",
}

function pillStyleFor(color: string | null | undefined): string {
    if (!color) return PILL_STYLE.slate
    return PILL_STYLE[color] ?? PILL_STYLE.slate
}

function dotColorFor(color: string | null | undefined): string {
    if (!color) return DOT_COLOR.slate
    return DOT_COLOR[color] ?? DOT_COLOR.slate
}

export interface StageCellEditorProps {
    lead: Lead
    stages: PipelineStage[]
    transitionRules: TransitionRule[]
    /**
     * Optimistic UI update fired the moment the user picks a new stage.
     * Parent should patch its local lead state so badges across views
     * reflect the change immediately.
     */
    onStageChanged?: (
        leadId: number,
        stage: PipelineStage,
        leadUpdates?: Record<string, unknown>,
    ) => void
}

/**
 * Inline stage selector rendered inside the leads table cell.
 *
 * Behavior:
 *  - Click the stage badge → popover with searchable stage list.
 *  - Picking a stage with `sort_order < current` triggers a confirm warn.
 *  - Picking a stage that has a transition rule with required fields opens
 *    the existing `TransitionPromptModal` (same one the kanban uses).
 *  - Otherwise the change is applied immediately via `updatePipelineStageAction`.
 */
export function StageCellEditor({
    lead,
    stages,
    transitionRules,
    onStageChanged,
}: StageCellEditorProps) {
    const [open, setOpen] = useState(false)
    const [pending, setPending] = useState(false)
    const [backwardTarget, setBackwardTarget] = useState<PipelineStage | null>(null)
    const [promptState, setPromptState] = useState<{
        lead: Lead
        oldStageId: string
        newStageId: string
        rule: TransitionRule
    } | null>(null)

    // Track latest lead ref so async optimistic flows always update the
    // freshest stage label even after a re-render.
    const leadRef = useRef(lead)
    useEffect(() => {
        leadRef.current = lead
    }, [lead])

    const ordered = useMemo(() => sortStages(stages), [stages])
    const currentStage = useMemo(() => {
        const byId = lead.pipeline_stage_id
            ? ordered.find((s) => s.id === lead.pipeline_stage_id)
            : undefined
        if (byId) return byId
        const fallbackName = lead.pipeline_stage?.name ?? lead.status
        if (!fallbackName) return null
        return (
            ordered.find(
                (s) => s.name.toLowerCase() === fallbackName.toLowerCase(),
            ) ?? null
        )
    }, [ordered, lead.pipeline_stage_id, lead.pipeline_stage?.name, lead.status])

    const labelText = currentStage?.name ?? lead.pipeline_stage?.name ?? lead.status ?? ""

    const showSearch = ordered.length > 7

    const applyStageChange = async (target: PipelineStage) => {
        setPending(true)
        // Fire optimistic update first so the badge updates without flicker.
        onStageChanged?.(leadRef.current.id, target)
        const result = await updatePipelineStageAction(leadRef.current.id, target.id)
        setPending(false)
        if (!result.success) {
            toast.error(`Failed to change stage: ${result.error}`)
            // Revert optimistic update by re-emitting the prior stage.
            if (currentStage) {
                onStageChanged?.(leadRef.current.id, currentStage)
            }
            return
        }
        toast.success(`Moved to ${target.name}`)
    }

    const handleSelect = (target: PipelineStage) => {
        if (pending) return
        setOpen(false)
        if (!currentStage) {
            // No current stage to compare with — just apply.
            void applyStageChange(target)
            return
        }
        if (target.id === currentStage.id) return

        const rule = findMatchingTransitionRule(
            transitionRules,
            currentStage.id,
            target.id,
        )

        if (ruleRequiresPrompt(rule)) {
            setPromptState({
                lead: leadRef.current,
                oldStageId: currentStage.id,
                newStageId: target.id,
                rule: rule!,
            })
            return
        }

        if (isBackwardTransition(currentStage, target)) {
            setBackwardTarget(target)
            return
        }

        void applyStageChange(target)
    }

    const handleBackwardConfirm = async () => {
        if (!backwardTarget) return
        const target = backwardTarget
        setBackwardTarget(null)
        await applyStageChange(target)
    }

    const handlePromptSuccess = (
        leadId: number,
        newStageId: string,
        leadUpdates: Record<string, unknown>,
    ) => {
        const target = ordered.find((s) => s.id === newStageId)
        if (target) {
            onStageChanged?.(leadId, target, leadUpdates)
            toast.success(`Moved to ${target.name}`)
        }
        setPromptState(null)
    }

    if (!labelText) {
        return <span className="text-slate-300">—</span>
    }

    return (
        <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
            <Popover open={open} onOpenChange={(next) => !pending && setOpen(next)}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        onClick={(e) => {
                            // The row has its own click handler — don't navigate while editing.
                            e.stopPropagation()
                        }}
                        disabled={pending}
                        className={cn(
                            "group inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset transition-colors",
                            "max-w-[160px] cursor-pointer",
                            pillStyleFor(currentStage?.color),
                            "hover:brightness-[0.97] hover:ring-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
                            pending && "opacity-70 cursor-wait",
                        )}
                        aria-label={`Change stage from ${labelText}`}
                    >
                        <span
                            className={cn(
                                "h-1.5 w-1.5 shrink-0 rounded-full",
                                dotColorFor(currentStage?.color),
                            )}
                            aria-hidden
                        />
                        <span className="truncate">{labelText}</span>
                        {pending ? (
                            <Loader2 className="h-3 w-3 shrink-0 animate-spin opacity-60" aria-hidden />
                        ) : (
                            <ChevronDown
                                className="h-3 w-3 shrink-0 opacity-50 transition-transform group-data-[state=open]:rotate-180"
                                aria-hidden
                            />
                        )}
                    </button>
                </PopoverTrigger>
                <PopoverContent
                    align="start"
                    sideOffset={4}
                    className="w-[240px] p-0"
                    onClick={(e) => e.stopPropagation()}
                >
                    <Command>
                        {showSearch && (
                            <CommandInput
                                placeholder="Search stage..."
                                className="h-8 text-[12px]"
                            />
                        )}
                        <CommandList>
                            <CommandEmpty>No stage found.</CommandEmpty>
                            <CommandGroup>
                                {ordered.map((stage) => {
                                    const isCurrent = currentStage?.id === stage.id
                                    return (
                                        <CommandItem
                                            key={stage.id}
                                            value={stage.name}
                                            onSelect={() => handleSelect(stage)}
                                            className="flex items-center gap-2 px-2 py-1.5 text-[12px]"
                                        >
                                            <span
                                                className={cn(
                                                    "h-1.5 w-1.5 shrink-0 rounded-full",
                                                    dotColorFor(stage.color),
                                                )}
                                                aria-hidden
                                            />
                                            <span className="flex-1 truncate text-slate-700">
                                                {stage.name}
                                            </span>
                                            {stage.stage_type === "closed" && (
                                                <span className="text-[10px] uppercase tracking-wide text-slate-400">
                                                    {stage.closed_status ?? "closed"}
                                                </span>
                                            )}
                                            {isCurrent && (
                                                <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                                            )}
                                        </CommandItem>
                                    )
                                })}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>

            <StageBackwardConfirmModal
                open={!!backwardTarget}
                fromStageName={currentStage?.name ?? ""}
                toStageName={backwardTarget?.name ?? ""}
                leadLabel={lead.project_name ?? lead.client_company?.name ?? undefined}
                loading={pending}
                onConfirm={() => void handleBackwardConfirm()}
                onCancel={() => setBackwardTarget(null)}
            />

            <TransitionPromptModal
                prompt={promptState}
                onClose={() => setPromptState(null)}
                onSuccess={handlePromptSuccess}
            />
        </div>
    )
}
