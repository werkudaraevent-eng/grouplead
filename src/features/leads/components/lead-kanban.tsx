"use client"

import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react"
import { createPortal } from "react-dom"
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    useSensor,
    useSensors,
    type DragStartEvent,
    type DragEndEvent,
    type DragOverEvent,
    closestCorners,
} from "@dnd-kit/core"
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useDroppable } from "@dnd-kit/core"
import { Lead, PipelineStage, TransitionRule } from "@/types"
import { createClient } from "@/utils/supabase/client"
import { useCurrency } from "@/contexts/currency-context"
import { usePermissions } from "@/contexts/permissions-context"
import { Tooltip } from "@/components/ui/tooltip"
import { toast } from "sonner"
import { updatePipelineStageAction } from "@/app/actions/lead-actions"
import { renameStageAction, cloneStageAction, deleteStageAction } from "@/app/actions/stage-actions"
import { Building2, CalendarDays, CheckCircle2, ChevronsRight, Copy, Edit2, Globe, Loader2, MoreHorizontal, Pencil, Trash2, User, XCircle, Clock, Check, ThumbsDown, ThumbsUp } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Settings2, Plus } from "lucide-react"
import { TransitionPromptModal } from "./transition-prompt-modal"
import { StageBackwardConfirmModal } from "./stage-backward-confirm-modal"
import {
    findMatchingTransitionRule,
    isBackwardTransition,
    ruleRequiresPrompt,
} from "@/features/leads/lib/stage-transitions"

export interface KanbanCardConfig {
    badges: string[]
    metrics: string[]
}

const DEFAULT_KANBAN_CONFIG: KanbanCardConfig = {
    badges: ['grade_lead', 'main_stream', 'event_format'],
    metrics: ['estimated_value', 'target_close_date', 'pic'],
}

// Subtle accent colors per stage
const BG_COLOR_MAP: Record<string, string> = {
    blue: "bg-blue-500",
    amber: "bg-amber-500",
    violet: "bg-violet-500",
    emerald: "bg-emerald-500",
    red: "bg-red-500",
    pink: "bg-pink-500",
    cyan: "bg-cyan-500",
    orange: "bg-orange-500",
    gray: "bg-slate-400",
}

const FALLBACK_STAGES: PipelineStage[] = [
    { id: "1", name: "Lead Masuk", color: "blue", sort_order: 1, is_default: true, stage_type: "open", created_at: "" },
    { id: "2", name: "Estimasi Project", color: "amber", sort_order: 2, is_default: true, stage_type: "open", created_at: "" },
    { id: "3", name: "Proposal Sent", color: "violet", sort_order: 3, is_default: true, stage_type: "open", created_at: "" },
    { id: "4", name: "Closed Won", color: "emerald", sort_order: 4, is_default: true, stage_type: "closed", created_at: "" },
    { id: "5", name: "Closed Lost", color: "red", sort_order: 5, is_default: true, stage_type: "closed", created_at: "" },
]

interface LeadKanbanProps {
    leads: Lead[]
    onSelectLead: (lead: Lead) => void
    onQuickEdit?: (lead: Lead) => void
    onDeleteLead?: (leadId: number) => void
    pipelineId?: string
    selectedIds: string[]
    onToggleSelect: (leadId: string, checked: boolean) => void
    onLeadStageChange?: (leadId: number, stageId: string, stageName: string, stageColor: string, updates?: Record<string, any>) => void
    onAddLead?: (stageId: string) => void
    /** When false, disables reordering within a column (but stage transitions still work) */
    dndEnabled?: boolean
}

