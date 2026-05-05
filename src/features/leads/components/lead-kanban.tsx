"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
import { toast } from "sonner"
import { updatePipelineStageAction } from "@/app/actions/lead-actions"
import { Building2, CalendarDays, Copy, Edit2, Globe, Loader2, MoreHorizontal, Pencil, Trash2, User } from "lucide-react"
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
}: LeadKanbanProps) {
    const { fmt: formatCompact } = useCurrency()
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
    const handleRenameStage = async (stageId: string, newName: string) => {
        if (!newName.trim()) return
        const { error } = await supabase
            .from("pipeline_stages")
            .update({ name: newName.trim() })
            .eq("id", stageId)
        if (error) {
            toast.error(`Rename failed: ${error.message}`)
        } else {
            setStages(prev => prev.map(s => s.id === stageId ? { ...s, name: newName.trim() } : s))
            toast.success("Stage renamed")
        }
        setRenameStageId(null)
    }

    const handleCloneStage = async (stage: PipelineStage) => {
        const maxSort = Math.max(...stages.map(s => s.sort_order), 0)
        const { data, error } = await supabase
            .from("pipeline_stages")
            .insert({
                name: `${stage.name} (Copy)`,
                color: stage.color,
                sort_order: maxSort + 1,
                is_default: false,
                stage_type: stage.stage_type,
                pipeline_id: stage.pipeline_id ?? pipelineId,
            })
            .select()
            .single()
        if (error) {
            toast.error(`Clone failed: ${error.message}`)
        } else if (data) {
            setStages(prev => [...prev, data as PipelineStage])
            toast.success(`Stage "${data.name}" created`)
        }
    }

    const handleDeleteStage = async (stageId: string) => {
        // Move any leads in this stage to the first available stage
        const fallbackStage = stages.find(s => s.id !== stageId)
        if (fallbackStage) {
            const leadsInStage = leads.filter(l => l.pipeline_stage_id === stageId)
            if (leadsInStage.length > 0) {
                const { error: moveErr } = await supabase
                    .from("leads")
                    .update({ pipeline_stage_id: fallbackStage.id })
                    .eq("pipeline_stage_id", stageId)
                if (moveErr) {
                    toast.error(`Failed to move leads: ${moveErr.message}`)
                    return
                }
                // Update local state
                setLeads(prev => prev.map(l =>
                    l.pipeline_stage_id === stageId
                        ? { ...l, pipeline_stage_id: fallbackStage.id }
                        : l
                ))
            }
        }
        const { error } = await supabase
            .from("pipeline_stages")
            .delete()
            .eq("id", stageId)
        if (error) {
            toast.error(`Delete failed: ${error.message}`)
        } else {
            setStages(prev => prev.filter(s => s.id !== stageId))
            toast.success("Stage deleted")
        }
        setDeleteStageTarget(null)
    }

    const activeLead = activeId ? leads.find((l) => l.id.toString() === activeId) : null

    const handleDragStart = useCallback((event: DragStartEvent) => {
        setActiveId(String(event.active.id))
    }, [])

    const handleDragOver = useCallback((event: DragOverEvent) => {
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

            const newLead = { ...prev[activeIndex], pipeline_stage_id: overStageId, status: newStage?.name ?? prev[activeIndex].status }
            const prevWithoutActive = prev.filter(l => l.id !== activeLeadId)
            
            return [
                ...prevWithoutActive.slice(0, newIndex),
                newLead,
                ...prevWithoutActive.slice(newIndex)
            ]
        })
    }, [stages])

    const handleDragEnd = useCallback(async (event: DragEndEvent) => {
        const { active, over } = event
        setActiveId(null)
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
            const matchedRule = transitionRules.find(r => 
                (r.from_stage_id === originalStageId || r.from_stage_id === null) && 
                r.to_stage_id === destinationStageId
            )

            if (matchedRule && (matchedRule.required_fields.length > 0 || matchedRule.note_required || matchedRule.attachment_required)) {
                setLeads(initialLeads)
                setTransitionPrompt({
                    lead: originalLead,
                    oldStageId: originalStageId,
                    newStageId: destinationStageId,
                    rule: matchedRule,
                    newSortOrder
                })
                return
            }
        } else {
            const originalIndex = initialLeads.findIndex(l => l.id === activeLeadId)
            const currentIndex = leads.findIndex(l => l.id === activeLeadId)
            if (originalIndex === currentIndex) return // did not genuinely sort
        }

        const destinationStage = stages.find((s) => s.id === destinationStageId)
        const result = await updatePipelineStageAction(activeLeadId, destinationStageId, newSortOrder)
        
        if (!result.success) {
            toast.error(`Failed to move lead: ${result.error}`)
            setLeads(initialLeads)
        } else {
            const stageName = destinationStage?.name || "stage"
            if (originalStageId !== destinationStageId) {
                toast.success(`Moved to ${stageName}`)
            }

            if (onLeadStageChange && destinationStage) {
                onLeadStageChange(
                    activeLeadId,
                    destinationStage.id,
                    destinationStage.name,
                    destinationStage.color,
                    { kanban_sort_order: newSortOrder }
                )
            }
        }
    }, [leads, stages, initialLeads, onLeadStageChange, transitionRules])

    const handleDragCancel = useCallback(() => {
        setActiveId(null)
        setLeads(initialLeads)
    }, [initialLeads])

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
            >
                <div className="flex-1 overflow-x-auto overflow-y-hidden min-h-0 w-full kanban-horizontal-scroll pb-6">
                    <div className="flex h-full w-max items-start gap-4 px-1 relative">
                    {grouped.map((stage) => {
                        const accentBg = BG_COLOR_MAP[stage.color] || BG_COLOR_MAP.gray
                        const totalRevenue = stage.leads.reduce((sum, l) => sum + (l.estimated_value || 0), 0)
                        const leadIds = stage.leads.map((l) => l.id.toString())

                        return (
                            <div
                                key={stage.id}
                                className={`group/stage bg-slate-50/50 border border-slate-200/80 rounded-lg flex flex-col w-[272px] min-w-[272px] shrink-0 h-full max-h-full overflow-hidden relative`}
                            >
                                {/* Column Header */}
                                <div className="px-3 py-2.5 shrink-0 bg-white border-b border-slate-100 rounded-t-lg relative z-10">
                                    <div className="flex items-start justify-between gap-2 mb-1.5">
                                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                            <div className={`w-1.5 h-1.5 rounded-full ${accentBg} shrink-0`} />
                                            {renameStageId === stage.id ? (
                                                <input
                                                    autoFocus
                                                    defaultValue={renameValue}
                                                    className="font-semibold text-[12px] leading-snug text-slate-800 bg-transparent border-b border-blue-400 outline-none w-full py-0.5"
                                                    onBlur={(e) => handleRenameStage(stage.id, e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleRenameStage(stage.id, (e.target as HTMLInputElement).value)
                                                        if (e.key === 'Escape') setRenameStageId(null)
                                                    }}
                                                />
                                            ) : (
                                                <h3 className="font-semibold text-[12px] leading-snug text-[#292D30] line-clamp-1">
                                                    {stage.name}
                                                </h3>
                                            )}
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button type="button" className="p-1 -mr-1 -mt-1 rounded-md border border-transparent hover:bg-slate-50 hover:border-slate-200 text-slate-400 hover:text-slate-700 transition-all shrink-0">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-44">
                                                <DropdownMenuItem onClick={() => {
                                                    setRenameValue(stage.name)
                                                    setRenameStageId(stage.id)
                                                }}>
                                                    <Pencil className="mr-2 h-3.5 w-3.5" /> Rename
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleCloneStage(stage)}>
                                                    <Copy className="mr-2 h-3.5 w-3.5" /> Clone Stage
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                                    disabled={stages.length <= 1}
                                                    onClick={() => setDeleteStageTarget(stage)}
                                                >
                                                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete Stage
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                    <div className="flex items-center justify-between mt-0.5">
                                        <span className="text-[10.5px] font-medium text-slate-400">
                                            {stage.leads.length} leads
                                        </span>
                                        {totalRevenue > 0 && (
                                            <span className="text-[10.5px] font-semibold text-slate-500 tabular-nums">
                                                {formatCompact(totalRevenue)}
                                            </span>
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
            className={`flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-[6px] pb-4 thin-scrollbar rounded-b-lg transition-colors ${
                isOver ? "bg-blue-50/40" : ""
            }`}
        >
            {isEmpty && !isOver && (
                <div className="flex items-center justify-center h-24 text-xs text-slate-400">
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

function SortableCard({
    lead,
    onClick,
    onQuickEdit,
    onDeleteLead,
    isSelected,
    onToggleSelect,
    config,
}: {
    lead: Lead
    onClick: () => void
    onQuickEdit?: () => void
    onDeleteLead?: () => void
    isSelected?: boolean
    onToggleSelect?: (leadId: string, checked: boolean) => void
    config: KanbanCardConfig
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
            style={style}
            {...attributes}
            {...listeners}
            onPointerDown={(e) => {
                // Call dnd-kit listener first
                listeners?.onPointerDown?.(e as unknown as React.PointerEvent<Element>)
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
            />
        </div>
    )
}


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

function KanbanCard({
    lead,
    onClick,
    onQuickEdit,
    onDeleteLead,
    isDragging,
    isSelected,
    onToggleSelect,
    config,
}: {
    lead: Lead
    onClick?: () => void
    onQuickEdit?: () => void
    onDeleteLead?: () => void
    isDragging?: boolean
    isSelected?: boolean
    onToggleSelect?: (leadId: string, checked: boolean) => void
    config: KanbanCardConfig
}) {
    const { fmtAxis } = useCurrency()
    const picName = lead.pic_sales_profile?.full_name
    const amName = lead.account_manager_profile?.full_name

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

    // Target Close Date urgency
    let dateUrgency: "overdue" | "soon" | "normal" = "normal"
    if (showCloseDate && lead.target_close_date) {
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const target = new Date(lead.target_close_date); target.setHours(0, 0, 0, 0)
        const diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        if (diffDays < 0) dateUrgency = "overdue"
        else if (diffDays <= 3) dateUrgency = "soon"
    }

    return (
        <div
            onClick={onClick}
            role="button"
            tabIndex={0}
            className={`group/card w-full text-left bg-white rounded-lg cursor-grab transition-all duration-150 ease-out relative ${
                isDragging
                    ? "shadow-lg ring-2 ring-[#02378D]/20 rotate-[1.5deg] scale-[1.02] z-50 border border-[#02378D]/30"
                    : isSelected
                        ? "border border-[#02378D] ring-1 ring-[#02378D]/30 shadow-sm"
                        : "border border-slate-200/70 hover:border-slate-300 hover:shadow-[0_2px_8px_rgba(0,0,0,.06)]"
            }`}
        >
            {/* ── Main content area ── */}
            <div className="px-2.5 pt-2 pb-2">
                {/* Header row: Project name + context menu */}
                <div className="flex items-start justify-between gap-1.5">
                    <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-[12.5px] text-[#292D30] leading-tight line-clamp-1">
                            {lead.project_name || "Untitled"}
                        </h4>
                        <span className="text-[10.5px] text-slate-500 line-clamp-1 mt-px">
                            {lead.client_company?.name}
                        </span>
                    </div>
                    {/* Actions — appear on hover */}
                    <div className="flex items-center shrink-0 -mt-0.5 -mr-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity">
                        {onToggleSelect && (
                            <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                                <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={(checked) => onToggleSelect(lead.id.toString(), checked as boolean)}
                                    className="h-3.5 w-3.5 border-slate-300 data-[state=checked]:bg-[#02378D] data-[state=checked]:border-[#02378D]"
                                />
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
                                    {onQuickEdit && (
                                        <DropdownMenuItem onClick={onQuickEdit} className="text-xs">
                                            <Edit2 className="w-3 h-3 mr-2" /> Edit
                                        </DropdownMenuItem>
                                    )}
                                    {onDeleteLead && (
                                        <DropdownMenuItem onClick={onDeleteLead} className="text-red-600 focus:text-red-700 focus:bg-red-50 text-xs">
                                            <Trash2 className="w-3 h-3 mr-2" /> Delete
                                        </DropdownMenuItem>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </div>

                {/* Badges — compact, no uppercase, muted colors */}
                {hasAnyBadge && (
                    <div className="flex flex-wrap items-center gap-1 mt-1.5">
                        {showSubsidiary && lead.company?.name && (
                            <span className="px-1.5 py-px rounded text-[9.5px] font-medium bg-slate-100 text-slate-500">
                                {lead.company.name}
                            </span>
                        )}
                        {showGrade && lead.grade_lead && (
                            <span className={`px-1.5 py-px rounded text-[9.5px] font-medium ${getGradeColor(lead.grade_lead)}`}>
                                {lead.grade_lead}
                            </span>
                        )}
                        {showCategory && lead.category && (
                            <span className={`px-1.5 py-px rounded text-[9.5px] font-medium ${
                                lead.category.toLowerCase().includes('hot') ? 'bg-rose-50 text-rose-600' :
                                lead.category.toLowerCase().includes('warm') ? 'bg-amber-50 text-amber-600' :
                                'bg-slate-50 text-slate-600'
                            }`}>
                                {lead.category}
                            </span>
                        )}
                        {showSource && lead.lead_source && (
                            <span className="px-1.5 py-px rounded text-[9.5px] font-medium bg-slate-50 text-slate-500">
                                {lead.lead_source}
                            </span>
                        )}
                        {showMainStream && lead.main_stream && (
                            <span className="px-1.5 py-px rounded text-[9.5px] font-medium bg-slate-50 text-slate-500">
                                {lead.main_stream}
                            </span>
                        )}
                        {showEventFormat && lead.event_format && (
                            <span className="px-1.5 py-px rounded text-[9.5px] font-medium bg-slate-50 text-slate-500">
                                {lead.event_format}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* ── Footer — value, date, avatar — separated by subtle border ── */}
            {hasFooter && (
                <div className="flex items-center justify-between px-2.5 py-1.5 border-t border-slate-100 bg-slate-50/30">
                    <div className="flex items-center gap-2 min-w-0">
                        {showEstimatedValue && lead.estimated_value ? (
                            <span className="font-bold text-[12px] text-[#292D30] tabular-nums tracking-tight">
                                {fmtAxis(lead.estimated_value)}
                            </span>
                        ) : null}
                        {showCloseDate && lead.target_close_date && (
                            <span className={`text-[10px] tabular-nums ${
                                dateUrgency === "overdue" ? "text-red-600 font-semibold" :
                                dateUrgency === "soon" ? "text-amber-600 font-semibold" :
                                "text-slate-400"
                            }`}>
                                {new Date(lead.target_close_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                            </span>
                        )}
                        {showManualId && lead.manual_id && (
                            <span className="font-mono text-[9px] text-slate-300">
                                {lead.manual_id}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                        {showAm && amName && (
                            <div title={amName} className="w-[18px] h-[18px] rounded-full bg-[#6EBDA1] flex items-center justify-center text-[7px] font-bold text-white ring-1 ring-white">
                                {getInitials(amName)}
                            </div>
                        )}
                        {showPic && picName && (
                            <div title={picName} className="w-[18px] h-[18px] rounded-full bg-[#02378D] flex items-center justify-center text-[7px] font-bold text-white ring-1 ring-white">
                                {getInitials(picName)}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}


