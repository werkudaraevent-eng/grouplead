"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Lead, PipelineStage } from "@/types"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LeadForm } from "@/features/leads/components/lead-form"
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { PermissionGate } from "@/features/users/components/permission-gate"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import {
    ArrowLeft, Pencil, Check, Upload, Plus,
    Building2, User, Wallet, CalendarDays,
    Clock, FileText, CheckSquare, BookOpen,
    Mail, Phone, Globe, MapPin, Briefcase,
    LayoutTemplate, ClipboardList, MessageSquareDashed, Folder,
    Tags, Layers, History, MoreHorizontal,
    ChevronLeft, ChevronRight, Trash2, GitMerge, Target, ChevronDown, ThumbsUp, ThumbsDown
} from "lucide-react"
import { InlineEditor } from "@/features/leads/components/inline-editor"
import { NotesTab } from "@/features/leads/components/notes-tab"
import { TimelineTab } from "@/features/leads/components/timeline-tab"
import { StageHistoryTab } from "@/features/leads/components/stage-history-tab"
import { HeaderMetricPopover } from "@/features/leads/components/header-metric-popover"
import { HeaderAssigneePopover } from "@/features/leads/components/header-assignee-popover"
import { TasksTab } from "@/features/leads/components/tasks-tab"
interface LeadDetailPageProps {
    lead: Lead & { pipeline?: { name: string } | null }
    prevLeadId?: number | null
    nextLeadId?: number | null
    lastModifiedBy?: string
    lastModified?: string
}

