"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
    DragDropContext,
    Droppable,
    Draggable,
    type DropResult,
} from "@hello-pangea/dnd"
import { Lead, PipelineStage } from "@/types"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import { updatePipelineStageAction } from "@/app/actions/lead-actions"
import {
    Building2, DollarSign, Clock, AlertTriangle,
    User, ChevronRight, Loader2
} from "lucide-react"

// Color mapping from DB color name to Tailwind classes
const COLOR_MAP: Record<string, { border: string; bg: string }> = {
    blue:    { border: "border-t-blue-500",    bg: "bg-blue-500" },
    amber:   { border: "border-t-amber-500",   bg: "bg-amber-500" },
    violet:  { border: "border-t-violet-500",  bg: "bg-violet-500" },
    emerald: { border: "border-t-emerald-500", bg: "bg-emerald-500" },
    red:     { border: "border-t-red-400",     bg: "bg-red-400" },
    pink:    { border: "border-t-pink-500",    bg: "bg-pink-500" },
    cyan:    { border: "border-t-cyan-500",    bg: "bg-cyan-500" },
    orange:  { border: "border-t-orange-500",  bg: "bg-orange-500" },
    gray:    { border: "border-t-gray-400",    bg: "bg-gray-400" },
}

const BU_COLORS: Record<string, string> = {
    WNW: "bg-violet-100 text-violet-700",
    WNS: "bg-sky-100 text-sky-700",
    UK: "bg-rose-100 text-rose-700",
    TEP: "bg-amber-100 text-amber-700",
    CREATIVE: "bg-pink-100 text-pink-700",
}

// Fallback stages if DB fetch fails
const FALLBACK_STAGES: PipelineStage[] = [
    { id: "1", name: "Lead Masuk", color: "blue", sort_order: 1, is_default: true, created_at: "" },
    { id: "2", name: "Estimasi Project", color: "amber", sort_order: 2, is_default: true, created_at: "" },
    { id: "3", name: "Proposal Sent", color: "violet", sort_order: 3, is_default: true, created_at: "" },
    { id: "4", name: "Closed Won", color: "emerald", sort_order: 4, is_default: true, created_at: "" },
    { id: "5", name: "Closed Lost", color: "red", sort_order: 5, is_default: true, created_at: "" },
]

interface LeadKanbanProps {
    leads: Lead[]
    onSelectLead: (lead: Lead) => void
}

