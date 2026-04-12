"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { DataTable } from "@/components/shared/data-table"
import { columns, DEFAULT_HIDDEN_COLUMNS } from "@/features/leads/components/lead-columns"
import { LeadKanban } from "@/features/leads/components/lead-kanban"
import { LeadForm } from "@/features/leads/components/lead-form"
import { ImportLeadsModal } from "@/features/leads/components/import-leads-modal"
import { Lead, Pipeline } from "@/types/index"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Sheet,
    SheetContent,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet"
import { 
    Plus, LayoutGrid, Table, Loader2, GitBranch,
    MoreHorizontal, Trash2, PanelLeftClose, PanelLeft,
    Copy, ListTree, ChevronRight, Pencil, X, Lock, Eye,
    Search, SlidersHorizontal, ChevronDown, ChevronUp,
    Archive, RotateCcw, Settings2, ArchiveRestore, Upload,
    ChevronsLeft, ChevronsRight, TrendingUp,
} from "lucide-react"
import { PipelineFilters, PipelineFilterState, INITIAL_FILTER_STATE } from "@/features/leads/components/pipeline-filters"
import { PipelineIconPicker, PipelineIcon, DEFAULT_PIPELINE_ICON } from "@/features/leads/components/pipeline-icon-picker"
import { useRouter } from "next/navigation"
import { PermissionGate } from "@/features/users/components/permission-gate"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

import { useCompany } from "@/contexts/company-context"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type ViewMode = 'table' | 'kanban'