export function LeadDetailPage({ lead, prevLeadId, nextLeadId, lastModifiedBy = "System", lastModified }: LeadDetailPageProps) {
    const router = useRouter()
    const supabase = createClient()
    const [editOpen, setEditOpen] = useState(false)
    const [deleteConfirm, setDeleteConfirm] = useState(false)

    // ─── Stage Tracker state ─────────────────────────────
    const [stages, setStages] = useState<PipelineStage[]>([])
    const [movingStage, setMovingStage] = useState(false)
    const [isScrolled, setIsScrolled] = useState(false)

    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const top = e.currentTarget.scrollTop
        setIsScrolled(prev => {
            if (!prev && top > 60) return true
            if (prev && top < 10) return false
            return prev
        })
    }, [])

    const stageName = lead.pipeline_stage?.name || "Unknown"
    const isWon = stageName.toLowerCase().includes('won')
    const isLost = ['lost', 'canceled', 'cancelled', 'postponed', 'turndown'].some(w => stageName.toLowerCase().includes(w))
    const activeColorClass = isWon ? 'bg-emerald-500 hover:bg-emerald-600' : isLost ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-700'
    const activeLineClass = isWon ? 'bg-emerald-500' : isLost ? 'bg-red-500' : 'bg-blue-600'

    const loadStages = useCallback(async () => {
        if (!lead.pipeline_id) return
        const { data } = await supabase
            .from('pipeline_stages')
            .select('*')
            .eq('pipeline_id', lead.pipeline_id)
            .order('sort_order', { ascending: true })
        if (data) setStages(data)
    }, [lead.pipeline_id])

    useEffect(() => { loadStages() }, [loadStages])

    const currentStageIdx = stages.findIndex(s => s.name === stageName)

    const handleStageClick = async (stage: PipelineStage) => {
        if (stage.name === stageName || movingStage) return
        setMovingStage(true)
        const { error } = await supabase
            .from('leads')
            .update({ pipeline_stage_id: stage.id, status: stage.name })
            .eq('id', lead.id)
        if (error) {
            toast.error("Failed to move stage")
        } else {
            const { data: { user } } = await supabase.auth.getUser()
            let userName = "System"
            if (user) {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("full_name")
                    .eq("id", user.id)
                    .single()
                if (profile?.full_name) userName = profile.full_name
            }

            await supabase.from("lead_stage_history").insert({
                lead_id: lead.id,
                stage_id: stage.id,
                stage_name: stage.name,
                user_id: user?.id ?? null,
                user_name: userName,
                amount: lead.estimated_value ?? null,
            })

            await supabase.from("lead_activities").insert({
                lead_id: lead.id,
                user_id: user?.id ?? null,
                action_type: "Stage Change",
                description: `${userName} moved lead from "${stageName}" to "${stage.name}"`,
            })

            toast.success(`Moved to "${stage.name}"`)
            router.refresh()
        }
        setMovingStage(false)
    }

    // ─── Currency formatter ──────────────────────────────
    const fmtCurrency = (v: number | null | undefined) =>
        v ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v) : "—"

    const fmtDate = (d: string | null | undefined) =>
        d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"

    const fmtDateTime = (d: string | null | undefined) =>
        d ? new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"

    // ═══════════════════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════════════════
    return (
        <div className="flex flex-col h-full overflow-hidden bg-[#f8fafc]">

            {/* ═══ TOP HEADER (white) ══════════════════════════════ */}
            <header className="flex-none bg-white border-b border-slate-200">
                <div className="px-8 py-5 flex flex-col gap-5">

                    {/* Row 1: Breadcrumb + Title + Actions */}
                    <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                            {/* Nav Cluster: Back + Prev/Next */}
                            <div className="flex items-center gap-1 mt-0.5">
                                <button
                                    onClick={() => router.push('/leads')}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                    title="Back to leads"
                                >
                                    <ArrowLeft className="h-[18px] w-[18px]" />
                                </button>
                            </div>
                            <div className="flex flex-col justify-center">
                                <div className="flex flex-wrap items-center gap-3">
                                    <HeaderMetricPopover
                                        leadId={lead.id}
                                        fieldPath="project_name"
                                        label="Project Name"
                                        displayValue={lead.project_name || "Untitled Lead"}
                                        triggerClassName="text-xl font-semibold text-slate-900 hover:text-blue-600 text-left max-w-[500px]"
                                        rawValue={lead.project_name}
                                    />
                                    <div className="flex items-center">
                                        {isScrolled && (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <button
                                                        disabled={movingStage}
                                                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-white shadow-sm transition-all shrink-0 animate-in fade-in slide-in-from-bottom-2 ${activeColorClass}`}
                                                        title="Current Pipeline Stage"
                                                    >
                                                        <span className="text-[12px] font-semibold tracking-wide whitespace-nowrap max-w-[150px] truncate">{stageName}</span>
                                                        <ChevronDown className="h-3.5 w-3.5 opacity-80 shrink-0 ml-1" />
                                                    </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="start" className="w-64">
                                                    {stages.map((s, sIdx) => {
                                                        const isStageWon = s.name.toLowerCase().includes('won');
                                                        const isStageLost = ['lost', 'canceled', 'cancelled', 'postponed', 'turndown'].some(term => s.name.toLowerCase().includes(term));
                                                        return (
                                                            <DropdownMenuItem
                                                                key={s.id}
                                                                onClick={() => handleStageClick(s)}
                                                                className={`cursor-pointer gap-2 ${s.id === lead.pipeline_stage_id ? 'bg-blue-50/50 font-semibold text-blue-600' : ''}`}
                                                            >
                                                                {isStageWon && <ThumbsUp className="h-3.5 w-3.5 fill-emerald-500 text-emerald-500 shrink-0" strokeWidth={2} />}
                                                                {isStageLost && <ThumbsDown className="h-3.5 w-3.5 fill-red-500 text-red-500 shrink-0" strokeWidth={2} />}
                                                                {!isStageWon && !isStageLost && <div className="w-3.5 shrink-0" />}
                                                                <span>{s.name}</span>
                                                                {sIdx < (stages.findIndex(x => x.name === stageName)) && <Check className="ml-auto h-3.5 w-3.5 text-emerald-500 opacity-70 shrink-0" />}
                                                                {sIdx === (stages.findIndex(x => x.name === stageName)) && <Check className="ml-auto h-4 w-4 text-blue-600 shrink-0" />}
                                                            </DropdownMenuItem>
                                                        )
                                                    })}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}
                                    </div>
                                </div>
                                {/* Inline Metric Strip */}
                                <div className="flex items-center gap-5 mt-2">
                                    <div className="flex items-center gap-2 text-[13px]">
                                        <span className="text-slate-400 font-medium flex items-center gap-1.5">
                                            <Wallet className="h-3.5 w-3.5" /> Amount:
                                        </span>
                                        <HeaderMetricPopover
                                            leadId={lead.id}
                                            fieldPath="estimated_value"
                                            label="Estimated Value"
                                            displayValue={fmtCurrency(lead.estimated_value)}
                                            inputType="number"
                                            rawValue={lead.estimated_value}
                                        />
                                    </div>
                                    <div className="w-px h-4 bg-slate-200" />
                                    <div className="flex items-center gap-2 text-[13px]">
                                        <span className="text-slate-400 font-medium flex items-center gap-1.5">
                                            <CalendarDays className="h-3.5 w-3.5" /> Close Date:
                                        </span>
                                        <HeaderMetricPopover
                                            leadId={lead.id}
                                            fieldPath="target_close_date"
                                            label="Target Close"
                                            displayValue={fmtDate(lead.target_close_date)}
                                            inputType="date"
                                            rawValue={lead.target_close_date}
                                        />
                                    </div>
                                    <div className="w-px h-4 bg-slate-200" />
                                    <div className="flex items-center gap-2 text-[13px]">
                                        <span className="text-slate-400 font-medium flex items-center gap-1.5">
                                            <User className="h-3.5 w-3.5" /> PIC:
                                        </span>
                                        <HeaderAssigneePopover
                                            leadId={lead.id}
                                            fieldPath="pic_sales_id"
                                            label="PIC Sales"
                                            displayValue={lead.pic_sales_profile?.full_name || "Unassigned"}
                                            rawValue={lead.pic_sales_id}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden shadow-sm bg-white">
                                <Link
                                    href={prevLeadId ? `/leads/${prevLeadId}` : '#'}
                                    prefetch={false}
                                    className={`w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors border-r border-slate-200 ${!prevLeadId ? 'opacity-30 pointer-events-none bg-slate-50/50' : ''}`}
                                    title="Previous lead"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Link>
                                <Link
                                    href={nextLeadId ? `/leads/${nextLeadId}` : '#'}
                                    prefetch={false}
                                    className={`w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors ${!nextLeadId ? 'opacity-30 pointer-events-none bg-slate-50/50' : ''}`}
                                    title="Next lead"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Link>
                            </div>

                            <div className="w-px h-5 bg-slate-200 block" />

                            <div className="flex items-center gap-2">
                                {/* Activated 3-Dot Menu */}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48">
                                        <DropdownMenuItem
                                            className="text-red-600 focus:bg-red-50 focus:text-red-700 cursor-pointer"
                                            onClick={async () => {
                                                if (!confirm('Are you sure you want to delete this lead? This action cannot be undone.')) return
                                                const { error } = await supabase.from('leads').delete().eq('id', lead.id)
                                                if (error) {
                                                    toast.error(`Delete failed: ${error.message}`)
                                                } else {
                                                    toast.success('Lead deleted')
                                                    router.push('/leads')
                                                }
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Delete Lead
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                <PermissionGate resource="leads" action="update">
                                    <Button
                                        onClick={() => setEditOpen(true)}
                                        size="sm"
                                        className="h-9 bg-slate-900 hover:bg-slate-800 text-white"
                                    >
                                        <Pencil className="h-3.5 w-3.5 mr-1.5" />
                                        Edit Details
                                    </Button>
                                </PermissionGate>
                            </div>
                        </div>
                    </div>

                    {/* Row 2: Compact Line Stepper */}
                    <div className={`transition-all duration-300 ease-in-out border-slate-100 ${isScrolled ? 'h-0 opacity-0 overflow-hidden' : 'h-16 opacity-100 mt-3 pt-3 border-t'}`}>
                        {stages.length > 0 && (
                            <div className="flex items-center w-full px-2">
                                {stages.map((stage, idx) => {
                                    const isPast = idx < currentStageIdx
                                    const isCurrent = idx === currentStageIdx
                                    const isLast = idx === stages.length - 1

                                    const isStageWon = stage.name.toLowerCase().includes('won')
                                    const isStageLost = ['lost', 'canceled', 'cancelled', 'postponed', 'turndown'].some(w => stage.name.toLowerCase().includes(w))

                                    return (
                                        <div key={stage.id} className="contents">
                                            {/* Stage Node */}
                                            {isCurrent ? (
                                                <div
                                                    className={`relative flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-white shadow-sm shrink-0 min-w-0 max-w-[140px] md:max-w-[180px] ${activeColorClass}`}
                                                    title="Current Pipeline Stage"
                                                >
                                                    <span className="text-[12px] font-semibold tracking-wide truncate">{stage.name}</span>
                                                    {/* Terminal Icon Below */}
                                                    {(isStageWon || isStageLost) && (
                                                        <div className="absolute top-9 left-1/2 -translate-x-1/2">
                                                            {isStageWon ?
                                                                <ThumbsUp className="h-3.5 w-3.5 fill-emerald-500 text-emerald-500" strokeWidth={2} /> :
                                                                <ThumbsDown className="h-3.5 w-3.5 fill-red-500 text-red-500" strokeWidth={2} />
                                                            }
                                                        </div>
                                                    )}
                                                </div>
                                            ) : isPast ? (
                                                <button
                                                    onClick={() => handleStageClick(stage)}
                                                    disabled={movingStage}
                                                    className={`w-7 h-7 rounded-full flex flex-col items-center justify-center text-white shrink-0 transition-colors shadow-sm relative group cursor-pointer disabled:cursor-not-allowed ${activeColorClass}`}
                                                >
                                                    <Check className="h-4 w-4" />
                                                    <div className="absolute top-10 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[11px] px-2 py-1 rounded shadow-md pointer-events-none z-50">
                                                        {stage.name}
                                                    </div>
                                                    {/* Terminal Icon Below */}
                                                    {(isStageWon || isStageLost) && (
                                                        <div className="absolute top-9">
                                                            {isStageWon ?
                                                                <ThumbsUp className="h-3.5 w-3.5 fill-emerald-500 text-emerald-500" strokeWidth={2} /> :
                                                                <ThumbsDown className="h-3.5 w-3.5 fill-red-500 text-red-500" strokeWidth={2} />
                                                            }
                                                        </div>
                                                    )}
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleStageClick(stage)}
                                                    disabled={movingStage}
                                                    className={`w-4 h-4 rounded-full flex flex-col items-center justify-center hover:scale-110 ring-4 ring-white shrink-0 transition-all relative group cursor-pointer disabled:cursor-not-allowed ${isStageWon ? 'bg-emerald-100 border border-emerald-300' :
                                                            isStageLost ? 'bg-red-100 border border-red-300' :
                                                                'bg-slate-200 hover:bg-slate-300'
                                                        }`}
                                                >
                                                    {isStageWon && <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />}
                                                    {isStageLost && <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />}
                                                    <div className="absolute top-8 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[11px] px-2 py-1 rounded shadow-md pointer-events-none z-50">
                                                        {stage.name}
                                                    </div>
                                                    {/* Terminal Icon Below */}
                                                    {(isStageWon || isStageLost) && (
                                                        <div className="absolute top-6">
                                                            {isStageWon ?
                                                                <ThumbsUp className="h-3.5 w-3.5 text-emerald-400 opacity-60" strokeWidth={2} /> :
                                                                <ThumbsDown className="h-3.5 w-3.5 text-red-400 opacity-60" strokeWidth={2} />
                                                            }
                                                        </div>
                                                    )}
                                                </button>
                                            )}

                                            {/* Connecting Line */}
                                            {!isLast && (
                                                <div className={`h-[2px] flex-1 shrink min-w-[8px] mx-1 md:mx-2 rounded-full transition-colors ${isPast ? activeLineClass : 'bg-slate-200'
                                                    }`} />
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* ═══ CONTENT AREA ════════════════════════════════════ */}
            <div className="flex-1 flex gap-6 p-6 overflow-hidden">

                {/* ─── LEFT PANEL (320px) ─────────────────────────── */}
                <div
                    className="w-[320px] shrink-0 h-full overflow-y-auto flex flex-col gap-5 custom-scrollbar pr-4 pb-12"
                >

                    {/* Card 1: Deal Information */}
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden shrink-0">
                        <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-semibold text-[14px] text-slate-900">Deal Information</h3>
                            <PermissionGate resource="leads" action="update">
                                <button
                                    onClick={() => setEditOpen(true)}
                                    className="text-slate-400 hover:text-slate-600 transition-colors"
                                    title="Edit deal info"
                                >
                                    <Pencil className="h-3.5 w-3.5" />
                                </button>
                            </PermissionGate>
                        </div>
                        <div className="p-5 flex flex-col gap-3.5">
                            {lead.company?.name && (
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-[12px] text-slate-400 flex items-center gap-1.5 shrink-0">
                                        <Building2 className="h-3 w-3" /> Subsidiary
                                    </span>
                                    <span className="text-[12px] font-semibold bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-md">
                                        {lead.company.name}
                                    </span>
                                </div>
                            )}
                            <KVRow icon={Wallet} label="Estimated Value" value={fmtCurrency(lead.estimated_value)} />
                            <KVRow icon={CalendarDays} label="Target Close" value={fmtDate(lead.target_close_date)} />
                            <KVRow icon={MapPin} label="Lead Source" value={lead.lead_source} />
                            <KVRow icon={Tags} label="Category" value={lead.category} highlight />
                            <KVRow icon={Layers} label="Main Stream" value={lead.main_stream} />
                            <KVRow icon={GitMerge} label="Stream Type" value={lead.stream_type} />
                            <KVRow icon={Target} label="Business Purpose" value={lead.business_purpose} />
                            <KVRow icon={Globe} label="Event Format" value={lead.event_format} />
                            <KVRow icon={Briefcase} label="Grade" value={lead.grade_lead} />
                        </div>
                    </div>

                    {/* Card 2: Client & Contact */}
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden shrink-0">
                        <div className="px-5 py-4 border-b border-slate-100">
                            <h3 className="font-semibold text-[14px] text-slate-900">Client & Contact</h3>
                        </div>
                        <div className="p-5 flex flex-col gap-5">
                            {/* Company */}
                            {lead.client_company?.id && lead.client_company?.name ? (
                                <Link href={`/companies/${lead.client_company.id}`} className="flex items-center gap-3 group cursor-pointer hover:bg-slate-50 p-1.5 -ml-1.5 rounded-lg transition-colors">
                                    <div className="h-10 w-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-sm font-bold shrink-0 group-hover:bg-orange-200 transition-colors">
                                        {lead.client_company.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{lead.client_company.name}</p>
                                        <p className="text-[12px] text-slate-400">Client Company</p>
                                    </div>
                                </Link>
                            ) : lead.client_company?.name && (
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-sm font-bold shrink-0">
                                        {lead.client_company.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">{lead.client_company.name}</p>
                                        <p className="text-[12px] text-slate-400">Client Company</p>
                                    </div>
                                </div>
                            )}

                            {/* Contact Person */}
                            {lead.contact && (
                                <div className="flex flex-col gap-3 mt-1">
                                    <Link href={`/contacts/${lead.contact.id}`} className="flex items-center gap-3 group cursor-pointer hover:bg-slate-50 p-1.5 -ml-1.5 rounded-lg transition-colors">
                                        <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-600 shrink-0 group-hover:bg-slate-300 transition-colors">
                                            <User className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                                                {lead.contact.salutation ? `${lead.contact.salutation} ` : ""}{lead.contact.full_name}
                                            </p>
                                            <p className="text-[12px] text-slate-400 truncate">
                                                Client Contact
                                            </p>
                                        </div>
                                    </Link>

                                    {/* Contact Info */}
                                    <div className="flex flex-col gap-2 ml-[52px]">
                                        {lead.contact.email && (
                                            <div className="flex min-w-0">
                                                <a
                                                    href={`mailto:${lead.contact.email}`}
                                                    className="flex items-center gap-2.5 text-[13px] text-slate-600 hover:text-blue-600 transition-colors bg-slate-50 rounded-lg px-3 py-2 min-w-0 max-w-full"
                                                >
                                                    <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                                    <span className="truncate">{lead.contact.email}</span>
                                                </a>
                                            </div>
                                        )}
                                        {lead.contact.phone && (
                                            <div className="flex min-w-0">
                                                <a
                                                    href={`tel:${lead.contact.phone}`}
                                                    className="flex items-center gap-2.5 text-[13px] text-slate-600 hover:text-blue-600 transition-colors bg-slate-50 rounded-lg px-3 py-2 min-w-0 max-w-full"
                                                >
                                                    <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                                    <span className="truncate">{lead.contact.phone}</span>
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Account Manager Assignment */}
                            {lead.account_manager_profile?.full_name && (
                                <KVRow icon={User} label="Account Manager" value={lead.account_manager_profile.full_name} />
                            )}
                        </div>
                    </div>

                    {/* Card 3: Event Details (conditional) */}
                    {(lead.event_date_start || lead.pax_count || (lead.destinations && lead.destinations.length > 0)) && (
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden shrink-0">
                            <div className="px-5 py-4 border-b border-slate-100">
                                <h3 className="font-semibold text-[14px] text-slate-900">Event Details</h3>
                            </div>
                            <div className="p-5 flex flex-col gap-3.5">
                                <KVRow icon={CalendarDays} label="Start Date" value={fmtDate(lead.event_date_start)} />
                                <KVRow icon={CalendarDays} label="End Date" value={fmtDate(lead.event_date_end)} />
                                {lead.pax_count && <KVRow icon={User} label="Pax Count" value={lead.pax_count.toString()} />}
                                {lead.destinations && lead.destinations.length > 0 && (
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[12px] text-slate-400 flex items-center gap-1.5">
                                            <MapPin className="h-3 w-3" /> Destinations
                                        </span>
                                        {lead.destinations.map((d, i) => (
                                            <p key={i} className="text-[13px] font-medium text-slate-700 pl-[18px]">
                                                {d.city}{d.venue ? ` — ${d.venue}` : ''}
                                            </p>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Card 4: Lost Reason (conditional — only when data exists) */}
                    {(lead.lost_reason || lead.lost_reason_details) && (
                        <div className="bg-red-50/50 border border-red-200 rounded-xl shadow-sm flex flex-col overflow-hidden shrink-0">
                            <div className="px-5 py-4 border-b border-red-100 flex items-center gap-2">
                                <ThumbsDown className="h-4 w-4 text-red-400" />
                                <h3 className="font-semibold text-[14px] text-red-800">Lost Reason</h3>
                            </div>
                            <div className="p-5 flex flex-col gap-3.5">
                                {lead.lost_reason && (
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-[12px] text-red-400 flex items-center gap-1.5 shrink-0">
                                            <Tags className="h-3 w-3" /> Reason
                                        </span>
                                        <span className="text-[12px] font-semibold bg-red-100 text-red-700 px-2.5 py-0.5 rounded-md">
                                            {lead.lost_reason}
                                        </span>
                                    </div>
                                )}
                                {lead.lost_reason_details && (
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[12px] text-red-400 flex items-center gap-1.5">
                                            <FileText className="h-3 w-3" /> Details
                                        </span>
                                        <p className="text-[13px] text-slate-700 leading-relaxed pl-[18px] whitespace-pre-wrap">
                                            {lead.lost_reason_details}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Meta Footer */}
                    <div className="text-[11px] text-slate-400 px-1 pb-2 shrink-0 flex flex-col gap-0.5 mt-auto">
                        <p suppressHydrationWarning>Created: {lead.created_at ? fmtDateTime(lead.created_at) : "—"}</p>
                        <p suppressHydrationWarning>Last Modified: <span suppressHydrationWarning className="font-medium text-slate-500">{lastModified ? fmtDateTime(lastModified) : (lead.updated_at ? fmtDateTime(lead.updated_at) : "—")}</span></p>
                        <p suppressHydrationWarning>By: <span className="font-medium text-slate-500">{lastModifiedBy}</span></p>
                    </div>
                </div>

                {/* ─── RIGHT PANEL (Tabs) ─────────────────────────── */}
                <div
                    className="flex-1 min-w-0 h-full flex flex-col overflow-y-auto custom-scrollbar relative"
                    onScroll={handleScroll}
                >
                    <Tabs defaultValue="scope" className="flex flex-col h-fit pb-12 pr-2">
                        {/* Tab Bar — no box, no gap, fully opaque */}
                        <TabsList className="w-full justify-start rounded-none! bg-white! gap-0! p-0! h-auto! shrink-0 shadow-none! sticky top-0 z-30 border-b border-slate-200">
                            <TabBtn value="scope" icon={BookOpen} label="Scope & Brief" />
                            <TabBtn value="notes" icon={FileText} label="Notes" />
                            <TabBtn value="timeline" icon={Clock} label="Timeline" />
                            <TabBtn value="files" icon={Folder} label="Files" />
                            <TabBtn value="tasks" icon={CheckSquare} label="Tasks" />
                        </TabsList>

                        {/* ── SCOPE & BRIEF ── */}
                        <TabsContent value="scope" className="m-0 pt-6">
                            <div className="flex flex-col gap-5">
                                <ScopeCard
                                    icon={LayoutTemplate}
                                    title="General Brief & Inquiry"
                                    leadId={lead.id}
                                    fieldPath="general_brief"
                                    initialValue={lead.general_brief}
                                    emptyLabel="Add General Brief"
                                    emptyDescription="Click to add the client's initial inquiry and requirements."
                                    placeholder="Click to add the client's initial inquiry, event concept, and key requirements..."
                                />
                                <ScopeCard
                                    icon={ClipboardList}
                                    title="Production SOW & Equipment"
                                    leadId={lead.id}
                                    fieldPath="production_sow"
                                    initialValue={lead.production_sow}
                                    emptyLabel="Add SOW Details"
                                    emptyDescription="Click to document venue setup details and equipment lists."
                                    placeholder="Click to add venue setup details, equipment lists, and technical requirements..."
                                />
                                <ScopeCard
                                    icon={MessageSquareDashed}
                                    title="Special Remarks"
                                    leadId={lead.id}
                                    fieldPath="special_remarks"
                                    initialValue={lead.special_remarks}
                                    emptyLabel="Add Special Remarks"
                                    emptyDescription="Click to add VIP notes, dietary requirements, or custom instructions."
                                    placeholder="Click to add VIP notes, dietary requirements, or custom instructions..."
                                />
                            </div>
                        </TabsContent>

                        {/* ── NOTES ── */}
                        <TabsContent value="notes" className="m-0 pt-6">
                            <NotesTab leadId={lead.id} />
                        </TabsContent>

                        {/* ── TIMELINE ── */}
                        <TabsContent value="timeline" className="m-0 pt-6">
                            <TimelineTab leadId={lead.id} />
                        </TabsContent>

                        {/* ── FILES ── */}
                        <TabsContent value="files" className="m-0 pt-6">
                            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                                <div className="px-5 py-3.5 border-b border-slate-100">
                                    <h3 className="font-semibold text-[13px] text-slate-800 tracking-tight flex items-center gap-2">
                                        <Folder className="w-4 h-4 text-slate-400" /> Files & Documents
                                    </h3>
                                </div>
                                <div className="flex flex-col items-center justify-center py-14 text-center">
                                    <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                                        <Upload className="h-5 w-5 text-slate-300" />
                                    </div>
                                    <p className="text-[13px] text-slate-500 font-medium mb-0.5">No files attached</p>
                                    <p className="text-[12px] text-slate-400 max-w-xs">
                                        Upload proposals, contracts, and supporting documents for this deal.
                                    </p>
                                </div>
                            </div>
                        </TabsContent>

                        {/* ── TASKS ── */}
                        <TabsContent value="tasks" className="m-0 pt-6">
                            <TasksTab leadId={lead.id} />
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            {/* ═══ Edit Side-Sheet ═════════════════════════════════ */}
            <Sheet open={editOpen} onOpenChange={setEditOpen}>
                <SheetContent
                    side="right"
                    className="w-full sm:max-w-2xl p-0 flex flex-col border-l border-border overflow-hidden"
                    onInteractOutside={(e) => e.preventDefault()}
                >
                    <SheetTitle className="sr-only">Edit Lead</SheetTitle>
                    <SheetDescription className="sr-only">Edit the details for this lead.</SheetDescription>
                    <LeadForm
                        initialData={lead}
                        onClose={() => setEditOpen(false)}
                        onSuccess={() => router.refresh()}
                    />
                </SheetContent>
            </Sheet>
        </div>
    )
}


// ═══════════════════════════════════════════════════════════════
//  SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

/** Tab button — fully custom underline, solid bg, zero leak */
function TabBtn({ value, icon: Icon, label }: { value: string; icon: typeof Clock; label: string }) {
    return (
        <TabsTrigger
            value={value}
            className={
                "flex-none! rounded-none! border-none! h-auto! px-4 pb-2.5 pt-2.5 text-[13px]" +
                " text-slate-400 hover:text-slate-600 data-[state=active]:text-blue-600" +
                " shadow-none! ring-0! outline-none!" +
                " bg-white! data-[state=active]:bg-white!" +
                " focus:ring-0! focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:outline-none!" +
                " after:bg-blue-600! after:h-[2.5px]! after:bottom-0! after:rounded-full!" +
                " data-[state=active]:after:opacity-100!"
            }
        >
            <Icon className="h-3.5 w-3.5 mr-1.5 shrink-0" />
            {label}
        </TabsTrigger>
    )
}

/** Key-Value row for info cards */
function KVRow({
    icon: Icon,
    label,
    value,
    highlight,
}: {
    icon: typeof Building2
    label: string
    value: string | null | undefined
    highlight?: boolean
}) {
    return (
        <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] text-slate-400 flex items-center gap-1.5 shrink-0">
                <Icon className="h-3 w-3" /> {label}
            </span>
            {highlight && value ? (
                <span className="text-[12px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                    {value}
                </span>
            ) : (
                <span className={`text-[13px] font-medium text-right truncate ${value && value !== '—' ? 'text-slate-800' : 'text-slate-300'}`}>
                    {value || "—"}
                </span>
            )}
        </div>
    )
}

/** Scope card with filled vs. empty states */
function ScopeCard({
    icon: Icon,
    title,
    leadId,
    fieldPath,
    initialValue,
    emptyLabel,
    emptyDescription,
    placeholder,
}: {
    icon: typeof LayoutTemplate
    title: string
    leadId: number
    fieldPath: string
    initialValue: string | null | undefined
    emptyLabel: string
    emptyDescription: string
    placeholder: string
}) {
    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            {/* Card Header — compact, subtle */}
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
                <Icon className="w-4 h-4 text-slate-400" />
                <h3 className="font-semibold text-[13px] text-slate-800 tracking-tight">{title}</h3>
            </div>

            {/* Content */}
            <div className="px-5 py-4">
                <InlineEditor
                    leadId={leadId}
                    fieldPath={fieldPath}
                    label={title}
                    initialValue={initialValue}
                    placeholder={placeholder}
                    emptyTitle={emptyLabel}
                    emptyDescription={emptyDescription}
                />
            </div>
        </div>
    )
}