export function LeadKanban({ leads: initialLeads, onSelectLead }: LeadKanbanProps) {
    const [stages, setStages] = useState<PipelineStage[]>(FALLBACK_STAGES)
    const [leads, setLeads] = useState<Lead[]>(initialLeads)
    const [loading, setLoading] = useState(true)
    const [isMounted, setIsMounted] = useState(false)
    const supabase = createClient()

    // Strict Mode hydration guard for @hello-pangea/dnd
    useEffect(() => { setIsMounted(true) }, [])

    // Sync when parent data changes
    useEffect(() => { setLeads(initialLeads) }, [initialLeads])

    // Fetch dynamic stages
    useEffect(() => {
        const fetchStages = async () => {
            const { data, error } = await supabase
                .from("pipeline_stages")
                .select("*")
                .order("sort_order", { ascending: true })

            if (!error && data && data.length > 0) {
                setStages(data)
            }
            setLoading(false)
        }
        fetchStages()
    }, [supabase])

    // Group leads by pipeline_stage_id (relational), fallback to status text match
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

    // DND handler
    const onDragEnd = useCallback(
        async (result: DropResult) => {
            const { draggableId, destination, source } = result
            if (!destination) return
            if (destination.droppableId === source.droppableId && destination.index === source.index) return

            const leadId = parseInt(draggableId, 10)
            const newStageId = destination.droppableId
            const newStage = stages.find((s) => s.id === newStageId)

            // Optimistic update
            setLeads((prev) =>
                prev.map((l) => (l.id === leadId ? { ...l, pipeline_stage_id: newStageId, status: newStage?.name ?? l.status } : l))
            )

            // Persist via Server Action
            const result2 = await updatePipelineStageAction(leadId, newStageId)

            if (!result2.success) {
                toast.error(`Failed to move lead: ${result2.error}`)
                // Revert
                const oldStageId = source.droppableId
                const oldStage = stages.find((s) => s.id === oldStageId)
                setLeads((prev) =>
                    prev.map((l) =>
                        l.id === leadId ? { ...l, pipeline_stage_id: oldStageId, status: oldStage?.name ?? l.status } : l
                    )
                )
            } else {
                toast.success(`Moved to ${newStage?.name || "stage"}`)
            }
        },
        [stages]
    )

    if (loading || !isMounted) {
        return (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading pipeline...
            </div>
        )
    }

    return (
        <div className="overflow-x-auto pb-4">
            <DragDropContext onDragEnd={onDragEnd}>
                <div
                    className="grid gap-4 min-w-[1100px]"
                    style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(220px, 1fr))` }}
                >
                    {grouped.map((stage) => {
                        const colors = COLOR_MAP[stage.color] || COLOR_MAP.gray
                        const totalRevenue = stage.leads.reduce(
                            (sum, l) => sum + (l.estimated_revenue || 0), 0
                        )

                        return (
                            <Droppable droppableId={stage.id} key={stage.id}>
                                {(provided, snapshot) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        className={`flex flex-col rounded-xl border border-t-4 ${colors.border} min-h-[500px] transition-colors ${
                                            snapshot.isDraggingOver ? "bg-accent/40" : "bg-muted/30"
                                        }`}
                                    >
                                        {/* Column Header */}
                                        <div className="p-3 border-b bg-background/50 rounded-t-lg">
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-semibold text-sm">{stage.name}</h3>
                                                    <span className={`text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full ${colors.bg}`}>
                                                        {stage.leads.length}
                                                    </span>
                                                </div>
                                            </div>
                                            <p className="text-[11px] text-muted-foreground font-medium">
                                                {formatCompact(totalRevenue)}
                                            </p>
                                        </div>

                                        {/* Cards */}
                                        <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)]">
                                            {stage.leads.length === 0 && !snapshot.isDraggingOver && (
                                                <div className="flex items-center justify-center h-24 text-xs text-muted-foreground/50">
                                                    No leads
                                                </div>
                                            )}
                                            {stage.leads.map((lead, index) => (
                                                <Draggable
                                                    key={lead.id}
                                                    draggableId={lead.id.toString()}
                                                    index={index}
                                                >
                                                    {(dragProvided, dragSnapshot) => (
                                                        <div
                                                            ref={dragProvided.innerRef}
                                                            {...dragProvided.draggableProps}
                                                            {...dragProvided.dragHandleProps}
                                                        >
                                                            <KanbanCard
                                                                lead={lead}
                                                                onClick={() => onSelectLead(lead)}
                                                                isDragging={dragSnapshot.isDragging}
                                                            />
                                                        </div>
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                        </div>
                                    </div>
                                )}
                            </Droppable>
                        )
                    })}
                </div>
            </DragDropContext>
        </div>
    )
}

// ============================================================
// KANBAN CARD
// ============================================================

function KanbanCard({ lead, onClick, isDragging }: { lead: Lead; onClick: () => void; isDragging: boolean }) {
    const buColor = BU_COLORS[lead.bu_revenue || ""] || "bg-gray-100 text-gray-600"
    const isOverdue = isSlaOverdue(lead)

    return (
        <button
            onClick={onClick}
            className={`w-full text-left bg-card border rounded-lg p-3 transition-all duration-150 group cursor-pointer ${
                isDragging
                    ? "shadow-lg ring-2 ring-primary/30 rotate-1"
                    : "hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5 active:translate-y-0"
            }`}
        >
            <div className="flex items-start justify-between gap-2 mb-1.5">
                <h4 className="font-semibold text-xs leading-snug text-foreground line-clamp-2 flex-1">
                    {lead.project_name || "Untitled Project"}
                </h4>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0 mt-0.5" />
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-2.5">
                <Building2 className="h-3 w-3 shrink-0" />
                <span className="truncate">{lead.client_company?.name || lead.company_name || "-"}</span>
            </div>

            {(lead.contact?.full_name || lead.contact_full_name) && (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-2.5 -mt-1.5">
                    <User className="h-3 w-3 shrink-0" />
                    <span className="truncate">{lead.contact?.full_name || lead.contact_full_name}</span>
                </div>
            )}

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${buColor}`}>
                        {lead.bu_revenue || "?"}
                    </span>
                    {isOverdue && (
                        <span className="flex items-center gap-0.5 text-[9px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                            <AlertTriangle className="h-2.5 w-2.5" /> SLA
                        </span>
                    )}
                </div>
                <span className="text-[11px] font-semibold text-foreground/70 flex items-center gap-0.5">
                    <DollarSign className="h-3 w-3" />
                    {formatCompact(lead.estimated_revenue)}
                </span>
            </div>

            {lead.pic_sales && (
                <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/40 text-[10px] text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>{lead.pic_sales}</span>
                    {lead.date_lead_received && (
                        <>
                            <span className="text-muted-foreground/30">|</span>
                            <Clock className="h-2.5 w-2.5" />
                            <span>{daysSince(lead.date_lead_received)}d</span>
                        </>
                    )}
                </div>
            )}
        </button>
    )
}

// ============================================================
// HELPERS
// ============================================================

function formatCompact(amount: number | null | undefined): string {
    if (!amount) return "-"
    if (amount >= 1_000_000_000) return `Rp${(amount / 1_000_000_000).toFixed(1)}B`
    if (amount >= 1_000_000) return `Rp${(amount / 1_000_000).toFixed(0)}M`
    return `Rp${amount.toLocaleString("id-ID")}`
}

function daysSince(dateStr: string): number {
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
}

function isSlaOverdue(lead: Lead): boolean {
    if (!lead.date_lead_received) return false
    const status = (lead.status || "").toLowerCase()
    if (status !== "lead masuk") return false
    return daysSince(lead.date_lead_received) > 7
}
