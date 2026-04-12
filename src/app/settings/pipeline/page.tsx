"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import type { PipelineStage, Pipeline } from "@/types/index"
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { flushSync } from 'react-dom'
import { useCompany } from "@/contexts/company-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Plus, MoreVertical, Pencil, Trash2, CheckCircle2, GripVertical, AlertTriangle, Check, X, Loader2, Star } from "lucide-react"
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { toast } from "sonner"

const COLORS = [
    { value: "blue", hex: "#6366f1" },
    { value: "violet", hex: "#8b5cf6" },
    { value: "sky", hex: "#0ea5e9" },
    { value: "emerald", hex: "#10b981" },
    { value: "amber", hex: "#f59e0b" },
    { value: "red", hex: "#ef4444" },
    { value: "pink", hex: "#ec4899" },
    { value: "orange", hex: "#f97316" },
    { value: "teal", hex: "#14b8a6" },
    { value: "slate", hex: "#64748b" },
]

function getColorHex(color: string) {
    return COLORS.find(c => c.value === color)?.hex || "#64748b"
}

export default function PipelineOverviewPage() {
    const supabase = createClient()
    const router = useRouter()
    const { activeCompany, isHoldingView } = useCompany()

    const [pipelines, setPipelines] = useState<Pipeline[]>([])
    const [allStages, setAllStages] = useState<PipelineStage[]>([])
    const [rulesCount, setRulesCount] = useState<Record<string, number>>({})
    const [restrictionsCount, setRestrictionsCount] = useState<Record<string, number>>({})
    const [loading, setLoading] = useState(true)
    const [scrolled, setScrolled] = useState(false)

    // Stage editing states
    const [editingStage, setEditingStage] = useState<{ id: string, name: string } | null>(null)
    const [colorPickerStage, setColorPickerStage] = useState<string | null>(null)
    const [deleteStageId, setDeleteStageId] = useState<string | null>(null)
    const [showDeleteStageDialog, setShowDeleteStageDialog] = useState(false)

    // Add stage dialog states
    const [addStagePipelineId, setAddStagePipelineId] = useState<string | null>(null)
    const [addStageType, setAddStageType] = useState<'open' | 'closed'>('open')
    const [showAddStageDialog, setShowAddStageDialog] = useState(false)
    const [newStageName, setNewStageName] = useState("")
    const [newStageColor, setNewStageColor] = useState("blue")
    const [newStageClosedStatus, setNewStageClosedStatus] = useState<'won' | 'lost'>('lost')

    // Create pipeline dialog states
    const [showCreatePipelineDialog, setShowCreatePipelineDialog] = useState(false)
    const [newPipelineName, setNewPipelineName] = useState("")
    const [newPipelineOpenStages, setNewPipelineOpenStages] = useState<{ name: string; color: string }[]>([
        { name: "Lead Masuk", color: "blue" },
        { name: "Qualified", color: "violet" },
        { name: "Proposal Sent", color: "sky" },
    ])
    const [newPipelineClosedStages, setNewPipelineClosedStages] = useState<{ name: string; closed_status: 'won' | 'lost' }[]>([
        { name: "Closed Won", closed_status: "won" },
        { name: "Closed Lost", closed_status: "lost" },
    ])

    // Pipeline rename dialog states
    const [showRenamePipelineDialog, setShowRenamePipelineDialog] = useState(false)
    const [renamePipelineId, setRenamePipelineId] = useState<string | null>(null)
    const [renamePipelineName, setRenamePipelineName] = useState("")

    // Delete pipeline dialog states
    const [showDeletePipelineDialog, setShowDeletePipelineDialog] = useState(false)
    const [deletePipelineId, setDeletePipelineId] = useState<string | null>(null)

    // Set as default confirmation dialog
    const [showSetDefaultDialog, setShowSetDefaultDialog] = useState(false)
    const [setDefaultPipelineTarget, setSetDefaultPipelineTarget] = useState<Pipeline | null>(null)

    // Scroll tracking for sticky header
    const contentRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        const el = contentRef.current?.closest('.main-scroll-container') || window
        const handler = () => {
            if (contentRef.current) {
                setScrolled(window.scrollY > 10)
            }
        }
        window.addEventListener('scroll', handler, { passive: true })
        return () => window.removeEventListener('scroll', handler)
    }, [])

    // ─── Load Data ───────────────────────────────────────────
    const loadData = useCallback(async () => {
        setLoading(true)
        // Always scope by activeCompany - even in holding view, show the activeCompany's pipelines
        let pQuery = supabase.from("pipelines").select("*").order("created_at", { ascending: true })
        if (activeCompany?.id) {
            pQuery = pQuery.eq("company_id", activeCompany.id)
        }
        const { data: pData } = await pQuery
        const fetchedPipelines = (pData ?? []) as Pipeline[]
        setPipelines(fetchedPipelines)

        if (fetchedPipelines.length > 0) {
            const pIds = fetchedPipelines.map(p => p.id)
            const { data: sData } = await supabase.from("pipeline_stages").select("*").in("pipeline_id", pIds).order("sort_order", { ascending: true })
            setAllStages((sData ?? []) as PipelineStage[])

            const [rulesRes, restrRes] = await Promise.all([
                supabase.from('pipeline_transition_rules').select('pipeline_id').in('pipeline_id', pIds),
                supabase.from('pipeline_closure_restrictions').select('pipeline_id').in('pipeline_id', pIds)
            ])
            const ruleMap: Record<string, number> = {};
            (rulesRes.data || []).forEach((r: any) => { ruleMap[r.pipeline_id] = (ruleMap[r.pipeline_id] || 0) + 1 })
            setRulesCount(ruleMap)

            const resMap: Record<string, number> = {};
            (restrRes.data || []).forEach((r: any) => { resMap[r.pipeline_id] = (resMap[r.pipeline_id] || 0) + 1 })
            setRestrictionsCount(resMap)
        } else {
            setAllStages([])
            setRulesCount({})
            setRestrictionsCount({})
        }
        setLoading(false)
    }, [activeCompany?.id, supabase])

    useEffect(() => { loadData() }, [loadData])

    // ─── Stage Actions ───────────────────────────────────────
    const handleRenameStage = async (id: string, newName: string) => {
        setEditingStage(null)
        if (!newName.trim()) return
        const stg = allStages.find(s => s.id === id)
        if (stg?.name === newName) return
        setAllStages(prev => prev.map(s => s.id === id ? { ...s, name: newName.trim() } : s))
        const { error } = await supabase.from("pipeline_stages").update({ name: newName.trim() }).eq("id", id)
        if (error) { toast.error("Failed to rename stage"); loadData() }
    }

    const handleChangeColor = async (id: string, color: string) => {
        setColorPickerStage(null)
        setAllStages(prev => prev.map(s => s.id === id ? { ...s, color } : s))
        const { error } = await supabase.from("pipeline_stages").update({ color }).eq("id", id)
        if (error) { toast.error("Failed to change color"); loadData() }
    }

    const openAddStage = (pipelineId: string, type: 'open' | 'closed') => {
        setAddStagePipelineId(pipelineId)
        setAddStageType(type)
        setNewStageName("")
        setNewStageColor("blue")
        setNewStageClosedStatus("lost")
        setShowAddStageDialog(true)
    }

    const confirmAddStage = async () => {
        if (!newStageName.trim() || !addStagePipelineId) return
        const pStages = allStages.filter(s => s.pipeline_id === addStagePipelineId && s.stage_type === addStageType)
        const maxSort = pStages.length > 0 ? Math.max(...pStages.map(s => s.sort_order)) : (addStageType === 'open' ? 0 : 900)

        const insertData: any = {
            pipeline_id: addStagePipelineId,
            name: newStageName.trim(),
            stage_type: addStageType,
            color: addStageType === 'open' ? newStageColor : (newStageClosedStatus === 'won' ? 'emerald' : 'red'),
            sort_order: maxSort + 1,
        }
        if (addStageType === 'closed') {
            insertData.closed_status = newStageClosedStatus
        }

        const { data, error } = await supabase.from("pipeline_stages").insert(insertData).select().single()
        if (error) {
            toast.error(error.message.includes("unique") ? "Stage name already exists" : "Failed to add stage")
        } else if (data) {
            setAllStages(prev => [...prev, data as PipelineStage])
            toast.success("Stage added")
        }
        setShowAddStageDialog(false)
    }

    const confirmDeleteStage = async () => {
        if (!deleteStageId) return
        const { count } = await supabase.from("leads").select("id", { count: "exact", head: true }).eq("pipeline_stage_id", deleteStageId)
        if (count && count > 0) {
            toast.error(`Cannot delete — ${count} lead(s) are actively in this stage`)
            setShowDeleteStageDialog(false)
            return
        }
        const { error } = await supabase.from("pipeline_stages").delete().eq("id", deleteStageId)
        if (error) toast.error("Failed to delete stage")
        else {
            setAllStages(prev => prev.filter(s => s.id !== deleteStageId))
            toast.success("Stage deleted")
        }
        setShowDeleteStageDialog(false)
    }

    // ─── Pipeline Actions ────────────────────────────────────
    const confirmSetDefault = async () => {
        if (!setDefaultPipelineTarget) return
        const p = setDefaultPipelineTarget
        await supabase.from("pipelines").update({ is_default: false }).eq("company_id", p.company_id)
        await supabase.from("pipelines").update({ is_default: true }).eq("id", p.id)
        toast.success(`${p.name} is now the default pipeline`)
        setShowSetDefaultDialog(false)
        loadData()
    }

    const confirmRenamePipeline = async () => {
        if (!renamePipelineId || !renamePipelineName.trim()) return
        const { error } = await supabase.from("pipelines").update({ name: renamePipelineName.trim() }).eq("id", renamePipelineId)
        if (error) toast.error("Failed to rename pipeline")
        else { toast.success("Pipeline renamed"); loadData() }
        setShowRenamePipelineDialog(false)
    }

    const confirmDeletePipeline = async () => {
        if (!deletePipelineId) return
        const pipeline = pipelines.find(p => p.id === deletePipelineId)
        if (pipeline?.is_default) { toast.error("Cannot delete the default pipeline"); setShowDeletePipelineDialog(false); return }

        // Check if any leads reference this pipeline
        const stageIds = allStages.filter(s => s.pipeline_id === deletePipelineId).map(s => s.id)
        if (stageIds.length > 0) {
            const { count } = await supabase.from("leads").select("id", { count: "exact", head: true }).in("pipeline_stage_id", stageIds)
            if (count && count > 0) {
                toast.error(`Cannot delete — ${count} lead(s) are using this pipeline`)
                setShowDeletePipelineDialog(false)
                return
            }
        }

        const { error } = await supabase.from("pipelines").delete().eq("id", deletePipelineId)
        if (error) toast.error("Failed to delete: " + error.message)
        else { toast.success("Pipeline deleted"); loadData() }
        setShowDeletePipelineDialog(false)
    }

    const confirmCreatePipeline = async () => {
        if (!newPipelineName.trim() || !activeCompany?.id) return
        if (newPipelineOpenStages.filter(s => s.name.trim()).length === 0) { toast.error("Add at least one open stage"); return }

        const { data: pipelineData, error: pError } = await supabase.from("pipelines").insert({
            company_id: activeCompany.id,
            name: newPipelineName.trim(),
            is_active: true,
            icon: "Briefcase",
            visibility: "all_subs"
        }).select().single()

        if (pError || !pipelineData) { toast.error("Failed to create pipeline"); return }

        // Insert open stages
        const openInserts = newPipelineOpenStages.filter(s => s.name.trim()).map((s, i) => ({
            pipeline_id: pipelineData.id,
            name: s.name.trim(),
            color: s.color,
            stage_type: 'open' as const,
            sort_order: i + 1
        }))

        // Insert closed stages
        const closedInserts = newPipelineClosedStages.filter(s => s.name.trim()).map((s, i) => ({
            pipeline_id: pipelineData.id,
            name: s.name.trim(),
            color: s.closed_status === 'won' ? 'emerald' : 'red',
            stage_type: 'closed' as const,
            closed_status: s.closed_status,
            sort_order: 900 + i + 1
        }))

        if (openInserts.length > 0 || closedInserts.length > 0) {
            await supabase.from("pipeline_stages").insert([...openInserts, ...closedInserts])
        }

        toast.success("Pipeline created successfully")
        setShowCreatePipelineDialog(false)
        loadData()
    }

    // ─── DnD ─────────────────────────────────────────────────
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

    const handleDragEnd = async (event: DragEndEvent, pipelineId: string, stageType: 'open' | 'closed') => {
        const { active, over } = event
        if (!over || active.id === over.id) return
        const pStages = allStages.filter(s => s.pipeline_id === pipelineId && s.stage_type === stageType).sort((a, b) => a.sort_order - b.sort_order)
        const oldIndex = pStages.findIndex(s => s.id === active.id)
        const newIndex = pStages.findIndex(s => s.id === over.id)
        if (oldIndex === -1 || newIndex === -1) return
        const rearranged = arrayMove(pStages, oldIndex, newIndex)
        const newStages = [...allStages]
        rearranged.forEach((stg, idx) => {
            const indexAll = newStages.findIndex(s => s.id === stg.id)
            if (indexAll > -1) newStages[indexAll] = { ...newStages[indexAll], sort_order: idx + 1 }
        })
        flushSync(() => setAllStages(newStages))
        for (let i = 0; i < rearranged.length; i++) {
            await supabase.from("pipeline_stages").update({ sort_order: i + 1 }).eq("id", rearranged[i].id)
        }
    }

    // ─── Sortable Stage Row ──────────────────────────────────
    const SortableStage = ({ stage }: { stage: PipelineStage }) => {
        const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.id })
        const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.9 : 1, zIndex: isDragging ? 20 : 1, position: 'relative' as const }
        const isEditing = editingStage?.id === stage.id
        const isClosed = stage.stage_type === 'closed'
        const isWon = stage.closed_status === 'won'

        return (
            <div ref={setNodeRef} style={style} className="flex flex-col group relative">
                <div className="flex items-center px-3.5 py-1.5 hover:bg-[#fafbfc] transition-colors gap-2 min-h-[34px]">
                    <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-[#c0c7d2] opacity-40 group-hover:opacity-100 hover:text-slate-500 p-0.5 outline-none">
                        <GripVertical className="h-3.5 w-3.5" />
                    </div>

                    {!isClosed ? (
                        <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: getColorHex(stage.color) }} />
                    ) : isWon ? (
                        <Check className="h-3 w-3 text-emerald-500 shrink-0" strokeWidth={3} />
                    ) : (
                        <X className="h-3 w-3 text-red-500 shrink-0" strokeWidth={3} />
                    )}

                    {isEditing ? (
                        <input
                            autoFocus
                            className="flex-1 text-[12.5px] font-medium text-[#0f1729] bg-[#fafbfc] border-b-[1.5px] border-[#6366f1] focus:outline-none p-0 h-5"
                            value={editingStage.name}
                            onChange={e => setEditingStage({ ...editingStage, name: e.target.value })}
                            onBlur={() => handleRenameStage(stage.id, editingStage.name)}
                            onKeyDown={e => { if (e.key === 'Enter') handleRenameStage(stage.id, editingStage.name); if (e.key === 'Escape') setEditingStage(null) }}
                        />
                    ) : (
                        <div className="flex-1 text-[12.5px] font-medium text-[#0f1729] truncate" onDoubleClick={() => setEditingStage({ id: stage.id, name: stage.name })}>
                            {stage.name}
                        </div>
                    )}

                    {/* Stage menu */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                                <MoreVertical className="h-3.5 w-3.5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36 text-xs">
                            <DropdownMenuItem onClick={() => setEditingStage({ id: stage.id, name: stage.name })} className="text-xs gap-2 py-1.5">
                                <Pencil className="h-3 w-3" /> Rename
                            </DropdownMenuItem>
                            {!isClosed && (
                                <DropdownMenuItem onClick={(e) => { e.preventDefault(); setColorPickerStage(stage.id) }} className="text-xs gap-2 py-1.5">
                                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: getColorHex(stage.color) }} /> Change Color
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => { setDeleteStageId(stage.id); setShowDeleteStageDialog(true) }} className="text-xs gap-2 py-1.5 text-red-600 focus:text-red-700">
                                <Trash2 className="h-3 w-3" /> Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Color picker popover */}
                    {colorPickerStage === stage.id && !isClosed && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setColorPickerStage(null)} />
                            <div className="absolute right-8 top-full mt-1 bg-white border border-slate-200 shadow-lg rounded-xl p-3 z-50 grid grid-cols-5 gap-2 w-[160px]">
                                {COLORS.map(c => (
                                    <button key={c.value} onClick={() => handleChangeColor(stage.id, c.value)} title={c.value}
                                        className={`w-[22px] h-[22px] rounded-full hover:scale-110 transition-transform ${stage.color === c.value ? 'ring-2 ring-offset-1 ring-[#6366f1]' : ''}`}
                                        style={{ backgroundColor: c.hex }} />
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        )
    }

    // ─── Render ───────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-[#f2f3f6]" ref={contentRef}>
            {/* Sticky Header */}
            <div className={`sticky top-0 z-30 bg-[#f2f3f6] transition-shadow duration-200 ${scrolled ? 'shadow-[0_2px_8px_rgba(0,0,0,.06)]' : ''}`}>
                <div className="px-8 pt-6 pb-4 max-w-[1400px] mx-auto">
                    <button onClick={() => router.push("/settings")} className="text-[12px] font-medium text-[#8892a4] hover:text-[#4f46e5] flex items-center gap-1.5 mb-3 transition-colors">
                        <ArrowLeft className="h-3.5 w-3.5" /> Back to Settings
                    </button>
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-[19px] font-[800] text-[#0f1729] tracking-[-0.3px] mb-0.5">Pipeline Configuration</h1>
                            <p className="text-[12px] text-[#8892a4]">Manage your sales pipelines, stages, and rules</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="px-8 pb-8 max-w-[1400px] mx-auto">
                {loading ? (
                    <div className="flex py-20 justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-2">
                        {pipelines.map(pipeline => {
                            const pStages = allStages.filter(s => s.pipeline_id === pipeline.id).sort((a, b) => a.sort_order - b.sort_order)
                            const open = pStages.filter(s => s.stage_type === 'open')
                            const closed = pStages.filter(s => s.stage_type === 'closed')
                            const rules = rulesCount[pipeline.id] || 0
                            const restrictions = restrictionsCount[pipeline.id] || 0

                            return (
                                <div key={pipeline.id} className="bg-white rounded-[12px] border border-[#e5e8ed] shadow-[0_1px_3px_rgba(0,0,0,.03)] overflow-hidden flex flex-col"
                                    style={{ borderTop: pipeline.is_default ? "3px solid #f59e0b" : undefined }}>
                                    {/* Card Header */}
                                    <div className="px-[14px] pt-[14px] pb-[10px] flex justify-between items-start">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                                {pipeline.is_default && <Star className="h-3.5 w-3.5 text-[#f59e0b] fill-[#f59e0b] shrink-0" />}
                                                <h3 className="text-[14px] font-[700] text-[#0f1729] truncate">{pipeline.name}</h3>
                                            </div>
                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                {pipeline.is_default && <span className="bg-[#fef3c7] text-[#f59e0b] text-[9px] font-[700] uppercase tracking-[1px] px-1.5 py-[1px] rounded-[3px]">Default</span>}
                                                <span className="text-[10.5px] text-[#8892a4]">{pStages.length} stages · {rules} rules</span>
                                            </div>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-700 -mr-2 shrink-0">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48">
                                                <DropdownMenuItem onClick={() => { setRenamePipelineId(pipeline.id); setRenamePipelineName(pipeline.name); setShowRenamePipelineDialog(true) }} className="gap-2">
                                                    <Pencil className="h-3.5 w-3.5" /> Rename Pipeline
                                                </DropdownMenuItem>
                                                <DropdownMenuItem disabled={pipeline.is_default}
                                                    onClick={() => { setSetDefaultPipelineTarget(pipeline); setShowSetDefaultDialog(true) }} className="gap-2">
                                                    <CheckCircle2 className="h-3.5 w-3.5" /> Set as Default
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem disabled={pipeline.is_default || pipelines.length <= 1}
                                                    onClick={() => { setDeletePipelineId(pipeline.id); setShowDeletePipelineDialog(true) }}
                                                    className="gap-2 text-red-600 focus:text-red-700">
                                                    <Trash2 className="h-3.5 w-3.5" /> Delete Pipeline
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>

                                    {/* Mini flow preview */}
                                    <div className="px-3.5 py-2 bg-[#fafbfc] flex items-center overflow-hidden">
                                        <div className="flex items-center gap-0" style={{ width: 'max-content' }}>
                                            {pStages.slice(0, 6).map((s, idx) => {
                                                const isClosed = s.stage_type === 'closed'
                                                const isWon = s.closed_status === 'won'
                                                return (
                                                    <div key={s.id} className="flex items-center">
                                                        {idx > 0 && <span className="text-[#d1d5db] mx-1 text-[10px]">→</span>}
                                                        {!isClosed ? (
                                                            <div className="h-[8px] w-[8px] rounded-full border-[1.5px] bg-white" style={{ borderColor: getColorHex(s.color) }} />
                                                        ) : (
                                                            <div className={`h-[8px] w-[8px] rounded-full flex items-center justify-center ${isWon ? 'bg-emerald-500' : 'bg-red-500'}`}>
                                                                {isWon ? <Check className="h-[5px] w-[5px] text-white" strokeWidth={4} /> : <X className="h-[5px] w-[5px] text-white" strokeWidth={4} />}
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                            {pStages.length > 6 && <span className="text-[9px] text-[#94a3b8] ml-2">+{pStages.length - 6} more</span>}
                                        </div>
                                    </div>

                                    {/* Open Stages */}
                                    <div className="flex flex-col border-t border-[#e5e8ed]">
                                        <div className="px-3.5 pt-3 pb-1 text-[9.5px] font-[700] uppercase tracking-[1px] text-[#94a3b8]">Open Stages</div>
                                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={e => handleDragEnd(e, pipeline.id, 'open')}>
                                            <SortableContext items={open.map(x => x.id)} strategy={verticalListSortingStrategy}>
                                                <div className="flex flex-col">{open.map(stage => <SortableStage key={stage.id} stage={stage} />)}</div>
                                            </SortableContext>
                                        </DndContext>
                                        <div className="px-3.5 py-1.5 border-t border-[#f1f3f5]">
                                            <button onClick={() => openAddStage(pipeline.id, 'open')} className="text-[11.5px] font-[500] text-[#6366f1] hover:bg-[#eef2ff] px-2 py-1 rounded transition-colors">+ Add Stage</button>
                                        </div>
                                    </div>

                                    {/* Closed Stages */}
                                    <div className="flex flex-col border-t border-[#e5e8ed]">
                                        <div className="px-3.5 pt-3 pb-1 text-[9.5px] font-[700] uppercase tracking-[1px] text-[#94a3b8]">Closed Stages</div>
                                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={e => handleDragEnd(e, pipeline.id, 'closed')}>
                                            <SortableContext items={closed.map(x => x.id)} strategy={verticalListSortingStrategy}>
                                                <div className="flex flex-col">{closed.map(stage => <SortableStage key={stage.id} stage={stage} />)}</div>
                                            </SortableContext>
                                        </DndContext>
                                        <div className="px-3.5 py-1.5 border-t border-[#f1f3f5]">
                                            <button onClick={() => openAddStage(pipeline.id, 'closed')} className="text-[11.5px] font-[500] text-[#6366f1] hover:bg-[#eef2ff] px-2 py-1 rounded transition-colors">+ Add Stage</button>
                                        </div>
                                    </div>

                                    <div className="flex-1" />

                                    {/* Footer */}
                                    <div className="px-[14px] py-[10px] border-t border-[#f1f3f5] bg-[#fafbfc] flex items-center justify-between mt-auto">
                                        <div className={`text-[10.5px] ${rules > 0 ? "text-[#8892a4]" : "text-[#94a3b8] italic"}`}>
                                            {rules === 0 ? "No rules yet" : `${rules} rules · ${restrictions} restriction${restrictions !== 1 ? 's' : ''}`}
                                        </div>
                                        <button onClick={() => router.push(`/settings/pipeline/${pipeline.id}`)} className="text-[11.5px] font-[600] text-[#6366f1] hover:underline">Configure Rules →</button>
                                    </div>
                                </div>
                            )
                        })}

                        {/* Create New Pipeline Placeholder */}
                        <div onClick={() => {
                            setNewPipelineName("")
                            setNewPipelineOpenStages([{ name: "Lead Masuk", color: "blue" }, { name: "Qualified", color: "violet" }, { name: "Proposal Sent", color: "sky" }])
                            setNewPipelineClosedStages([{ name: "Closed Won", closed_status: "won" }, { name: "Closed Lost", closed_status: "lost" }])
                            setShowCreatePipelineDialog(true)
                        }}
                            className="border-2 border-dashed border-[#d1d5db] rounded-[12px] bg-transparent cursor-pointer hover:border-[#6366f1] hover:bg-[#eef2ff] transition-colors flex flex-col items-center justify-center text-center p-8 min-h-[300px]">
                            <div className="h-10 w-10 border border-[#d1d5db] rounded-full flex items-center justify-center mb-4 opacity-70">
                                <Plus className="h-5 w-5 text-[#94a3b8]" />
                            </div>
                            <h3 className="text-[13px] font-[600] text-[#8892a4] mb-1">Create New Pipeline</h3>
                            <p className="text-[11px] text-[#94a3b8] max-w-[180px]">Define a custom pipeline for different business processes</p>
                        </div>
                    </div>
                )}
            </div>

            {/* ─── Add Stage Dialog ──────────────────────────────── */}
            <Dialog open={showAddStageDialog} onOpenChange={setShowAddStageDialog}>
                <DialogContent className="sm:max-w-[440px]">
                    <DialogHeader>
                        <DialogTitle>Add {addStageType === 'open' ? 'Open' : 'Closed'} Stage</DialogTitle>
                        <DialogDescription>{addStageType === 'open' ? 'Enter a name and pick a color for the new stage.' : 'Enter a name and select the outcome category.'}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div>
                            <Label className="text-xs mb-1.5">Stage Name</Label>
                            <Input autoFocus placeholder={addStageType === 'open' ? "e.g. Negotiation" : "e.g. Closed Won"} value={newStageName} onChange={(e) => setNewStageName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && confirmAddStage()} />
                        </div>
                        {addStageType === 'open' ? (
                            <div>
                                <Label className="text-xs mb-1.5">Color</Label>
                                <div className="flex gap-2 flex-wrap mt-1">
                                    {COLORS.map(c => (
                                        <button key={c.value} onClick={() => setNewStageColor(c.value)} title={c.value}
                                            className={`w-7 h-7 rounded-full hover:scale-110 transition-transform ${newStageColor === c.value ? 'ring-2 ring-offset-2 ring-[#6366f1]' : ''}`}
                                            style={{ backgroundColor: c.hex }} />
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div>
                                <Label className="text-xs mb-1.5">Outcome Category</Label>
                                <div className="flex gap-3 mt-1">
                                    <button onClick={() => setNewStageClosedStatus('won')}
                                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${newStageClosedStatus === 'won' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-[#e5e8ed] text-[#8892a4] hover:border-emerald-300'}`}>
                                        <Check className="h-4 w-4" strokeWidth={3} /> Won
                                    </button>
                                    <button onClick={() => setNewStageClosedStatus('lost')}
                                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${newStageClosedStatus === 'lost' ? 'border-red-500 bg-red-50 text-red-700' : 'border-[#e5e8ed] text-[#8892a4] hover:border-red-300'}`}>
                                        <X className="h-4 w-4" strokeWidth={3} /> Lost
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAddStageDialog(false)}>Cancel</Button>
                        <Button onClick={confirmAddStage} disabled={!newStageName.trim()}>Add Stage</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Delete Stage Dialog ───────────────────────────── */}
            <Dialog open={showDeleteStageDialog} onOpenChange={setShowDeleteStageDialog}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle className="text-red-600 flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> Delete Stage</DialogTitle>
                        <DialogDescription>Are you sure? Stages with active leads cannot be deleted. This action cannot be undone.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDeleteStageDialog(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={confirmDeleteStage}>Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Create Pipeline Dialog ─────────────────────────── */}
            <Dialog open={showCreatePipelineDialog} onOpenChange={setShowCreatePipelineDialog}>
                <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Create New Pipeline</DialogTitle>
                        <DialogDescription>Define a name, open stages, and closed stages for your new pipeline.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-5 py-2">
                        {/* Pipeline Name */}
                        <div>
                            <Label className="text-xs font-semibold mb-1.5">Pipeline Name</Label>
                            <Input autoFocus placeholder="e.g. Sales Pipeline" value={newPipelineName} onChange={e => setNewPipelineName(e.target.value)} />
                        </div>

                        {/* Open Stages */}
                        <div>
                            <Label className="text-[9.5px] font-[700] uppercase tracking-[1px] text-[#94a3b8] mb-2">Open Stages</Label>
                            <div className="space-y-2 mt-2">
                                {newPipelineOpenStages.map((s, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <div className="relative">
                                            <button className="w-6 h-6 rounded-full border border-slate-200 hover:scale-110 transition-transform" style={{ backgroundColor: getColorHex(s.color) }}
                                                onClick={() => {
                                                    // Cycle through colors
                                                    const ci = COLORS.findIndex(c => c.value === s.color)
                                                    const next = COLORS[(ci + 1) % COLORS.length]
                                                    const updated = [...newPipelineOpenStages]; updated[i] = { ...updated[i], color: next.value }; setNewPipelineOpenStages(updated)
                                                }} />
                                        </div>
                                        <Input className="h-8 text-[12.5px]" value={s.name} placeholder="Stage name..."
                                            onChange={e => { const updated = [...newPipelineOpenStages]; updated[i] = { ...updated[i], name: e.target.value }; setNewPipelineOpenStages(updated) }} />
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600 shrink-0"
                                            onClick={() => setNewPipelineOpenStages(prev => prev.filter((_, idx) => idx !== i))}><X className="h-3.5 w-3.5" /></Button>
                                    </div>
                                ))}
                                <button onClick={() => setNewPipelineOpenStages(prev => [...prev, { name: "", color: COLORS[prev.length % COLORS.length].value }])}
                                    className="text-[11.5px] font-[500] text-[#6366f1] hover:underline flex items-center gap-1 mt-1"><Plus className="h-3 w-3" /> Add open stage</button>
                            </div>
                        </div>

                        {/* Closed Stages */}
                        <div>
                            <Label className="text-[9.5px] font-[700] uppercase tracking-[1px] text-[#94a3b8] mb-2">Closed Stages</Label>
                            <div className="space-y-2 mt-2">
                                {newPipelineClosedStages.map((s, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <button onClick={() => {
                                            const updated = [...newPipelineClosedStages]; updated[i] = { ...updated[i], closed_status: s.closed_status === 'won' ? 'lost' : 'won' }; setNewPipelineClosedStages(updated)
                                        }}
                                            className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center ${s.closed_status === 'won' ? 'bg-emerald-500' : 'bg-red-500'}`}>
                                            {s.closed_status === 'won' ? <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} /> : <X className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                                        </button>
                                        <Input className="h-8 text-[12.5px]" value={s.name} placeholder="Stage name..."
                                            onChange={e => { const updated = [...newPipelineClosedStages]; updated[i] = { ...updated[i], name: e.target.value }; setNewPipelineClosedStages(updated) }} />
                                        <span className={`text-[9px] font-semibold uppercase tracking-wide shrink-0 w-8 ${s.closed_status === 'won' ? 'text-emerald-600' : 'text-red-500'}`}>{s.closed_status === 'won' ? 'WON' : 'LOST'}</span>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600 shrink-0"
                                            onClick={() => setNewPipelineClosedStages(prev => prev.filter((_, idx) => idx !== i))}><X className="h-3.5 w-3.5" /></Button>
                                    </div>
                                ))}
                                <button onClick={() => setNewPipelineClosedStages(prev => [...prev, { name: "", closed_status: "lost" }])}
                                    className="text-[11.5px] font-[500] text-[#6366f1] hover:underline flex items-center gap-1 mt-1"><Plus className="h-3 w-3" /> Add closed stage</button>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreatePipelineDialog(false)}>Cancel</Button>
                        <Button onClick={confirmCreatePipeline} disabled={!newPipelineName.trim()}>Create Pipeline</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Rename Pipeline Dialog ─────────────────────────── */}
            <Dialog open={showRenamePipelineDialog} onOpenChange={setShowRenamePipelineDialog}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Rename Pipeline</DialogTitle>
                        <DialogDescription>Enter a new name for this pipeline.</DialogDescription>
                    </DialogHeader>
                    <div className="py-2">
                        <Input autoFocus value={renamePipelineName} onChange={e => setRenamePipelineName(e.target.value)} onKeyDown={e => e.key === 'Enter' && confirmRenamePipeline()} />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowRenamePipelineDialog(false)}>Cancel</Button>
                        <Button onClick={confirmRenamePipeline} disabled={!renamePipelineName.trim()}>Rename</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Delete Pipeline Dialog ─────────────────────────── */}
            <Dialog open={showDeletePipelineDialog} onOpenChange={setShowDeletePipelineDialog}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle className="text-red-600 flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> Delete Pipeline</DialogTitle>
                        <DialogDescription>
                            This will permanently delete the pipeline and all its stages. Pipelines with active leads cannot be deleted. This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDeletePipelineDialog(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={confirmDeletePipeline}>Delete Pipeline</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Set as Default Confirmation Dialog ──────────────  */}
            <Dialog open={showSetDefaultDialog} onOpenChange={setShowSetDefaultDialog}>
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><Star className="h-5 w-5 text-[#f59e0b] fill-[#f59e0b]" /> Set as Default</DialogTitle>
                        <DialogDescription>
                            Set <strong>{setDefaultPipelineTarget?.name}</strong> as default? This will be shown first in Pipeline view and Dashboard.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowSetDefaultDialog(false)}>Cancel</Button>
                        <Button onClick={confirmSetDefault}>Set as Default</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