export function LeadDashboard() {
    const { activeCompany, companies, isHoldingView } = useCompany()
    const supabase = createClient()
    const router = useRouter()

    // Pipeline state
    const [pipelines, setPipelines] = useState<Pipeline[]>([])
    const [activePipeline, setActivePipeline] = useState<Pipeline | null>(null)
    const [pipelinesLoading, setPipelinesLoading] = useState(true)
    const [createOpen, setCreateOpen] = useState(false)
    const [newPipelineName, setNewPipelineName] = useState("")
    const [newPipelineIcon, setNewPipelineIcon] = useState(DEFAULT_PIPELINE_ICON)
    const [creating, setCreating] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<Pipeline | null>(null)
    const [deleteTargetDealCount, setDeleteTargetDealCount] = useState<number>(0)
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)
    const [renameOpen, setRenameOpen] = useState(false)
    const [renameValue, setRenameValue] = useState("")
    const [renameIcon, setRenameIcon] = useState(DEFAULT_PIPELINE_ICON)
    const [cloning, setCloning] = useState(false)
    const [archiving, setArchiving] = useState(false)
    const [newPipelineVisibility, setNewPipelineVisibility] = useState<'all_subs' | 'selected'>('all_subs')
    const [selectedSubIds, setSelectedSubIds] = useState<string[]>([])
    // Visibility Edit state
    const [visibilityEditOpen, setVisibilityEditOpen] = useState(false)
    const [visibilityEditTarget, setVisibilityEditTarget] = useState<Pipeline | null>(null)
    const [editVisibility, setEditVisibility] = useState<'all_subs' | 'selected'>('all_subs')
    const [editSubIds, setEditSubIds] = useState<string[]>([])
    const [savingVisibility, setSavingVisibility] = useState(false)
    // Pipeline access map: pipelineId -> company names for sidebar display
    const [pipelineAccessMap, setPipelineAccessMap] = useState<Record<string, string[]>>({})
    // Archived pipelines
    const [archivedPipelines, setArchivedPipelines] = useState<Pipeline[]>([])
    const [showArchived, setShowArchived] = useState(false)
    const [restoringId, setRestoringId] = useState<string | null>(null)

    // Derive subsidiary list for visibility picker (exclude holding itself)
    const subsidiaryCompanies = companies.filter(c => !c.isHolding)

    // Lead state
    const [leads, setLeads] = useState<Lead[]>([])
    const [leadsLoading, setLeadsLoading] = useState(true)

    // UI state — Sheet-based create & quick-edit
    const [addSheetOpen, setAddSheetOpen] = useState(false)
    const [addSheetDefaultStageId, setAddSheetDefaultStageId] = useState<string | undefined>()
    const [importOpen, setImportOpen] = useState(false)
    const [editLead, setEditLead] = useState<Lead | null>(null)
    const [editOpen, setEditOpen] = useState(false)
    const [viewMode, setViewMode] = useState<ViewMode>('kanban')

    // Selection & deletion state
    const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([])
    const [deleteLeadId, setDeleteLeadId] = useState<number | null>(null)
    const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
    const [bulkDeleteLeads, setBulkDeleteLeads] = useState<Lead[]>([])
    const [deleting, setDeleting] = useState(false)

    // Search and Filter state
    const [searchQuery, setSearchQuery] = useState("")
    const [filters, setFilters] = useState<PipelineFilterState>(INITIAL_FILTER_STATE)

    // ─── Filtered leads (client-side) ────────────────────────────────
    const filteredLeads = useMemo(() => {
        let result = leads

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase()
            result = result.filter(l =>
                (l.project_name || "").toLowerCase().includes(q) ||
                (l.client_company?.name || "").toLowerCase().includes(q) ||
                (l.pic_sales_profile?.full_name || "").toLowerCase().includes(q) ||
                (l.status || "").toLowerCase().includes(q) ||
                (l.main_stream || "").toLowerCase().includes(q) ||
                (l.event_format || "").toLowerCase().includes(q)
            )
        }

        if (filters.pics.length > 0) {
            result = result.filter(l => filters.pics.includes(l.pic_sales_id || "unassigned"))
        }
        if (filters.categories.length > 0) {
            result = result.filter(l => filters.categories.includes(l.category || "Uncategorized"))
        }
        if (filters.streams.length > 0) {
            result = result.filter(l => filters.streams.includes(l.main_stream || "Uncategorized"))
        }
        if (filters.minValue) {
            result = result.filter(l => (l.estimated_value || 0) >= parseInt(filters.minValue))
        }
        if (filters.maxValue) {
            result = result.filter(l => (l.estimated_value || 0) <= parseInt(filters.maxValue))
        }

        return result
    }, [leads, searchQuery, filters])

    const handleToggleSelect = (leadId: string, isChecked: boolean) => {
        if (isChecked) {
            setSelectedLeadIds(prev => [...prev, leadId])
        } else {
            setSelectedLeadIds(prev => prev.filter(id => id !== leadId))
        }
    }

    const handleClearSelection = () => setSelectedLeadIds([])

    // ─── Single Lead Delete ──────────────────────────────────────────
    const handleDeleteSingleLead = async () => {
        if (!deleteLeadId) return
        setDeleting(true)
        const { error } = await supabase.from('leads').delete().eq('id', deleteLeadId)
        if (error) {
            toast.error(`Delete failed: ${error.message}`)
        } else {
            toast.success('Lead deleted')
            fetchLeads()
        }
        setDeleteLeadId(null)
        setDeleting(false)
    }

    // ─── Bulk Lead Delete (from DataTable selection) ─────────────────
    const handleTableBulkDelete = (rows: Lead[]) => {
        setBulkDeleteLeads(rows)
        setBulkDeleteOpen(true)
    }

    const handleBulkDelete = async () => {
        const targets = bulkDeleteLeads.length > 0 ? bulkDeleteLeads : []
        if (targets.length === 0) return
        setDeleting(true)
        const numericIds = targets.map(l => l.id)
        const { error } = await supabase.from('leads').delete().in('id', numericIds)
        if (error) {
            toast.error(`Bulk delete failed: ${error.message}`)
        } else {
            toast.success(`${targets.length} lead(s) deleted`)
            setSelectedLeadIds([])
            fetchLeads()
        }
        setBulkDeleteOpen(false)
        setBulkDeleteLeads([])
        setDeleting(false)
    }

    // ─── Bulk Export (CSV) ───────────────────────────────────────────
    const handleBulkExport = (rows: Lead[]) => {
        if (rows.length === 0) return
        const headers = [
            'No', 'Manual ID', 'Subsidiary', 'Client', 'Project', 'Category',
            'Stream', 'Format', 'Stage', 'Grade', 'PIC Sales', 'Close Date',
            'Estimated Value', 'Status', 'Lead Source',
        ]
        const csvRows = rows.map((lead, i) => [
            i + 1,
            lead.manual_id ?? '',
            lead.company?.name ?? '',
            lead.client_company?.name ?? '',
            lead.project_name ?? '',
            lead.category ?? '',
            lead.main_stream ?? '',
            lead.event_format ?? '',
            lead.status ?? '',
            lead.grade_lead ?? '',
            lead.pic_sales_profile?.full_name ?? '',
            lead.target_close_date ?? '',
            lead.estimated_value ?? '',
            lead.status ?? '',
            lead.lead_source ?? '',
        ])
        const csvContent = [
            headers.join(','),
            ...csvRows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
        ].join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `leads_export_${new Date().toISOString().slice(0, 10)}.csv`
        link.click()
        URL.revokeObjectURL(url)
        toast.success(`Exported ${rows.length} lead(s) to CSV`)
    }

    // ─── Fetch pipelines (visibility matrix) ───────────────────────────
    const holdingCompanyId = companies.find(c => c.isHolding)?.id

    const fetchPipelines = useCallback(async () => {
        setPipelinesLoading(true)

        if (isHoldingView) {
            // Omniscient: Holding sees ALL pipelines across all accessible companies
            let query = supabase.from('pipelines').select('*, company:companies(name, is_holding)').eq('is_active', true).order('created_at', { ascending: true })
            const { data: sessionData } = await supabase.auth.getUser()
            if (sessionData?.user) {
                const { data: memberships } = await supabase
                    .from('company_members')
                    .select('company_id')
                    .eq('user_id', sessionData.user.id)
                if (memberships && memberships.length > 0) {
                    query = query.in('company_id', memberships.map(m => m.company_id))
                }
            }
            const { data } = await query
            const fetched = (data ?? []) as Pipeline[]
            setPipelines(fetched)
            setActivePipeline((prev) => {
                if (prev && fetched.find(p => p.id === prev.id)) return prev
                return fetched[0] ?? null
            })

            // Build access map for holding-owned pipelines with 'selected' visibility
            const selectedPipelines = fetched.filter(p => p.visibility === 'selected')
            if (selectedPipelines.length > 0) {
                const { data: accessRows } = await supabase
                    .from('pipeline_company_access')
                    .select('pipeline_id, company:companies!company_id(name)')
                    .in('pipeline_id', selectedPipelines.map(p => p.id))
                const accessMap: Record<string, string[]> = {}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                for (const row of (accessRows ?? []) as any[]) {
                    const companyName = row.company?.name
                    if (!companyName) continue
                    if (!accessMap[row.pipeline_id]) accessMap[row.pipeline_id] = []
                    accessMap[row.pipeline_id].push(companyName)
                }
                setPipelineAccessMap(accessMap)
            } else {
                setPipelineAccessMap({})
            }
        } else if (activeCompany?.id) {
            // Subsidiary: own pipelines + visible holding pipelines
            // Step 1: Get own pipelines
            const { data: ownData } = await supabase
                .from('pipelines')
                .select('*, company:companies(name, is_holding)')
                .eq('is_active', true)
                .eq('company_id', activeCompany.id)
                .order('created_at', { ascending: true })

            // Step 2: Get holding pipelines visible to this sub
            let holdingPipelines: Pipeline[] = []
            if (holdingCompanyId && holdingCompanyId !== activeCompany.id) {
                // 2a: all_subs holding pipelines
                const { data: allSubsData } = await supabase
                    .from('pipelines')
                    .select('*, company:companies(name, is_holding)')
                    .eq('is_active', true)
                    .eq('company_id', holdingCompanyId)
                    .eq('visibility', 'all_subs')
                    .order('created_at', { ascending: true })

                // 2b: selected holding pipelines — check junction table
                const { data: selectedAccess } = await supabase
                    .from('pipeline_company_access')
                    .select('pipeline_id')
                    .eq('company_id', activeCompany.id)
                const selectedPipelineIds = (selectedAccess ?? []).map(a => a.pipeline_id)

                let selectedData: Pipeline[] = []
                if (selectedPipelineIds.length > 0) {
                    const { data: selRes } = await supabase
                        .from('pipelines')
                        .select('*, company:companies(name, is_holding)')
                        .eq('is_active', true)
                        .eq('company_id', holdingCompanyId)
                        .eq('visibility', 'selected')
                        .in('id', selectedPipelineIds)
                        .order('created_at', { ascending: true })
                    selectedData = (selRes ?? []) as Pipeline[]
                }

                holdingPipelines = [...(allSubsData ?? []) as Pipeline[], ...selectedData]
            }

            const fetched = [...holdingPipelines, ...(ownData ?? []) as Pipeline[]]
            setPipelines(fetched)
            setActivePipeline((prev) => {
                if (prev && fetched.find(p => p.id === prev.id)) return prev
                return fetched[0] ?? null
            })
        }

        setPipelinesLoading(false)
    }, [activeCompany?.id, isHoldingView, holdingCompanyId])

    // ─── Pipeline Lifecycle Handlers ─────────────────────────────────
    const handleArchivePipeline = async (pipeline: Pipeline) => {
        setArchiving(true)
        const { error } = await supabase.from('pipelines').update({ is_active: false }).eq('id', pipeline.id)
        if (error) toast.error(`Archive failed: ${error.message}`)
        else toast.success(`"${pipeline.name}" archived`)
        setArchiving(false)
        fetchPipelines()
        // Refresh archived list if visible
        if (showArchived) fetchArchivedPipelines()
    }

    const fetchArchivedPipelines = async () => {
        let query = supabase
            .from('pipelines')
            .select('*, company:companies(name, is_holding)')
            .eq('is_active', false)
            .order('created_at', { ascending: false })

        if (isHoldingView) {
            const { data: sessionData } = await supabase.auth.getUser()
            if (sessionData?.user) {
                const { data: memberships } = await supabase
                    .from('company_members')
                    .select('company_id')
                    .eq('user_id', sessionData.user.id)
                if (memberships && memberships.length > 0) {
                    query = query.in('company_id', memberships.map(m => m.company_id))
                }
            }
        } else if (activeCompany?.id) {
            query = query.eq('company_id', activeCompany.id)
        }

        const { data } = await query
        setArchivedPipelines((data ?? []) as Pipeline[])
    }

    const handleRestorePipeline = async (pipeline: Pipeline) => {
        setRestoringId(pipeline.id)
        const { error } = await supabase.from('pipelines').update({ is_active: true }).eq('id', pipeline.id)
        if (error) {
            toast.error(`Restore failed: ${error.message}`)
        } else {
            toast.success(`"${pipeline.name}" restored`)
            fetchPipelines()
            fetchArchivedPipelines()
        }
        setRestoringId(null)
    }
    const handleOpenVisibilityEdit = async (pipeline: Pipeline) => {
        setVisibilityEditTarget(pipeline)
        setEditVisibility(pipeline.visibility === 'selected' ? 'selected' : 'all_subs')
        // Load existing access entries
        const { data: accessRows } = await supabase
            .from('pipeline_company_access')
            .select('company_id')
            .eq('pipeline_id', pipeline.id)
        setEditSubIds((accessRows ?? []).map(r => r.company_id))
        setVisibilityEditOpen(true)
    }

    const handleSaveVisibility = async () => {
        if (!visibilityEditTarget) return
        setSavingVisibility(true)

        // Update visibility column
        await supabase.from('pipelines').update({ visibility: editVisibility }).eq('id', visibilityEditTarget.id)

        // Sync junction table: delete all, then re-insert if 'selected'
        await supabase.from('pipeline_company_access').delete().eq('pipeline_id', visibilityEditTarget.id)
        if (editVisibility === 'selected' && editSubIds.length > 0) {
            await supabase.from('pipeline_company_access').insert(
                editSubIds.map(companyId => ({
                    pipeline_id: visibilityEditTarget.id,
                    company_id: companyId,
                }))
            )
        }

        setSavingVisibility(false)
        setVisibilityEditOpen(false)
        setVisibilityEditTarget(null)
        toast.success('Visibility updated')
        fetchPipelines()
    }
    const handleTriggerDelete = async (pipeline: Pipeline) => {
        // Count deals tied to this pipeline's stages
        const { data: stageIds } = await supabase
            .from('pipeline_stages')
            .select('id')
            .eq('pipeline_id', pipeline.id)
        const ids = (stageIds ?? []).map(s => s.id)
        let dealCount = 0
        if (ids.length > 0) {
            const { count } = await supabase
                .from('leads')
                .select('id', { count: 'exact', head: true })
                .in('pipeline_stage_id', ids)
            dealCount = count ?? 0
        }
        setDeleteTargetDealCount(dealCount)
        setDeleteTarget(pipeline)
    }

    const handleDeletePipeline = async () => {
        if (!deleteTarget || deleteTargetDealCount > 0) return
        setDeleting(true)
        // Delete stages first, then pipeline
        await supabase.from('pipeline_stages').delete().eq('pipeline_id', deleteTarget.id)
        const { error } = await supabase.from('pipelines').delete().eq('id', deleteTarget.id)
        if (error) toast.error(`Delete failed: ${error.message}`)
        else toast.success(`"${deleteTarget.name}" deleted`)
        setDeleting(false)
        setDeleteTarget(null)
        fetchPipelines()
    }

    const handleRenamePipeline = async () => {
        if (!activePipeline || !renameValue.trim()) return
        const { error } = await supabase.from('pipelines').update({ name: renameValue.trim(), icon: renameIcon }).eq('id', activePipeline.id)
        if (error) toast.error(error.message)
        else toast.success('Pipeline updated')
        setRenameOpen(false)
        fetchPipelines()
    }

    // ─── Fetch leads for active pipeline ─────────────────────────────
    const fetchLeads = useCallback(async () => {
        if (!activePipeline) { setLeads([]); setLeadsLoading(false); return }
        setLeadsLoading(true)
        const { data, error } = await supabase
            .from('leads')
            .select(`
                *,
                company:companies!company_id(name),
                client_company:client_companies!client_company_id(name),
                contact:contacts!contact_id(salutation, full_name, email, phone),
                pipeline_stage:pipeline_stages!pipeline_stage_id(name, color),
                pic_sales_profile:profiles!pic_sales_id(full_name),
                account_manager_profile:profiles!account_manager_id(full_name)
            `)
            .eq('pipeline_id', activePipeline.id)
            .order('kanban_sort_order', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false })

        if (error) console.error('[Lead Fetch]', error.message)
        setLeads((data ?? []) as Lead[])
        setLeadsLoading(false)
    }, [activePipeline?.id])

    useEffect(() => { fetchPipelines() }, [fetchPipelines])
    useEffect(() => { fetchLeads() }, [fetchLeads])

    // ─── Pipeline CRUD ───────────────────────────────────────────────
    const handleCreatePipeline = async () => {
        if (!newPipelineName.trim() || !activeCompany?.id) return
        setCreating(true)

        // Determine visibility — only relevant when creating from Holding
        const visibility = isHoldingView ? newPipelineVisibility : 'owner_only'

        const { data, error } = await supabase
            .from('pipelines')
            .insert({
                name: newPipelineName.trim(),
                company_id: activeCompany.id,
                visibility,
                icon: newPipelineIcon,
            })
            .select('*')
            .single()
        if (error) { toast.error(error.message); setCreating(false); return }

        // Insert junction rows for 'selected' visibility
        if (visibility === 'selected' && selectedSubIds.length > 0) {
            await supabase.from('pipeline_company_access').insert(
                selectedSubIds.map(companyId => ({
                    pipeline_id: data.id,
                    company_id: companyId,
                }))
            )
        }

        const defaultStages = [
            { name: 'Lead Masuk', color: 'blue', sort_order: 1, is_default: true },
            { name: 'Estimasi Project', color: 'amber', sort_order: 2, is_default: false },
            { name: 'Proposal Sent', color: 'violet', sort_order: 3, is_default: false },
            { name: 'Closed Won', color: 'emerald', sort_order: 4, is_default: false },
            { name: 'Closed Lost', color: 'red', sort_order: 5, is_default: false },
        ]
        await supabase.from('pipeline_stages').insert(
            defaultStages.map(s => ({ ...s, pipeline_id: data.id }))
        )

        const pipeline = data as Pipeline
        setPipelines(prev => [...prev, pipeline])
        setActivePipeline(pipeline)
        setNewPipelineName("")
        setNewPipelineIcon(DEFAULT_PIPELINE_ICON)
        setNewPipelineVisibility('all_subs')
        setSelectedSubIds([])
        setCreateOpen(false)
        setCreating(false)
        toast.success(`Pipeline "${pipeline.name}" created with default stages`)
    }

    const handleClonePipeline = async () => {
        if (!activePipeline || !activeCompany?.id) return
        setCloning(true)
        const { data: newPipeline, error } = await supabase
            .from('pipelines')
            .insert({ name: `${activePipeline.name} (Copy)`, company_id: activeCompany.id, icon: activePipeline.icon || DEFAULT_PIPELINE_ICON })
            .select('*')
            .single()
        if (error || !newPipeline) { toast.error(error?.message || 'Clone failed'); setCloning(false); return }

        const { data: srcStages } = await supabase
            .from('pipeline_stages')
            .select('name, color, sort_order, is_default')
            .eq('pipeline_id', activePipeline.id)
            .order('sort_order')
        if (srcStages && srcStages.length > 0) {
            await supabase.from('pipeline_stages').insert(
                srcStages.map(s => ({ ...s, pipeline_id: newPipeline.id }))
            )
        }

        const cloned = newPipeline as Pipeline
        setPipelines(prev => [...prev, cloned])
        setActivePipeline(cloned)
        setCloning(false)
        toast.success(`Cloned as "${cloned.name}"`)
    }

    // ─── Lead Click Handlers ─────────────────────────────────────────
    const handleNavigateToLead = (lead: Lead) => {
        router.push(`/leads/${lead.id}`)
    }

    const handleQuickEdit = (lead: Lead) => {
        setEditLead(lead)
        setEditOpen(true)
    }

    const handleAddSuccess = () => {
        setAddSheetOpen(false)
        fetchLeads()
    }

    // ─── Drag-and-Drop Stage Change → Master State Sync ──────────────
    const handleLeadStageChange = useCallback(
        (leadId: number, stageId: string, stageName: string, stageColor: string, updates?: Record<string, any>) => {
            setLeads((prev) =>
                prev.map((l) =>
                    l.id === leadId
                        ? {
                              ...l,
                              ...updates,
                              pipeline_stage_id: stageId,
                              status: stageName,
                              pipeline_stage: { name: stageName, color: stageColor },
                          }
                        : l
                )
            )
        },
        []
    )

    return (
        <div className="flex h-[calc(100vh-3.5rem)] lg:h-screen overflow-hidden bg-muted/20">
            {/* ═══════════════════════════════════════════════════════════
                LEFT: Collapsible Pipeline Sidebar (Bigin-style)
            ═══════════════════════════════════════════════════════════ */}
            <div
                className={`flex flex-col border-r border-border bg-background transition-all duration-300 ease-in-out shrink-0 flex-none relative ${
                    isSidebarOpen ? 'w-[200px]' : 'w-[44px]'
                }`}
            >
                {/* ── Collapsed State: Vertical strip ── */}
                {!isSidebarOpen && (
                    <div className="flex flex-col items-center h-full w-full">
                        {/* Vertical pipeline name (bottom-to-top, like Bigin) */}
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="flex-1 flex flex-col items-center justify-center gap-4 w-full hover:bg-muted/50 transition-colors cursor-pointer group"
                            title={`Expand sidebar · ${activePipeline?.name || 'Pipelines'}`}
                        >
                            <span
                                className="text-[13px] font-bold text-slate-700 group-hover:text-slate-900 tracking-wider transition-colors whitespace-nowrap inline-block"
                                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                            >
                                {activePipeline?.name || 'Pipelines'}
                            </span>
                            <PipelineIcon icon={activePipeline?.icon} className="h-4 w-4 text-slate-500 group-hover:text-slate-700 shrink-0 -rotate-90" />
                        </button>
                        {/* Expand chevron at bottom */}
                        <div className="border-t border-border w-full shrink-0">
                            <button
                                onClick={() => setIsSidebarOpen(true)}
                                className="w-full flex items-center justify-center py-2.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                                title="Expand sidebar"
                            >
                                <ChevronsRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Expanded State: Full sidebar ── */}
                {isSidebarOpen && (
                    <>
                {/* Sidebar Header */}
                <div className="p-3 border-b border-border flex items-center justify-between whitespace-nowrap h-14 shrink-0">
                    <div className="flex items-center gap-1.5">
                        <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                        <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                            Team Pipelines
                        </h3>
                    </div>
                    <PermissionGate resource="leads" action="create">
                        <Button
                            variant="ghost" size="sm"
                            className="h-6 w-6 p-0 hover:bg-muted"
                            onClick={() => setCreateOpen(true)}
                            title="Create new pipeline"
                        >
                            <Plus className="h-3.5 w-3.5" />
                        </Button>
                    </PermissionGate>
                </div>

                {/* Pipeline List */}
                <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
                    {pipelinesLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                    ) : pipelines.length === 0 ? (
                        <div className="text-center py-8 text-xs text-muted-foreground px-3">
                            No pipelines found. Create one to get started.
                        </div>
                    ) : (
                        pipelines.map(pipeline => {
                            const isActive = activePipeline?.id === pipeline.id
                            const isInherited = !isHoldingView && activeCompany?.id !== pipeline.company_id
                            return (
                                <div key={pipeline.id} className="group relative">
                                    <button
                                        onClick={() => setActivePipeline(pipeline)}
                                        className={`w-full flex flex-col gap-0.5 rounded-md px-3 py-2.5 text-left transition-all ${isActive
                                                ? 'bg-primary text-primary-foreground shadow-sm'
                                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <PipelineIcon icon={pipeline.icon} className="h-3.5 w-3.5 shrink-0 opacity-80" />
                                            <span className="truncate text-sm font-medium">{pipeline.name}</span>
                                            {isInherited && (
                                                <Lock className={`h-2.5 w-2.5 shrink-0 ${isActive ? 'text-primary-foreground/50' : 'text-muted-foreground/50'}`} />
                                            )}
                                        </div>
                                        {(isHoldingView || isInherited) && pipeline.company?.name && (
                                            <span className={`text-[10px] font-medium ml-5.5 px-1.5 py-0.5 rounded-sm w-fit truncate ${
                                                isActive
                                                    ? 'bg-primary-foreground/20 text-primary-foreground/80'
                                                    : 'bg-secondary text-muted-foreground'
                                            }`}>
                                                {pipeline.company.name}{isInherited ? ' · Inherited' : ''}
                                            </span>
                                        )}
                                        {/* Visibility indicator for holding-owned pipelines */}
                                        {isHoldingView && pipeline.company_id === holdingCompanyId && (
                                            <span className={`text-[9px] ml-5.5 truncate ${
                                                isActive ? 'text-primary-foreground/60' : 'text-muted-foreground/60'
                                            }`}>
                                                {pipeline.visibility === 'all_subs'
                                                    ? '🌐 All Subs'
                                                    : pipeline.visibility === 'selected' && pipelineAccessMap[pipeline.id]
                                                        ? `📌 ${pipelineAccessMap[pipeline.id].map(n => n.split(' ').map(w => w[0]).join('')).join(' · ')}`
                                                        : pipeline.visibility === 'owner_only'
                                                            ? '🔒 Holding Only'
                                                            : ''
                                                }
                                            </span>
                                        )}
                                    </button>
                                    {/* Context Menu */}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button className={`absolute top-2 right-1.5 h-6 w-6 rounded-md flex items-center justify-center transition-opacity ${
                                                isActive
                                                    ? 'opacity-70 hover:opacity-100 text-primary-foreground'
                                                    : 'opacity-0 group-hover:opacity-70 hover:!opacity-100 text-muted-foreground hover:bg-muted'
                                            }`}>
                                                <MoreHorizontal className="h-3.5 w-3.5" />
                                            </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-48">
                                            <DropdownMenuItem disabled={isInherited} onClick={() => { if (!isInherited) { setRenameValue(pipeline.name); setRenameIcon(pipeline.icon || DEFAULT_PIPELINE_ICON); setActivePipeline(pipeline); setRenameOpen(true) } }}>
                                                <Pencil className="h-3.5 w-3.5 mr-2" /> Rename Pipeline
                                                {isInherited && <Lock className="h-3 w-3 ml-auto text-muted-foreground/50" />}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem disabled={isInherited} onClick={() => { if (!isInherited) router.push(`/settings/pipeline?id=${pipeline.id}`) }}>
                                                <Settings2 className="h-3.5 w-3.5 mr-2" /> Manage Stages
                                                {isInherited && <Lock className="h-3 w-3 ml-auto text-muted-foreground/50" />}
                                            </DropdownMenuItem>
                                            {/* Edit Visibility — only for holding-owned pipelines in holding view */}
                                            {isHoldingView && pipeline.company_id === holdingCompanyId && (
                                                <DropdownMenuItem onClick={() => handleOpenVisibilityEdit(pipeline)}>
                                                    <Eye className="h-3.5 w-3.5 mr-2" /> Edit Visibility
                                                </DropdownMenuItem>
                                            )}
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={() => handleArchivePipeline(pipeline)} disabled={archiving || isInherited}>
                                                <Archive className="h-3.5 w-3.5 mr-2" /> Archive Pipeline
                                                {isInherited && <Lock className="h-3 w-3 ml-auto text-muted-foreground/50" />}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="text-destructive focus:text-destructive" disabled={isInherited} onClick={() => { if (!isInherited) handleTriggerDelete(pipeline) }}>
                                                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Pipeline
                                                {isInherited && <Lock className="h-3 w-3 ml-auto text-muted-foreground/50" />}
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            )
                        })
                    )}
                </div>

                {/* Archived Pipelines Section */}
                <div className="border-t border-border shrink-0">
                    <button
                        onClick={() => {
                            const next = !showArchived
                            setShowArchived(next)
                            if (next) fetchArchivedPipelines()
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-[11px] font-medium text-muted-foreground hover:bg-muted transition-colors"
                    >
                        <Archive className="h-3 w-3" />
                        Archived
                        {archivedPipelines.length > 0 && showArchived && (
                            <span className="text-[10px] bg-muted-foreground/20 px-1.5 py-0.5 rounded-full">{archivedPipelines.length}</span>
                        )}
                        <ChevronRight className={`h-3 w-3 ml-auto transition-transform ${showArchived ? 'rotate-90' : ''}`} />
                    </button>
                    {showArchived && (
                        <div className="px-1.5 pb-2 space-y-0.5 max-h-[180px] overflow-y-auto">
                            {archivedPipelines.length === 0 ? (
                                <p className="text-[11px] text-muted-foreground/50 text-center py-3">No archived pipelines</p>
                            ) : archivedPipelines.map(ap => (
                                <div key={ap.id} className="group relative flex items-center gap-2 rounded-md px-3 py-2 text-muted-foreground/60 hover:bg-muted transition-colors">
                                    <Archive className="h-3 w-3 shrink-0 opacity-50" />
                                    <div className="flex-1 min-w-0">
                                        <span className="text-[12px] line-through truncate block">{ap.name}</span>
                                        {ap.company?.name && (
                                            <span className="text-[9px] text-muted-foreground/40 truncate block">{ap.company.name}</span>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleRestorePipeline(ap)}
                                        disabled={restoringId === ap.id}
                                        className="opacity-0 group-hover:opacity-100 h-5 w-5 flex items-center justify-center rounded hover:bg-emerald-100 text-emerald-600 transition-all shrink-0"
                                        title="Restore pipeline"
                                    >
                                        {restoringId === ap.id
                                            ? <Loader2 className="h-3 w-3 animate-spin" />
                                            : <ArchiveRestore className="h-3 w-3" />
                                        }
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Collapse chevron at bottom */}
                <div className="border-t border-border shrink-0">
                    <button
                        onClick={() => setIsSidebarOpen(false)}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors text-[11px] font-medium"
                        title="Collapse sidebar"
                    >
                        <ChevronsLeft className="h-3.5 w-3.5" />
                        <span>Collapse</span>
                    </button>
                </div>
                    </>
                )}
            </div>

            {/* ═══════════════════════════════════════════════════════════
                RIGHT: Main Kanban Board Area
            ═══════════════════════════════════════════════════════════ */}
            <div className="flex-1 flex flex-col overflow-hidden bg-muted/20 relative">

                {/* ─── Bulk Action Bar (overlays header when active) ─── */}
                {selectedLeadIds.length > 0 && (
                    <div className="absolute top-0 left-0 right-0 h-14 bg-blue-50 border-b border-blue-200 z-20 flex items-center justify-between px-5 shadow-sm">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={handleClearSelection}
                                className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-500 hover:text-slate-700 hover:bg-blue-100 transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                            <span className="font-semibold text-sm text-blue-900">
                                {selectedLeadIds.length} selected
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="destructive"
                                size="sm"
                                className="h-8"
                                onClick={() => setBulkDeleteOpen(true)}
                            >
                                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
                            </Button>
                        </div>
                    </div>
                )}

                {/* ─── Strategic Header Bar ─────────────────────────── */}
                <div className="px-6 border-b border-border bg-background shrink-0">
                    {/* Row 1: Pipeline Info + Utilities */}
                    <div className="flex flex-wrap items-center justify-between min-h-[56px] py-1.5 gap-x-4 gap-y-2 w-full">
                        <div className="flex items-center gap-2 min-w-0 flex-1">

                            <div className="min-w-0 flex-1">
                                <h2 className="text-lg font-bold tracking-tight leading-tight truncate">
                                    {activePipeline?.name || "Select a Pipeline"}
                                </h2>
                                <div className="flex items-center gap-2 overflow-hidden w-full">
                                    <p className="text-[11px] text-muted-foreground leading-none whitespace-nowrap shrink-0">
                                        {leadsLoading ? "Loading..." : `${filteredLeads.length} lead${filteredLeads.length !== 1 ? 's' : ''}${searchQuery ? ` (filtered)` : ''}`}
                                    </p>
                                    {isHoldingView && activePipeline?.company?.name && (
                                        <span className="text-[10px] font-medium text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-sm truncate">
                                            {activePipeline.company.name}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 ml-auto pb-1 sm:pb-0 overflow-x-auto hide-scrollbar max-w-full">
                            {/* Search Bar */}
                            <div className="relative shrink-0">
                                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                                <Input
                                    placeholder="Search deals..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-8 h-8 w-[160px] sm:w-[200px] lg:w-[240px] text-sm bg-muted/40 border-border focus-visible:bg-background transition-colors"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery("")}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                )}
                            </div>

                            {/* Pipeline Action Menu */}
                            {activePipeline && !isHoldingView && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48">
                                        <DropdownMenuItem onClick={() => {
                                            setRenameValue(activePipeline.name)
                                            setRenameIcon(activePipeline.icon || DEFAULT_PIPELINE_ICON)
                                            setRenameOpen(true)
                                        }}>
                                            <Pencil className="w-3.5 h-3.5 mr-2" /> Rename Pipeline
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => router.push(`/settings/pipeline?id=${activePipeline.id}`)}>
                                            <ListTree className="w-3.5 h-3.5 mr-2" /> Manage Stages
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={handleClonePipeline} disabled={cloning}>
                                            <Copy className="w-3.5 h-3.5 mr-2" /> Clone Pipeline
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                            onClick={() => setDeleteTarget(activePipeline)}
                                            disabled={pipelines.length <= 1}
                                        >
                                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Pipeline
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}

                            {/* View Toggle and Filters */}
                            <div className="flex items-center gap-2 shrink-0">
                                {/* Advanced Pipeline Filters */}
                                <PipelineFilters leads={leads} filters={filters} setFilters={setFilters} />

                                {/* Portal target for Kanban Card Settings */}
                                {viewMode === 'kanban' && <div id="kanban-settings-portal" className="flex items-center shrink-0" />}

                                <div className="flex items-center border rounded-lg p-0.5 bg-muted/50 shrink-0">
                                    <button
                                        onClick={() => setViewMode('kanban')}
                                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${viewMode === 'kanban'
                                            ? 'bg-background shadow-sm text-foreground'
                                            : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                    >
                                        <LayoutGrid className="h-3.5 w-3.5" /> Kanban
                                    </button>
                                    <button
                                        onClick={() => setViewMode('table')}
                                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${viewMode === 'table'
                                            ? 'bg-background shadow-sm text-foreground'
                                            : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                    >
                                        <Table className="h-3.5 w-3.5" /> Table
                                    </button>
                                </div>
                            </div>

                            {/* Add Lead / Import */}
                            <PermissionGate resource="leads" action="create">
                                <div className="flex items-center">
                                    <Button
                                        size="sm"
                                        disabled={!activePipeline}
                                        className="h-8 rounded-r-none"
                                        onClick={() => setAddSheetOpen(true)}
                                    >
                                        <Plus className="mr-1.5 h-3.5 w-3.5" /> New Lead
                                    </Button>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                size="sm"
                                                disabled={!activePipeline}
                                                className="h-8 rounded-l-none border-l border-primary-foreground/20 px-1.5"
                                            >
                                                <ChevronDown className="h-3.5 w-3.5" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-48">
                                            <DropdownMenuItem onClick={() => {
                                                setAddSheetDefaultStageId(undefined)
                                                setAddSheetOpen(true)
                                            }}>
                                                <Plus className="mr-2 h-4 w-4" />
                                                Add Lead
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={() => setImportOpen(true)}>
                                                <Upload className="mr-2 h-4 w-4" />
                                                Import Leads
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </PermissionGate>
                        </div>
                    </div>
                </div>

                {/* ─── Board / Table Content ───────────────────────────── */}
                <div className={`flex-1 overflow-x-auto overflow-y-hidden ${
                    viewMode === 'kanban' ? 'pt-6 px-6 pb-4' : 'pt-1 pb-0 px-6'
                }`}>
                    {!activePipeline ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                            Select or create a pipeline to begin
                        </div>
                    ) : leadsLoading ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading leads...
                        </div>
                    ) : viewMode === 'kanban' ? (
                        <LeadKanban
                            leads={filteredLeads}
                            onSelectLead={handleNavigateToLead}
                            onQuickEdit={handleQuickEdit}
                            onDeleteLead={(id) => setDeleteLeadId(id)}
                            pipelineId={activePipeline.id}
                            selectedIds={selectedLeadIds}
                            onToggleSelect={handleToggleSelect}
                            onLeadStageChange={handleLeadStageChange}
                            onAddLead={(stageId) => {
                                setAddSheetDefaultStageId(stageId)
                                setAddSheetOpen(true)
                            }}
                        />
                    ) : (
                        <div className="h-full flex flex-col pb-6">
                            <DataTable
                                columns={columns}
                                data={filteredLeads}
                                onRowClick={handleNavigateToLead}
                                defaultHiddenColumns={DEFAULT_HIDDEN_COLUMNS}
                                enableRowSelection
                                getRowId={(row) => String((row as Lead).id)}
                                bulkActions={{
                                    onBulkDelete: handleTableBulkDelete,
                                    onBulkExport: handleBulkExport,
                                }}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════
                SHEETS & MODALS
            ═══════════════════════════════════════════════════════════ */}

            {/* Add Lead — Right Side-Sheet */}
            <Sheet open={addSheetOpen} onOpenChange={(open) => {
                setAddSheetOpen(open)
                if (!open) {
                    // Small delay to allow sheet close animation to finish before clearing state
                    setTimeout(() => setAddSheetDefaultStageId(undefined), 300)
                }
            }}>
                <SheetContent
                    side="right"
                    className="w-full sm:max-w-2xl p-0 flex flex-col border-l border-border overflow-hidden"
                    onInteractOutside={(e) => e.preventDefault()}
                >
                    <SheetTitle className="sr-only">Add New Lead</SheetTitle>
                    <SheetDescription className="sr-only">Form to create a new lead in this pipeline.</SheetDescription>
                    <LeadForm
                        onSuccess={handleAddSuccess}
                        onClose={() => setAddSheetOpen(false)}
                        pipelineId={activePipeline?.id}
                        defaultStageId={addSheetDefaultStageId}
                    />
                </SheetContent>
            </Sheet>

            {/* Quick-Edit Lead — Right Side-Sheet (reusing unified LeadForm) */}
            <Sheet open={editOpen} onOpenChange={(open) => {
                setEditOpen(open)
                if (!open) {
                    setEditLead(null)
                    fetchLeads()
                }
            }}>
                <SheetContent
                    side="right"
                    className="w-full sm:max-w-2xl p-0 flex flex-col border-l border-border overflow-hidden"
                    onInteractOutside={(e) => e.preventDefault()}
                >
                    <SheetTitle className="sr-only">Edit Lead</SheetTitle>
                    <SheetDescription className="sr-only">Edit details for the selected lead.</SheetDescription>
                    <LeadForm
                        initialData={editLead}
                        onSuccess={() => fetchLeads()}
                        onClose={() => {
                            setEditOpen(false)
                            setEditLead(null)
                        }}
                    />
                </SheetContent>
            </Sheet>

            {/* Import Leads Modal */}
            <ImportLeadsModal
                open={importOpen}
                onOpenChange={setImportOpen}
                pipelineId={activePipeline?.id}
                onSuccess={() => fetchLeads()}
            />

            {/* Create Pipeline Dialog */}
            <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) { setNewPipelineVisibility('all_subs'); setSelectedSubIds([]); setNewPipelineIcon(DEFAULT_PIPELINE_ICON) } }}>
                <DialogContent className="sm:max-w-md">
                    <div className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>Create Pipeline</DialogTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                                A new pipeline with default stages will be created{isHoldingView ? ' under Holding' : ''}.
                            </p>
                        </DialogHeader>
                        <div>
                            <label className="text-sm font-medium mb-1.5 block">Pipeline Name</label>
                            <div className="flex items-center gap-2">
                                <PipelineIconPicker value={newPipelineIcon} onChange={setNewPipelineIcon} />
                                <Input
                                    className="flex-1"
                                    value={newPipelineName}
                                    onChange={(e) => setNewPipelineName(e.target.value)}
                                    placeholder="e.g. Enterprise Sales"
                                    onKeyDown={(e) => e.key === 'Enter' && handleCreatePipeline()}
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Visibility Selector — only for Holding View */}
                        {isHoldingView && (
                            <div className="space-y-3">
                                <Label className="text-sm font-medium">Subsidiary Visibility</Label>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2.5 cursor-pointer group">
                                        <input
                                            type="radio"
                                            name="visibility"
                                            checked={newPipelineVisibility === 'all_subs'}
                                            onChange={() => setNewPipelineVisibility('all_subs')}
                                            className="accent-primary"
                                        />
                                        <div>
                                            <span className="text-sm font-medium">All Subsidiaries</span>
                                            <p className="text-xs text-muted-foreground">Every subsidiary can see and use this pipeline</p>
                                        </div>
                                    </label>
                                    <label className="flex items-center gap-2.5 cursor-pointer group">
                                        <input
                                            type="radio"
                                            name="visibility"
                                            checked={newPipelineVisibility === 'selected'}
                                            onChange={() => setNewPipelineVisibility('selected')}
                                            className="accent-primary"
                                        />
                                        <div>
                                            <span className="text-sm font-medium">Selected Subsidiaries</span>
                                            <p className="text-xs text-muted-foreground">Only chosen subsidiaries can access</p>
                                        </div>
                                    </label>
                                </div>

                                {/* Subsidiary Checkboxes */}
                                {newPipelineVisibility === 'selected' && (
                                    <div className="border border-border rounded-lg p-3 space-y-2 bg-muted/30 max-h-[180px] overflow-y-auto">
                                        {subsidiaryCompanies.length === 0 ? (
                                            <p className="text-xs text-muted-foreground text-center py-2">No subsidiaries found</p>
                                        ) : subsidiaryCompanies.map(sub => (
                                            <label key={sub.id} className="flex items-center gap-2.5 cursor-pointer hover:bg-muted/50 rounded-md px-2 py-1.5 transition-colors">
                                                <Checkbox
                                                    checked={selectedSubIds.includes(sub.id)}
                                                    onCheckedChange={(checked) => {
                                                        setSelectedSubIds(prev =>
                                                            checked
                                                                ? [...prev, sub.id]
                                                                : prev.filter(id => id !== sub.id)
                                                        )
                                                    }}
                                                />
                                                <div className="flex items-center gap-2">
                                                    <div className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center">
                                                        <span className="text-[9px] font-bold text-primary">{sub.name.charAt(0)}</span>
                                                    </div>
                                                    <span className="text-sm">{sub.name}</span>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                disabled={!newPipelineName.trim() || creating || (isHoldingView && newPipelineVisibility === 'selected' && selectedSubIds.length === 0)}
                                onClick={handleCreatePipeline}
                            >
                                {creating && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                                Create Pipeline
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Rename Pipeline Dialog */}
            <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
                <DialogContent className="sm:max-w-md">
                    <div className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>Edit Pipeline</DialogTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                                Update the name or icon for &ldquo;{activePipeline?.name}&rdquo;
                            </p>
                        </DialogHeader>
                        <div>
                            <label className="text-sm font-medium mb-1.5 block">Pipeline Name & Icon</label>
                            <div className="flex items-center gap-2">
                                <PipelineIconPicker value={renameIcon} onChange={setRenameIcon} />
                                <input
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    placeholder="Pipeline name"
                                    className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    onKeyDown={(e) => e.key === 'Enter' && handleRenamePipeline()}
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => setRenameOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                disabled={!renameValue.trim()}
                                onClick={handleRenamePipeline}
                            >
                                Save
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Visibility Dialog */}
            <Dialog open={visibilityEditOpen} onOpenChange={(open) => { setVisibilityEditOpen(open); if (!open) setVisibilityEditTarget(null) }}>
                <DialogContent className="sm:max-w-md">
                    <div className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>Edit Visibility</DialogTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                                Configure which subsidiaries can access &ldquo;{visibilityEditTarget?.name}&rdquo;
                            </p>
                        </DialogHeader>

                        <div className="space-y-3">
                            <Label className="text-sm font-medium">Subsidiary Visibility</Label>
                            <div className="space-y-2">
                                <label className="flex items-center gap-2.5 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="editVisibility"
                                        checked={editVisibility === 'all_subs'}
                                        onChange={() => setEditVisibility('all_subs')}
                                        className="accent-primary"
                                    />
                                    <div>
                                        <span className="text-sm font-medium">All Subsidiaries</span>
                                        <p className="text-xs text-muted-foreground">Every subsidiary can see and use this pipeline</p>
                                    </div>
                                </label>
                                <label className="flex items-center gap-2.5 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="editVisibility"
                                        checked={editVisibility === 'selected'}
                                        onChange={() => setEditVisibility('selected')}
                                        className="accent-primary"
                                    />
                                    <div>
                                        <span className="text-sm font-medium">Selected Subsidiaries</span>
                                        <p className="text-xs text-muted-foreground">Only chosen subsidiaries can access</p>
                                    </div>
                                </label>
                            </div>

                            {editVisibility === 'selected' && (
                                <div className="border border-border rounded-lg p-3 space-y-2 bg-muted/30 max-h-[180px] overflow-y-auto">
                                    {subsidiaryCompanies.length === 0 ? (
                                        <p className="text-xs text-muted-foreground text-center py-2">No subsidiaries found</p>
                                    ) : subsidiaryCompanies.map(sub => (
                                        <label key={sub.id} className="flex items-center gap-2.5 cursor-pointer hover:bg-muted/50 rounded-md px-2 py-1.5 transition-colors">
                                            <Checkbox
                                                checked={editSubIds.includes(sub.id)}
                                                onCheckedChange={(checked) => {
                                                    setEditSubIds(prev =>
                                                        checked
                                                            ? [...prev, sub.id]
                                                            : prev.filter(id => id !== sub.id)
                                                    )
                                                }}
                                            />
                                            <div className="flex items-center gap-2">
                                                <div className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center">
                                                    <span className="text-[9px] font-bold text-primary">{sub.name.charAt(0)}</span>
                                                </div>
                                                <span className="text-sm">{sub.name}</span>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => setVisibilityEditOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                disabled={savingVisibility || (editVisibility === 'selected' && editSubIds.length === 0)}
                                onClick={handleSaveVisibility}
                            >
                                {savingVisibility && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                                Save Changes
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Pipeline Confirm — Relational Safety */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete &ldquo;{deleteTarget?.name}&rdquo;?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {deleteTargetDealCount > 0 ? (
                                <span className="text-destructive font-medium">
                                    Cannot delete — this pipeline contains {deleteTargetDealCount} active or historical deal{deleteTargetDealCount !== 1 ? 's' : ''}.
                                    Archive it instead to remove it from daily view while preserving revenue history.
                                </span>
                            ) : (
                                "This will permanently delete this pipeline and its empty stages. This action cannot be undone."
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        {deleteTargetDealCount > 0 ? (
                            <Button
                                onClick={() => { if (deleteTarget) handleArchivePipeline(deleteTarget); setDeleteTarget(null) }}
                                className="gap-1.5"
                            >
                                <Archive className="h-3.5 w-3.5" /> Archive Instead
                            </Button>
                        ) : (
                            <AlertDialogAction
                                onClick={handleDeletePipeline}
                                disabled={deleting}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                {deleting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                                Delete Pipeline
                            </AlertDialogAction>
                        )}
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>



            {/* Delete Single Lead Confirm */}
            <AlertDialog open={!!deleteLeadId} onOpenChange={(open) => !open && setDeleteLeadId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the lead and all associated data. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteSingleLead}
                            disabled={deleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                            Delete Lead
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Bulk Delete Confirm */}
            <AlertDialog open={bulkDeleteOpen} onOpenChange={(open) => { if (!open) { setBulkDeleteOpen(false); setBulkDeleteLeads([]) } }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete {bulkDeleteLeads.length} lead{bulkDeleteLeads.length !== 1 ? 's' : ''}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete all selected leads and their associated data. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleBulkDelete}
                            disabled={deleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                            Delete {bulkDeleteLeads.length} Lead{bulkDeleteLeads.length !== 1 ? 's' : ''}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