export function LeadKanban({
    leads: initialLeads,
    onSelectLead,
    onQuickEdit,
    onDeleteLead,
    pipelineId,
    selectedIds,
    onToggleSelect,
    onLeadStageChange,
    onAddLead,
    dndEnabled = true,
}: LeadKanbanProps) {
    const { fmt: formatCompact } = useCurrency()
    const { can } = usePermissions()
    const canCreateStage = can("pipeline", "create")
    const canUpdateStage = can("pipeline", "update")
    const canDeleteStage = can("pipeline", "delete")
    const canManageStages = canCreateStage || canUpdateStage || canDeleteStage
    // Moving a lead between stages (or reordering) is a leads.update write.
    // When the role lacks that grant we disable drag entirely so the card
    // can't be picked up at all — no failed server round-trip, no error toast.
    const canMoveLeads = can("leads", "update")
    const [stages, setStages] = useState<PipelineStage[]>(FALLBACK_STAGES)
    const [leads, setLeads] = useState<Lead[]>(initialLeads)
    const [loading, setLoading] = useState(true)
    const [activeId, setActiveId] = useState<string | null>(null)
    const [renameStageId, setRenameStageId] = useState<string | null>(null)
    const [renameValue, setRenameValue] = useState("")
    const [deleteStageTarget, setDeleteStageTarget] = useState<PipelineStage | null>(null)
    const [transitionRules, setTransitionRules] = useState<TransitionRule[]>([])
    const [transitionPrompt, setTransitionPrompt] = useState<{
        lead: Lead;
        oldStageId: string;
        newStageId: string;
        rule: TransitionRule;
        newSortOrder?: number;
    } | null>(null)
    const [backwardPrompt, setBackwardPrompt] = useState<{
        lead: Lead;
        fromStage: PipelineStage;
        toStage: PipelineStage;
        newSortOrder: number;
    } | null>(null)
    const [backwardPending, setBackwardPending] = useState(false)
    const supabase = createClient()

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
    )

    useEffect(() => { setLeads(initialLeads) }, [initialLeads])

    const [config, setConfig] = useState<KanbanCardConfig>(DEFAULT_KANBAN_CONFIG)
    const [configSaving, setConfigSaving] = useState(false)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        const fetchStagesAndConfig = async () => {
            // Fetch configuration
            const { data: authData } = await supabase.auth.getUser()
            if (authData?.user) {
                const { data: profile } = await supabase.from('profiles').select('ui_preferences').eq('id', authData.user.id).single()
                if (profile?.ui_preferences && typeof profile.ui_preferences === 'object') {
                    const uiPrefs = profile.ui_preferences as any
                    if (uiPrefs.kanban) {
                        setConfig((prev) => ({ ...prev, ...uiPrefs.kanban }))
                    }
                }
            }

            let query = supabase
                .from("pipeline_stages")
                .select("*")
                .order("sort_order", { ascending: true })
            
            let rulesQuery = supabase.from("pipeline_transition_rules").select("*")

            if (pipelineId) {
                query = query.eq("pipeline_id", pipelineId)
                rulesQuery = rulesQuery.eq("pipeline_id", pipelineId)
            }
            const [{ data, error }, { data: rulesData }] = await Promise.all([query, rulesQuery])

            if (rulesData) {
                setTransitionRules(rulesData as TransitionRule[])
            }
            if (!error && data && data.length > 0) {
                const sorted = data.sort((a, b) => {
                    if (a.stage_type !== b.stage_type) return a.stage_type === 'open' ? -1 : 1
                    return a.sort_order - b.sort_order
                })
                setStages(sorted)
            }
            setLoading(false)
        }
        fetchStagesAndConfig()
    }, [pipelineId, supabase])

    const handleSaveConfig = async (newConfig: KanbanCardConfig) => {
        setConfig(newConfig)
        const { data: authData } = await supabase.auth.getUser()
        if (!authData?.user) return
        setConfigSaving(true)
        const { data: profile } = await supabase.from('profiles').select('ui_preferences').eq('id', authData.user.id).single()
        const currentPrefs = typeof profile?.ui_preferences === 'object' && profile?.ui_preferences ? profile.ui_preferences : {}
        await supabase.from('profiles').update({
            ui_preferences: { ...currentPrefs, kanban: newConfig }
        }).eq('id', authData.user.id)
        setConfigSaving(false)
        toast.success("Kanban card properties saved")
    }

    const toggleBadge = (badge: string) => {
        const selected = config.badges.includes(badge)
        let next = [...config.badges]
        if (selected) {
            next = next.filter(b => b !== badge)
        } else {
            if (next.length >= 3) return // MAX 3 badges
            next.push(badge)
        }
        handleSaveConfig({ ...config, badges: next })
    }

    const toggleMetric = (metric: string) => {
        const selected = config.metrics.includes(metric)
        let next = [...config.metrics]
        if (selected) {
            next = next.filter(m => m !== metric)
        } else {
            if (next.length >= 3) return // MAX 3 metrics
            next.push(metric)
        }
        handleSaveConfig({ ...config, metrics: next })
    }

    const grouped = useMemo(() => {
        return stages.map((stage) => ({
            ...stage,
            leads: leads.filter(
                (l) => l.pipeline_stage_id
                    ? l.pipeline_stage_id === stage.id
                    : (l.status || "").toLowerCase() === stage.name.toLowerCase()
            ),
        }))
    }, [stages, leads])

    // ─── Stage Management Handlers ───────────────────────────────
    // All writes route through gated server actions (the `pipeline` RBAC
    // module). Local state updates optimistically; on failure we surface the
    // server's error and leave state untouched.
    const handleRenameStage = async (stageId: string, newName: string) => {
        const name = newName.trim()
        if (!name) { setRenameStageId(null); return }
        if (!canUpdateStage) {
            toast.error("You don't have permission to rename stages")
            setRenameStageId(null)
            return
        }
        const res = await renameStageAction(stageId, name)
        if (!res.success) {
            toast.error(`Rename failed: ${res.error}`)
        } else {
            setStages(prev => prev.map(s => s.id === stageId ? { ...s, name } : s))
            toast.success("Stage renamed")
        }
        setRenameStageId(null)
    }

    const handleCloneStage = async (stage: PipelineStage) => {
        if (!canCreateStage) {
            toast.error("You don't have permission to create stages")
            return
        }
        const res = await cloneStageAction(stage.id)
        if (!res.success) {
            toast.error(`Clone failed: ${res.error}`)
        } else if (res.data) {
            setStages(prev => [...prev, res.data as PipelineStage])
            toast.success(`Stage "${res.data.name}" created`)
        }
    }

    const handleDeleteStage = async (stageId: string) => {
        if (!canDeleteStage) {
            toast.error("You don't have permission to delete stages")
            setDeleteStageTarget(null)
            return
        }
        // Move any leads in this stage to the first available stage
        const fallbackStage = stages.find(s => s.id !== stageId)
        const res = await deleteStageAction(stageId, fallbackStage?.id ?? null)
        if (!res.success) {
            toast.error(`Delete failed: ${res.error}`)
        } else {
            if (fallbackStage) {
                setLeads(prev => prev.map(l =>
                    l.pipeline_stage_id === stageId
                        ? { ...l, pipeline_stage_id: fallbackStage.id }
                        : l
                ))
            }
            setStages(prev => prev.filter(s => s.id !== stageId))
            toast.success("Stage deleted")
        }
        setDeleteStageTarget(null)
    }

    const activeLead = activeId ? leads.find((l) => l.id.toString() === activeId) : null

    const handleDragStart = useCallback((event: DragStartEvent) => {
        if (!canMoveLeads) return
        setActiveId(String(event.active.id))
    }, [canMoveLeads])

    const handleDragOver = useCallback((event: DragOverEvent) => {
        if (!canMoveLeads) return
        const { active, over } = event
        if (!over) return

        const activeLeadId = parseInt(String(active.id), 10)
        const overId = String(over.id)

        const overStage = stages.find((s) => s.id === overId)

        setLeads((prev) => {
            const activeLead = prev.find((l) => l.id === activeLeadId)
            if (!activeLead) return prev

            const overLead = prev.find((l) => l.id.toString() === overId)
            const overStageId = overStage ? overStage.id : overLead?.pipeline_stage_id

            if (!overStageId) return prev

            const newStage = stages.find((s) => s.id === overStageId)
            const activeIndex = prev.findIndex(l => l.id === activeLeadId)
            const overIndex = prev.findIndex(l => l.id.toString() === overId)
            
            // Same stage → reorder within column
            if (activeLead.pipeline_stage_id === overStageId) {
                if (activeIndex !== overIndex && overIndex >= 0) {
                    return arrayMove(prev, activeIndex, overIndex)
                }
                return prev
            }
            
            // Cross-stage → remove from old column, insert at drop position in new column
            let newIndex
            if (overStage) {
                // Dropped on stage header → append to end
                newIndex = prev.length
            } else {
                newIndex = overIndex >= 0 ? overIndex + (overIndex > activeIndex ? 1 : 0) : prev.length
            }

            // Bail out when nothing actually changes. `handleDragOver` fires on
            // every pointer move, so without this guard we allocate a fresh
            // array (and re-render) even when the card is already where it
            // would land. Cheapest possible no-op keeps dragging smooth.
            if (newIndex === activeIndex && activeLead.pipeline_stage_id === overStageId) {
                return prev
            }

            const newLead = { ...prev[activeIndex], pipeline_stage_id: overStageId, status: newStage?.name ?? prev[activeIndex].status }
            const prevWithoutActive = prev.filter(l => l.id !== activeLeadId)
            
            return [
                ...prevWithoutActive.slice(0, newIndex),
                newLead,
                ...prevWithoutActive.slice(newIndex)
            ]
        })
    }, [stages, canMoveLeads])

    // Persist a stage transition to the server with optimistic-cleanup +
    // toast feedback. Extracted so both the drag handler and the backward
    // confirm flow share one execution path.
    const executeStageTransition = useCallback(
        async (
            activeLeadId: number,
            destinationStageId: string,
            newSortOrder: number,
            originalStageId: string,
        ) => {
            const destinationStage = stages.find((s) => s.id === destinationStageId)

            // Optimistic feedback: the card already moved on drop, so confirm
            // immediately rather than waiting for the server round-trip. This
            // is what makes the board feel instant on global kanban apps. If
            // the server later rejects, we roll back and show an error.
            const movedToNewStage = originalStageId !== destinationStageId
            if (movedToNewStage) {
                toast.success(`Moved to ${destinationStage?.name || "stage"}`)
            }

            const result = await updatePipelineStageAction(
                activeLeadId,
                destinationStageId,
                newSortOrder,
            )

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
                    activeLeadId,
                    destinationStage.id,
                    destinationStage.name,
                    destinationStage.color,
                    { kanban_sort_order: newSortOrder },
                )
            }
            return true
        },
        [stages, initialLeads, onLeadStageChange],
    )

    const handleDragEnd = useCallback(async (event: DragEndEvent) => {
        const { active, over } = event
        setActiveId(null)
        if (!canMoveLeads) return
        if (!over) return

        const activeLeadId = parseInt(String(active.id), 10)
        const originalLead = initialLeads.find((l) => l.id === activeLeadId)
        const dragLead = leads.find((l) => l.id === activeLeadId)
        
        if (!originalLead || !dragLead) return
        
        const originalStageId = originalLead.pipeline_stage_id
        const destinationStageId = dragLead.pipeline_stage_id

        if (!originalStageId || !destinationStageId) {
            setLeads(initialLeads) 
            return
        }

        const stageLeads = leads.filter(l => l.pipeline_stage_id === destinationStageId)
        const newIndex = stageLeads.findIndex(l => l.id === activeLeadId)
        
        const orderBefore = newIndex > 0 ? stageLeads[newIndex - 1].kanban_sort_order ?? Date.now() : null
        const orderAfter = newIndex < stageLeads.length - 1 ? stageLeads[newIndex + 1].kanban_sort_order ?? (Date.now() - 100000) : null
        
        let newSortOrder: number
        if (orderBefore !== null && orderAfter !== null) {
            newSortOrder = (orderBefore + orderAfter) / 2
        } else if (orderBefore !== null) {
            newSortOrder = orderBefore - 1000
        } else if (orderAfter !== null) {
            newSortOrder = orderAfter + 1000
        } else {
            newSortOrder = Date.now()
        }

        if (originalStageId !== destinationStageId) {
            const matchedRule = findMatchingTransitionRule(
                transitionRules,
                originalStageId,
                destinationStageId,
            )

            if (ruleRequiresPrompt(matchedRule)) {
                setLeads(initialLeads)
                setTransitionPrompt({
                    lead: originalLead,
                    oldStageId: originalStageId,
                    newStageId: destinationStageId,
                    rule: matchedRule!,
                    newSortOrder
                })
                return
            }

            // Warn before letting the user move a lead backward in the pipeline.
            const fromStage = stages.find((s) => s.id === originalStageId)
            const toStage = stages.find((s) => s.id === destinationStageId)
            if (fromStage && toStage && isBackwardTransition(fromStage, toStage)) {
                setLeads(initialLeads)
                setBackwardPrompt({
                    lead: originalLead,
                    fromStage,
                    toStage,
                    newSortOrder,
                })
                return
            }
        } else {
            const originalIndex = initialLeads.findIndex(l => l.id === activeLeadId)
            const currentIndex = leads.findIndex(l => l.id === activeLeadId)
            if (originalIndex === currentIndex) return // did not genuinely sort
            // Within-column reorder is only meaningful when user is in manual
            // sort mode. Otherwise keep visual position but don't persist.
            if (!dndEnabled) {
                setLeads(initialLeads)
                return
            }
        }

        await executeStageTransition(
            activeLeadId,
            destinationStageId,
            newSortOrder,
            originalStageId,
        )
    }, [leads, stages, initialLeads, transitionRules, executeStageTransition, canMoveLeads])

    const handleDragCancel = useCallback(() => {
        setActiveId(null)
        setLeads(initialLeads)
    }, [initialLeads])

    // Quick stage move triggered from a card menu (no drag).
    // Honors transition rules and backward warnings just like drag.
    const handleQuickMoveStage = useCallback(
        (lead: Lead, target: PipelineStage) => {
            if (!canMoveLeads) return
            const originalStageId = lead.pipeline_stage_id
            if (!originalStageId || target.id === originalStageId) return

            // Compute a new sort_order at the top of the destination column so
            // the moved card surfaces as most recent.
            const stageLeads = leads.filter(l => l.pipeline_stage_id === target.id)
            const topOrder = stageLeads.reduce((max, l) => {
                const v = l.kanban_sort_order
                return typeof v === "number" && v > max ? v : max
            }, 0)
            const newSortOrder = (topOrder || Date.now() / 1000) + 1000

            const matchedRule = findMatchingTransitionRule(
                transitionRules,
                originalStageId,
                target.id,
            )
            if (ruleRequiresPrompt(matchedRule)) {
                setTransitionPrompt({
                    lead,
                    oldStageId: originalStageId,
                    newStageId: target.id,
                    rule: matchedRule!,
                    newSortOrder,
                })
                return
            }

            const fromStage = stages.find(s => s.id === originalStageId)
            if (fromStage && isBackwardTransition(fromStage, target)) {
                setBackwardPrompt({
                    lead,
                    fromStage,
                    toStage: target,
                    newSortOrder,
                })
                return
            }

            // Optimistic update so the card moves immediately.
            setLeads(prev => prev.map(l =>
                l.id === lead.id
                    ? {
                          ...l,
                          pipeline_stage_id: target.id,
                          status: target.name,
                          pipeline_stage: { name: target.name, color: target.color },
                          kanban_sort_order: newSortOrder,
                      }
                    : l,
            ))

            void executeStageTransition(lead.id, target.id, newSortOrder, originalStageId)
        },
        [leads, stages, transitionRules, executeStageTransition, canMoveLeads],
    )

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading pipeline...
            </div>
        )
    }

    const kanbanSettingsPortal = mounted && document.getElementById('kanban-settings-portal')
        ? createPortal(
            <Popover>
                <PopoverTrigger asChild>
                    <button className="bg-white/80 backdrop-blur border border-slate-200 shadow-sm hover:shadow hover:bg-white hover:border-slate-300 flex items-center justify-center gap-1.5 px-2.5 py-1 h-[28px] rounded-md text-xs font-medium text-slate-600 transition-all whitespace-nowrap shrink-0">
                        <Settings2 className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                        <div className="whitespace-nowrap overflow-visible">Card Settings <span className="opacity-60 font-medium ml-1">({config.badges.length + config.metrics.length})</span></div>
                    </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[300px] p-0" collisionPadding={16}>
                    <div className="p-3 border-b border-slate-100">
                        <h4 className="font-semibold text-[13px] text-slate-800">Card Properties</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">Customize properties shown on the cards.</p>
                    </div>
                    <div className="p-3 space-y-4">
                        {/* Badges */}
                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                                <Label className="text-[12px] font-semibold text-slate-700">Badges Layer</Label>
                                <span className={config.badges.length >= 3 ? "text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded font-medium border border-amber-200/50" : "text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium"}>{config.badges.length} / 3 max</span>
                            </div>
                            <div className="flex flex-col gap-2">
                                {[
                                    { id: "grade_lead", label: "Lead Grade (A/B/C)" },
                                    { id: "category", label: "Category (Hot/Warm/Cold)" },
                                    { id: "lead_source", label: "Lead Source" },
                                    { id: "main_stream", label: "Main Stream" },
                                    { id: "event_format", label: "Event Format" },
                                    { id: "subsidiary", label: "Subsidiary Company" }
                                ].map(b => (
                                    <div key={b.id} className="flex items-center justify-between group">
                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                id={`badge-${b.id}`}
                                                checked={config.badges.includes(b.id)}
                                                onCheckedChange={() => toggleBadge(b.id)}
                                                disabled={!config.badges.includes(b.id) && config.badges.length >= 3}
                                            />
                                            <Label htmlFor={`badge-${b.id}`} className="text-[12px] cursor-pointer group-hover:text-slate-900 font-medium text-slate-600">{b.label}</Label>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Metrics */}
                        <div className="space-y-2.5 border-t border-slate-100 pt-4">
                            <div className="flex items-center justify-between">
                                <Label className="text-[12px] font-semibold text-slate-700">Footer Metrics</Label>
                                <span className={config.metrics.length >= 3 ? "text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded font-medium border border-amber-200/50" : "text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium"}>{config.metrics.length} / 3 max</span>
                            </div>
                            <div className="flex flex-col gap-2">
                                {[
                                    { id: "estimated_value", label: "Estimated Value" },
                                    { id: "target_close_date", label: "Target Close Date" },
                                    { id: "pic", label: "PIC Sales / Avatar" },
                                    { id: "account_manager", label: "Account Manager / Avatar" },
                                    { id: "manual_id", label: "Manual ID #" }
                                ].map(m => (
                                    <div key={m.id} className="flex items-center justify-between group">
                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                id={`metric-${m.id}`}
                                                checked={config.metrics.includes(m.id)}
                                                onCheckedChange={() => toggleMetric(m.id)}
                                                disabled={!config.metrics.includes(m.id) && config.metrics.length >= 3}
                                            />
                                            <Label htmlFor={`metric-${m.id}`} className="text-[12px] cursor-pointer group-hover:text-slate-900 font-medium text-slate-600">{m.label}</Label>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>,
            document.getElementById('kanban-settings-portal')!
        )
        : null

    return (
        <div className="flex flex-col h-full w-full relative">
            {kanbanSettingsPortal}

            <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
                autoScroll={{
                    threshold: { x: 0.18, y: 0.2 },
                    acceleration: 16,
                    interval: 5,
                }}
            >
                <div className="flex-1 overflow-x-auto overflow-y-hidden min-h-0 w-full kanban-horizontal-scroll pb-4">
                    <div className="flex h-full w-max items-start gap-5 px-1 relative">
                    {grouped.map((stage) => {
                        const accentBg = BG_COLOR_MAP[stage.color] || BG_COLOR_MAP.gray
                        const totalRevenue = stage.leads.reduce((sum, l) => sum + (l.estimated_value || 0), 0)
                        const leadIds = stage.leads.map((l) => l.id.toString())

                        return (
                            <div
                                key={stage.id}
                                className={`group/stage bg-slate-50/70 border border-slate-200/70 rounded-xl flex flex-col w-[300px] min-w-[300px] shrink-0 h-full max-h-full overflow-hidden relative shadow-[0_1px_2px_rgba(15,23,42,.03)]`}
                            >
                                {/* Column Header */}
                                <div className="px-3.5 py-2 shrink-0 bg-white/80 backdrop-blur-sm border-b border-slate-200/60 rounded-t-xl relative z-10">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <div className={`w-2 h-2 rounded-full ${accentBg} shrink-0`} />
                                            {renameStageId === stage.id ? (
                                                <input
                                                    autoFocus
                                                    defaultValue={renameValue}
                                                    className="font-semibold text-[13.5px] leading-tight text-slate-800 bg-transparent border-b border-blue-400 outline-none w-full py-0.5"
                                                    onBlur={(e) => handleRenameStage(stage.id, e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleRenameStage(stage.id, (e.target as HTMLInputElement).value)
                                                        if (e.key === 'Escape') setRenameStageId(null)
                                                    }}
                                                />
                                            ) : (
                                                <h3 className="font-semibold text-[13.5px] leading-tight text-slate-800 line-clamp-1 tracking-tight">
                                                    {stage.name}
                                                </h3>
                                            )}
                                            <span className="shrink-0 inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-slate-100 text-slate-500 text-[11px] font-medium tabular-nums">
                                                {stage.leads.length}
                                            </span>
                                            {totalRevenue > 0 && (
                                                <span className="shrink-0 ml-auto text-[10.5px] font-medium text-slate-400 tabular-nums">
                                                    {formatCompact(totalRevenue)}
                                                </span>
                                            )}
                                        </div>
                                        {canManageStages && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button type="button" className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all shrink-0 opacity-0 group-hover/stage:opacity-100">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-44">
                                                {canUpdateStage && (
                                                    <DropdownMenuItem onClick={() => {
                                                        setRenameValue(stage.name)
                                                        setRenameStageId(stage.id)
                                                    }}>
                                                        <Pencil className="mr-2 h-3.5 w-3.5" /> Rename
                                                    </DropdownMenuItem>
                                                )}
                                                {canCreateStage && (
                                                    <DropdownMenuItem onClick={() => handleCloneStage(stage)}>
                                                        <Copy className="mr-2 h-3.5 w-3.5" /> Clone Stage
                                                    </DropdownMenuItem>
                                                )}
                                                {canDeleteStage && (
                                                    <>
                                                        {(canUpdateStage || canCreateStage) && <DropdownMenuSeparator />}
                                                        <DropdownMenuItem
                                                            className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                                            disabled={stages.length <= 1}
                                                            onClick={() => setDeleteStageTarget(stage)}
                                                        >
                                                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete Stage
                                                        </DropdownMenuItem>
                                                    </>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                        )}
                                    </div>
                                </div>

                                {/* Droppable Card Zone */}
                                <SortableContext id={stage.id} items={leadIds} strategy={verticalListSortingStrategy}>
                                    <DroppableColumn stageId={stage.id} isEmpty={stage.leads.length === 0}>
                                        {stage.leads.map((lead) => (
                                            <SortableCard
                                                key={lead.id}
                                                lead={lead}
                                                onClick={() => onSelectLead(lead)}
                                                onQuickEdit={onQuickEdit ? () => onQuickEdit(lead) : undefined}
                                                onDeleteLead={onDeleteLead ? () => onDeleteLead(lead.id) : undefined}
                                                isSelected={selectedIds.includes(lead.id.toString())}
                                                onToggleSelect={onToggleSelect}
                                                config={config}
                                                dndEnabled={canMoveLeads}
                                                stages={stages}
                                                onQuickMoveStage={canMoveLeads ? (target) => handleQuickMoveStage(lead, target) : undefined}
                                            />
                                        ))}
                                    </DroppableColumn>
                                </SortableContext>
                                
                                {/* Add Lead Hover Action */}
                                <div className="absolute left-0 right-0 bottom-0 transform translate-y-full group-hover/stage:translate-y-0 transition-transform duration-200 z-20">
                                    <button 
                                        onClick={() => onAddLead?.(stage.id)}
                                        className="w-full bg-slate-50 border-t border-slate-200 shadow-[0_-8px_16px_-8px_rgba(0,0,0,0.15)] py-3 rounded-b-xl text-[13px] font-semibold text-blue-600 hover:bg-white hover:text-blue-700 transition-colors flex items-center justify-center gap-1.5"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Add Lead
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Drag Overlay — renders the floating card during drag */}
                <DragOverlay dropAnimation={null}>
                    {activeLead ? (
                        <KanbanCard lead={activeLead} isDragging config={config} />
                    ) : null}
                </DragOverlay>
                </div>
            </DndContext>

            {/* Delete Stage Confirmation */}
            <AlertDialog open={!!deleteStageTarget} onOpenChange={(open) => !open && setDeleteStageTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Stage "{deleteStageTarget?.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {(() => {
                                const count = deleteStageTarget
                                    ? leads.filter(l => l.pipeline_stage_id === deleteStageTarget.id).length
                                    : 0
                                const fallback = stages.find(s => s.id !== deleteStageTarget?.id)
                                if (count > 0) {
                                    return `This stage has ${count} lead(s). They will be moved to "${fallback?.name || 'the first available stage'}" before deletion.`
                                }
                                return "This stage has no leads. It will be permanently removed."
                            })()}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700 text-white"
                            onClick={() => deleteStageTarget && handleDeleteStage(deleteStageTarget.id)}
                        >
                            Delete Stage
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <StageBackwardConfirmModal
                open={!!backwardPrompt}
                fromStageName={backwardPrompt?.fromStage.name ?? ""}
                toStageName={backwardPrompt?.toStage.name ?? ""}
                leadLabel={
                    backwardPrompt?.lead.project_name ??
                    backwardPrompt?.lead.client_company?.name ??
                    undefined
                }
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
                    const destinationStage = stages.find(s => s.id === newStageId)
                    // Update local leads list with the new stage + updated form fields
                    setLeads(prev => prev.map(l => 
                        l.id === leadId 
                            ? { ...l, pipeline_stage_id: newStageId, status: destinationStage?.name ?? l.status, ...updates } 
                            : l
                    ))
                    setTransitionPrompt(null)
                    
                    if (onLeadStageChange && destinationStage) {
                        onLeadStageChange(
                            leadId,
                            destinationStage.id,
                            destinationStage.name,
                            destinationStage.color,
                            updates
                        )
                    }
                }}
            />
        </div>
    )
}


// ============================================================
// DROPPABLE COLUMN — accepts drops via useDroppable
// ============================================================

function DroppableColumn({ stageId, isEmpty, children }: { stageId: string; isEmpty: boolean; children: React.ReactNode }) {
    const { setNodeRef, isOver } = useDroppable({ id: stageId })

    return (
        <div
            ref={setNodeRef}
            className={`flex-1 overflow-y-auto px-2.5 pt-2 flex flex-col gap-2.5 pb-3 thin-scrollbar rounded-b-xl transition-colors ${
                isOver ? "bg-blue-50/50" : ""
            }`}
        >
            {isEmpty && !isOver && (
                <div className="flex items-center justify-center h-20 text-[12px] text-slate-400">
                    No leads
                </div>
            )}
            {children}
        </div>
    )
}

// ============================================================
// SORTABLE CARD — draggable with transform binding
// ============================================================

function SortableCardBase({
    lead,
    onClick,
    onQuickEdit,
    onDeleteLead,
    isSelected,
    onToggleSelect,
    config,
    dndEnabled = true,
    stages,
    onQuickMoveStage,
}: {
    lead: Lead
    onClick: () => void
    onQuickEdit?: () => void
    onDeleteLead?: () => void
    isSelected?: boolean
    onToggleSelect?: (leadId: string, checked: boolean) => void
    config: KanbanCardConfig
    dndEnabled?: boolean
    stages: PipelineStage[]
    onQuickMoveStage?: (target: PipelineStage) => void
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: lead.id.toString() })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    }

    // Track if this was a drag vs. a click
    const pointerStartRef = useRef<{ x: number; y: number } | null>(null)

    const handlePointerDown = (e: React.PointerEvent) => {
        pointerStartRef.current = { x: e.clientX, y: e.clientY }
    }

    const handlePointerUp = (e: React.PointerEvent) => {
        if (!pointerStartRef.current) return
        const dx = Math.abs(e.clientX - pointerStartRef.current.x)
        const dy = Math.abs(e.clientY - pointerStartRef.current.y)
        pointerStartRef.current = null
        // Only navigate if the pointer barely moved (it was a click, not a drag)
        if (dx < 5 && dy < 5) {
            onClick()
        }
    }

    return (
        <div
            ref={setNodeRef}
            style={{ ...style, cursor: dndEnabled ? undefined : 'default' }}
            {...(dndEnabled ? attributes : {})}
            {...(dndEnabled ? listeners : {})}
            onPointerDown={(e) => {
                if (dndEnabled) {
                    listeners?.onPointerDown?.(e as unknown as React.PointerEvent<Element>)
                }
                handlePointerDown(e)
            }}
            onPointerUp={handlePointerUp}
        >
            <KanbanCard
                lead={lead}
                onQuickEdit={onQuickEdit}
                onDeleteLead={onDeleteLead}
                isSelected={isSelected}
                onToggleSelect={onToggleSelect}
                config={config}
                stages={stages}
                onQuickMoveStage={onQuickMoveStage}
            />
        </div>
    )
}

// Memoize the card. The parent passes fresh inline callbacks on every render
// (e.g. `() => onSelectLead(lead)`), so the default shallow compare would never
// skip. We compare ONLY the data that affects rendering — the lead object
// reference (stable across drag reorders since arrayMove preserves refs),
// selection state, config, stages, and the dnd flag — and deliberately ignore
// the function props (they're recreated each render but close over stable
// parent handlers + the same stable `lead`). This is what keeps dragging
// smooth on large boards: only the card whose data changed re-renders, not all
// 100+ cards on every pointer move.
const SortableCard = memo(SortableCardBase, (prev, next) =>
    prev.lead === next.lead &&
    prev.isSelected === next.isSelected &&
    prev.config === next.config &&
    prev.dndEnabled === next.dndEnabled &&
    prev.stages === next.stages,
)


// ============================================================
// LEAD GRADE / CATEGORY BADGE COLORS
// ============================================================

const GRADE_COLORS: Record<string, string> = {
    "A+": "bg-emerald-50 text-emerald-700 border border-emerald-200/60",
    "A":  "bg-emerald-50 text-emerald-600 border border-emerald-200/60",
    "B":  "bg-amber-50 text-amber-700 border border-amber-200/60",
    "C":  "bg-orange-50 text-orange-700 border border-orange-200/60",
    "D":  "bg-red-50 text-red-700 border border-red-200/60",
    "Hot":  "bg-rose-50 text-rose-700 border border-rose-200/60",
    "Warm": "bg-amber-50 text-amber-700 border border-amber-200/60",
    "Cold": "bg-blue-50 text-blue-700 border border-blue-200/60",
    "Won":  "bg-emerald-50 text-emerald-700 border border-emerald-200/60",
}
const DEFAULT_GRADE_COLOR = "bg-slate-50 text-slate-600 border border-slate-200/60"

function getGradeColor(grade: string): string {
    return GRADE_COLORS[grade] || DEFAULT_GRADE_COLOR
}

function getInitials(name: string): string {
    return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
}

// ============================================================
// KANBAN CARD — Banani-Style Enterprise Layout
// ============================================================

function KanbanCardBase({
    lead,
    onClick,
    onQuickEdit,
    onDeleteLead,
    isDragging,
    isSelected,
    onToggleSelect,
    config,
    stages = [],
    onQuickMoveStage,
}: {
    lead: Lead
    onClick?: () => void
    onQuickEdit?: () => void
    onDeleteLead?: () => void
    isDragging?: boolean
    isSelected?: boolean
    onToggleSelect?: (leadId: string, checked: boolean) => void
    config: KanbanCardConfig
    stages?: PipelineStage[]
    onQuickMoveStage?: (target: PipelineStage) => void
}) {
    const { fmtAxis } = useCurrency()
    const { can } = usePermissions()
    const canEditLead = can("leads", "update")
    const canDeleteLead = can("leads", "delete")
    const picName = lead.pic_sales_profile?.full_name
    const amName = lead.account_manager_profile?.full_name
    const picAvatar = lead.pic_sales_profile?.avatar_url
    const amAvatar = lead.account_manager_profile?.avatar_url

    // Check configuration arrays
    const showGrade = config.badges.includes('grade_lead')
    const showCategory = config.badges.includes('category')
    const showSource = config.badges.includes('lead_source')
    const showMainStream = config.badges.includes('main_stream')
    const showEventFormat = config.badges.includes('event_format')
    const showSubsidiary = config.badges.includes('subsidiary')

    const showEstimatedValue = config.metrics.includes('estimated_value')
    const showCloseDate = config.metrics.includes('target_close_date')
    const showPic = config.metrics.includes('pic')
    const showAm = config.metrics.includes('account_manager')
    const showManualId = config.metrics.includes('manual_id')

    const hasAnyBadge = (showSubsidiary && lead.company?.name) || (showGrade && lead.grade_lead) || (showCategory && lead.category)
    const hasFooter = showEstimatedValue || showCloseDate || showPic || showAm || showManualId

    // Resolve which date to surface based on stage state.
    // Open stages → target_close_date with urgency.
    // Closed-won → closed_won_date (fallback updated_at).
    // Closed-lost / cancelled / postponed / turndown → closed_lost_date (fallback updated_at).
    type DateState = "closing" | "won" | "lost" | "updated" | "none"
    let dateState: DateState = "none"
    let dateValue: string | null = null
    let dateLabel = ""
    let dateUrgency: "overdue" | "soon" | "normal" = "normal"

    if (showCloseDate) {
        const stageName = (lead.pipeline_stage?.name || lead.status || "").toLowerCase()
        const closedStatus = lead.pipeline_stage?.closed_status
        const stageType = lead.pipeline_stage?.stage_type
        const isWon = closedStatus === "won" || stageName.includes("won")
        const isLost = closedStatus === "lost" ||
            ["lost", "cancel", "cancelled", "canceled", "postpone", "postponed", "turndown"].some(t => stageName.includes(t))
        const isClosed = stageType === "closed" || isWon || isLost

        if (isClosed) {
            if (isWon) {
                dateValue = lead.closed_won_date ?? lead.updated_at ?? null
                dateState = lead.closed_won_date ? "won" : (dateValue ? "updated" : "none")
                dateLabel = dateState === "won" ? "Won Date" : "Updated"
            } else {
                dateValue = lead.closed_lost_date ?? lead.updated_at ?? null
                dateState = lead.closed_lost_date ? "lost" : (dateValue ? "updated" : "none")
                dateLabel = dateState === "lost" ? "Closed Date" : "Updated"
            }
        } else if (lead.target_close_date) {
            dateValue = lead.target_close_date
            dateState = "closing"
            dateLabel = "Closing Date"
            const today = new Date(); today.setHours(0, 0, 0, 0)
            const target = new Date(lead.target_close_date); target.setHours(0, 0, 0, 0)
            const diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
            if (diffDays < 0) dateUrgency = "overdue"
            else if (diffDays <= 3) dateUrgency = "soon"
        }
    }

    const hasFooterDate = dateState !== "none" && !!dateValue

    return (
        <div
            onClick={onClick}
            role="button"
            tabIndex={0}
            className={`group/card w-full text-left bg-white rounded-xl cursor-grab transition-all duration-200 ease-out relative ${
                isDragging
                    ? "shadow-xl ring-2 ring-[#02378D]/20 rotate-[1deg] scale-[1.02] z-50 border border-[#02378D]/30"
                    : isSelected
                        ? "border border-[#02378D] ring-1 ring-[#02378D]/30 shadow-sm"
                        : "border border-slate-200/70 shadow-[0_1px_2px_rgba(15,23,42,.04)] hover:border-slate-300 hover:shadow-[0_4px_16px_-4px_rgba(15,23,42,.08)]"
            }`}
        >
            {/* ── Main content area ── */}
            <div className="px-3.5 pt-3 pb-2.5">
                {/* Header row: Project name + context menu */}
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-[13px] text-slate-900 leading-[1.35] truncate tracking-[-0.01em]">
                            {lead.project_name || "Untitled"}
                        </h4>
                        <span className="block text-[11px] text-slate-500 truncate mt-0.5">
                            {lead.client_company?.name}
                        </span>
                    </div>
                    {/* Actions — appear on hover */}
                    <div className="flex items-center gap-0.5 shrink-0 -mt-0.5 -mr-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity">
                        {onToggleSelect && (
                            <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                                <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={(checked) => onToggleSelect(lead.id.toString(), checked as boolean)}
                                    className="h-3.5 w-3.5 border-slate-300 data-[state=checked]:bg-[#02378D] data-[state=checked]:border-[#02378D]"
                                />
                            </div>
                        )}
                        {onQuickMoveStage && stages.length > 1 && (
                            <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button
                                            type="button"
                                            title="Move to stage"
                                            className="inline-flex items-center gap-0.5 h-5 px-1.5 rounded text-[10px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                                        >
                                            <ChevronsRight className="h-3 w-3" />
                                            Move
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-56">
                                        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                            Move to stage
                                        </div>
                                        {stages.map((stage) => {
                                            const isCurrent = stage.id === lead.pipeline_stage_id
                                            const isWonStage = stage.closed_status === "won" ||
                                                stage.name.toLowerCase().includes("won")
                                            const isLostStage = stage.closed_status === "lost" ||
                                                ["lost", "cancel", "cancelled", "canceled", "postpone", "postponed", "turndown"].some(t => stage.name.toLowerCase().includes(t))
                                            const Icon = isWonStage ? ThumbsUp : isLostStage ? ThumbsDown : null
                                            const iconClass = isWonStage
                                                ? "text-emerald-500"
                                                : isLostStage
                                                    ? "text-rose-500"
                                                    : "text-slate-400"
                                            return (
                                                <DropdownMenuItem
                                                    key={stage.id}
                                                    onClick={() => !isCurrent && onQuickMoveStage(stage)}
                                                    disabled={isCurrent}
                                                    className={`text-xs ${isCurrent ? "opacity-50" : ""}`}
                                                >
                                                    {Icon ? (
                                                        <Icon className={`h-3.5 w-3.5 mr-2 ${iconClass}`} />
                                                    ) : (
                                                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-300 mr-2" />
                                                    )}
                                                    <span className="flex-1 truncate">{stage.name}</span>
                                                    {isCurrent && <Check className="h-3.5 w-3.5 text-slate-400" />}
                                                </DropdownMenuItem>
                                            )
                                        })}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        )}
                        <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button type="button" className="h-5 w-5 inline-flex items-center justify-center rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                                        <MoreHorizontal className="h-3 w-3" />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-36">
                                    {canEditLead ? (
                                        <DropdownMenuItem onClick={onQuickEdit} className="text-xs">
                                            <Edit2 className="w-3 h-3 mr-2" /> Edit
                                        </DropdownMenuItem>
                                    ) : (
                                        <Tooltip content="You don't have permission to edit" position="left">
                                            <div className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-xs cursor-not-allowed opacity-45 select-none" onClick={(e) => e.stopPropagation()}>
                                                <Edit2 className="w-3 h-3 mr-1" /> Edit
                                            </div>
                                        </Tooltip>
                                    )}
                                    {canDeleteLead ? (
                                        <DropdownMenuItem onClick={onDeleteLead} className="text-red-600 focus:text-red-700 focus:bg-red-50 text-xs">
                                            <Trash2 className="w-3 h-3 mr-2" /> Delete
                                        </DropdownMenuItem>
                                    ) : (
                                        <Tooltip content="You don't have permission to delete" position="left">
                                            <div className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-xs cursor-not-allowed opacity-45 select-none text-red-600" onClick={(e) => e.stopPropagation()}>
                                                <Trash2 className="w-3 h-3 mr-1" /> Delete
                                            </div>
                                        </Tooltip>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </div>

                {/* Badges — single row, all pills share equal width */}
                {hasAnyBadge && (
                    <div className="flex items-stretch gap-1.5 mt-2 overflow-hidden whitespace-nowrap">
                        {showSubsidiary && lead.company?.name && (
                            <span className="inline-flex flex-1 min-w-0 basis-0 items-center justify-center px-2 py-[2px] rounded-md text-[10px] font-medium bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100">
                                <span className="truncate">{lead.company.name}</span>
                            </span>
                        )}
                        {showGrade && lead.grade_lead && (
                            <span className={`inline-flex flex-1 min-w-0 basis-0 items-center justify-center gap-1 px-2 py-[2px] rounded-md text-[10px] font-medium ${getGradeColor(lead.grade_lead)}`}>
                                <span className="inline-block w-1 h-1 rounded-full bg-current opacity-80 shrink-0" />
                                <span className="truncate">{lead.grade_lead}</span>
                            </span>
                        )}
                        {showCategory && lead.category && (
                            <span className={`inline-flex flex-1 min-w-0 basis-0 items-center justify-center gap-1 px-2 py-[2px] rounded-md text-[10px] font-medium ${
                                lead.category.toLowerCase().includes('hot') ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-100' :
                                lead.category.toLowerCase().includes('warm') ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-100' :
                                lead.category.toLowerCase().includes('cold') ? 'bg-sky-50 text-sky-700 ring-1 ring-sky-100' :
                                'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
                            }`}>
                                <span className="inline-block w-1 h-1 rounded-full bg-current opacity-80 shrink-0" />
                                <span className="truncate">{lead.category}</span>
                            </span>
                        )}
                        {showSource && lead.lead_source && (
                            <span className="inline-flex flex-1 min-w-0 basis-0 items-center justify-center px-2 py-[2px] rounded-md text-[10px] font-medium bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100">
                                <span className="truncate">{lead.lead_source}</span>
                            </span>
                        )}
                        {showMainStream && lead.main_stream && (
                            <span className="inline-flex flex-1 min-w-0 basis-0 items-center justify-center px-2 py-[2px] rounded-md text-[10px] font-medium bg-violet-50 text-violet-700 ring-1 ring-violet-100">
                                <span className="truncate">{lead.main_stream}</span>
                            </span>
                        )}
                        {showEventFormat && lead.event_format && (
                            <span className="inline-flex flex-1 min-w-0 basis-0 items-center justify-center px-2 py-[2px] rounded-md text-[10px] font-medium bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                                <span className="truncate">{lead.event_format}</span>
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* ── Footer — value + meta ── */}
            {hasFooter && (
                <div className="px-3.5 pt-2 pb-2.5 border-t border-slate-100 space-y-1">
                    {/* Row 1: Value + manual id */}
                    {(showEstimatedValue && lead.estimated_value) || (showManualId && lead.manual_id) ? (
                        <div className="flex items-center justify-between gap-2">
                            {showEstimatedValue && lead.estimated_value ? (
                                <span className="font-semibold text-[12px] text-slate-800 tabular-nums tracking-tight truncate">
                                    {fmtAxis(lead.estimated_value)}
                                </span>
                            ) : <span />}
                            {showManualId && lead.manual_id && (
                                <span className="font-mono text-[10px] text-slate-400 shrink-0">
                                    {lead.manual_id}
                                </span>
                            )}
                        </div>
                    ) : null}
                    {/* Row 2: Date + Avatars — single line, truncated */}
                    {hasFooterDate || (showAm && amName) || (showPic && picName) ? (
                        <div className="flex items-center justify-between gap-2">
                            {hasFooterDate && dateValue ? (() => {
                                const fullDate = new Date(dateValue).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                                const tooltip = `${dateLabel}: ${fullDate}`
                                const tone = dateState === "won"
                                    ? "text-emerald-600"
                                    : dateState === "lost"
                                        ? "text-rose-600"
                                        : dateState === "updated"
                                            ? "text-slate-500"
                                            : dateUrgency === "overdue"
                                                ? "text-red-600"
                                                : dateUrgency === "soon"
                                                    ? "text-amber-600"
                                                    : "text-slate-500"
                                const iconTone = dateState === "won"
                                    ? "text-emerald-500"
                                    : dateState === "lost"
                                        ? "text-rose-500"
                                        : dateState === "updated"
                                            ? "text-slate-400"
                                            : dateUrgency === "overdue"
                                                ? "text-red-500"
                                                : dateUrgency === "soon"
                                                    ? "text-amber-500"
                                                    : "text-slate-400"
                                const Icon = dateState === "won"
                                    ? CheckCircle2
                                    : dateState === "lost"
                                        ? XCircle
                                        : dateState === "updated"
                                            ? Clock
                                            : CalendarDays
                                const valueIsBold = (dateState === "closing" && (dateUrgency === "overdue" || dateUrgency === "soon")) || dateState === "won" || dateState === "lost"
                                return (
                                    <span title={tooltip} className={`inline-flex items-center gap-1.5 text-[10.5px] tabular-nums truncate min-w-0 ${tone}`}>
                                        <Icon className={`h-3 w-3 shrink-0 ${iconTone}`} />
                                        <span className="truncate">
                                            <span className="text-slate-400 font-normal mr-1">{dateLabel}</span>
                                            <span className={valueIsBold ? "font-medium" : ""}>
                                                {new Date(dateValue).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })}
                                            </span>
                                        </span>
                                    </span>
                                )
                            })() : <span />}
                            <div className="flex items-center -space-x-1.5 shrink-0">
                                {showAm && amName && (
                                    <div title={amName} className="w-[22px] h-[22px] rounded-full bg-[#6EBDA1] flex items-center justify-center text-[9px] font-semibold text-white ring-2 ring-white overflow-hidden">
                                        {amAvatar ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={amAvatar} alt={amName} className="w-full h-full object-cover" />
                                        ) : getInitials(amName)}
                                    </div>
                                )}
                                {showPic && picName && (
                                    <div title={picName} className="w-[22px] h-[22px] rounded-full bg-[#02378D] flex items-center justify-center text-[9px] font-semibold text-white ring-2 ring-white overflow-hidden">
                                        {picAvatar ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={picAvatar} alt={picName} className="w-full h-full object-cover" />
                                        ) : getInitials(picName)}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    )
}

// Memoize the card body. This is the heaviest leaf in the board (badges,
// avatars, currency formatting, menus), so skipping its re-render is the
// biggest win during drag. Compare only render-affecting data and ignore the
// inline callbacks the parent recreates each render — they close over stable
// handlers, so it's safe to skip them in the equality check.
const KanbanCard = memo(KanbanCardBase, (prev, next) =>
    prev.lead === next.lead &&
    prev.isDragging === next.isDragging &&
    prev.isSelected === next.isSelected &&
    prev.config === next.config &&
    prev.stages === next.stages,
)


