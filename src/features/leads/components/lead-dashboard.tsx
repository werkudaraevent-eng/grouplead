"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { DataTable } from "@/components/shared/data-table"
import { getColumns, DEFAULT_HIDDEN_COLUMNS } from "@/features/leads/components/lead-columns"
import { useCurrency } from "@/contexts/currency-context"
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
    ChevronsLeft, ChevronsRight, TrendingUp, ArrowUpDown,
    Check, Clock, CalendarClock, DollarSign, GripVertical,
} from "lucide-react"
import { PipelineFilters, PipelineFilterState, INITIAL_FILTER_STATE, ActiveFilterPills, applyFilters } from "@/features/leads/components/pipeline-filters"
import { PipelineIconPicker, PipelineIcon, DEFAULT_PIPELINE_ICON } from "@/features/leads/components/pipeline-icon-picker"
import { useResizablePanel } from "@/hooks/use-resizable-panel"
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
    const { fmt } = useCurrency()
    const supabase = createClient()
    const router = useRouter()

    // Columns with currency formatting from context
    const columns = useMemo(() => getColumns(fmt), [fmt])

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
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const { width: pipelineWidth, isResizing: isPipelineResizing, handleMouseDown: handlePipelineResize } = useResizablePanel({
        storageKey: "pipeline-sidebar-width",
        defaultWidth: 180,
        minWidth: 140,
        maxWidth: 280,
    })
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

    // ─── Kanban sort preference (persisted per user) ────────────────
    type KanbanSort = 'manual' | 'newest' | 'oldest' | 'close_date' | 'value_desc' | 'updated'
    const [kanbanSort, setKanbanSort] = useState<KanbanSort>('newest')

    // Load sort preference from profile.ui_preferences on mount
    useEffect(() => {
        const loadSortPref = async () => {
            const { data: authData } = await supabase.auth.getUser()
            if (!authData?.user) return
            const { data: profile } = await supabase.from('profiles').select('ui_preferences').eq('id', authData.user.id).single()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const uiPrefs = profile?.ui_preferences as any
            if (uiPrefs?.kanban_sort && typeof uiPrefs.kanban_sort === 'string') {
                setKanbanSort(uiPrefs.kanban_sort as KanbanSort)
            }
        }
        loadSortPref()
    }, [supabase])

    const handleSortChange = async (next: KanbanSort) => {
        setKanbanSort(next)
        const { data: authData } = await supabase.auth.getUser()
        if (!authData?.user) return
        const { data: profile } = await supabase.from('profiles').select('ui_preferences').eq('id', authData.user.id).single()
        const current = typeof profile?.ui_preferences === 'object' && profile?.ui_preferences ? profile.ui_preferences : {}
        await supabase.from('profiles').update({
            ui_preferences: { ...current, kanban_sort: next }
        }).eq('id', authData.user.id)
    }

    // ─── Filtered leads (client-side) ────────────────────────────────
    const filteredLeads = useMemo(() => {
        let result = leads

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase()
            result = result.filter(l =>
                (l.project_name || "").toLowerCase().includes(q) ||
                (l.client_company?.name || "").toLowerCase().includes(q) ||
                (l.pic_sales_profile?.full_name || "").toLowerCase().includes(q) ||
                (l.account_manager_profile?.full_name || "").toLowerCase().includes(q) ||
                (l.contact?.full_name || "").toLowerCase().includes(q) ||
                (l.status || "").toLowerCase().includes(q) ||
                (l.main_stream || "").toLowerCase().includes(q) ||
                (l.stream_type || "").toLowerCase().includes(q) ||
                (l.event_format || "").toLowerCase().includes(q) ||
                (l.lead_source || "").toLowerCase().includes(q) ||
                (l.referral_source || "").toLowerCase().includes(q) ||
                (l.business_purpose || "").toLowerCase().includes(q) ||
                (l.grade_lead || "").toLowerCase().includes(q)
            )
        }

        // Apply dynamic filter rules
        result = applyFilters(result, filters)

        // Apply sort order
        const sorted = [...result]
        switch (kanbanSort) {
            case 'newest':
                sorted.sort((a, b) => {
                    const ta = a.created_at ? new Date(a.created_at).getTime() : 0
                    const tb = b.created_at ? new Date(b.created_at).getTime() : 0
                    return tb - ta
                })
                break
            case 'oldest':
                sorted.sort((a, b) => {
                    const ta = a.created_at ? new Date(a.created_at).getTime() : 0
                    const tb = b.created_at ? new Date(b.created_at).getTime() : 0
                    return ta - tb
                })
                break
            case 'close_date':
                sorted.sort((a, b) => {
                    const da = a.target_close_date ? new Date(a.target_close_date).getTime() : Number.POSITIVE_INFINITY
                    const db = b.target_close_date ? new Date(b.target_close_date).getTime() : Number.POSITIVE_INFINITY
                    return da - db
                })
                break
            case 'value_desc':
                sorted.sort((a, b) => (b.estimated_value ?? 0) - (a.estimated_value ?? 0))
                break
            case 'updated':
                sorted.sort((a, b) => {
                    const ta = a.updated_at ? new Date(a.updated_at).getTime() : 0
                    const tb = b.updated_at ? new Date(b.updated_at).getTime() : 0
                    return tb - ta
                })
                break
            case 'manual':
            default:
                // Keep existing order from fetch (kanban_sort_order DESC, created_at DESC)
                break
        }

        return sorted
    }, [leads, searchQuery, filters, kanbanSort])

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
            'No', 'Manual ID', 'Subsidiary', 'Client', 'Contact Person', 'Project', 'Category',
            'Stream', 'Stream Type', 'Format', 'Stage', 'Grade', 'PIC Sales', 'Account Manager',
            'Lead Source', 'Referral Source', 'Business Purpose', 'Target Close Date',
            'Event Dates', 'Pax Count', 'Destinations', 'Estimated Value', 'Actual Value',
        ]
        const csvRows = rows.map((lead, i) => [
            i + 1,
            lead.manual_id ?? '',
            lead.company?.name ?? '',
            lead.client_company?.name ?? '',
            lead.contact?.full_name ?? '',
            lead.project_name ?? '',
            lead.category ?? '',
            lead.main_stream ?? '',
            lead.stream_type ?? '',
            lead.event_format ?? '',
            lead.pipeline_stage?.name ?? lead.status ?? '',
            lead.grade_lead ?? '',
            lead.pic_sales_profile?.full_name ?? '',
            lead.account_manager_profile?.full_name ?? '',
            lead.lead_source ?? '',
            lead.referral_source ?? '',
            lead.business_purpose ?? '',
            lead.target_close_date ?? '',
            lead.event_dates?.join('; ') ?? (lead.event_date_start ? `${lead.event_date_start}${lead.event_date_end ? ` - ${lead.event_date_end}` : ''}` : ''),
            lead.pax_count ?? '',
            lead.destinations?.map(d => d.venue ? `${d.city} (${d.venue})` : d.city).join('; ') ?? '',
            lead.estimated_value ?? '',
            lead.actual_value ?? '',
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
                className={`group/pipeline flex flex-col border-r border-border bg-background shrink-0 flex-none relative overflow-hidden ${
                    isPipelineResizing ? "" : "transition-[width] duration-200 ease-out"
                } ${!isSidebarOpen ? 'w-[44px]' : ''}`}
                style={isSidebarOpen ? { width: `${pipelineWidth}px` } : undefined}
            >
                {/* ── Collapsed State: Vertical strip ── */}
                {!isSidebarOpen && (
                    <div className="flex flex-col items-center h-full w-full">
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="flex-1 flex flex-col items-center justify-center gap-3 w-full cursor-pointer group rounded-r-md transition-all duration-150 hover:bg-slate-100 active:bg-slate-200"
                            title={`Expand · ${activePipeline?.name || 'Pipelines'}`}
                        >
                            <span
                                className="text-[12px] font-semibold text-slate-500 group-hover:text-slate-800 tracking-wide transition-colors whitespace-nowrap inline-block"
                                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                            >
                                {activePipeline?.name || 'Pipelines'}
                            </span>
                            <ChevronsRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-700 shrink-0 transition-colors" />
                        </button>
                    </div>
                )}

                {/* Resize handle — drag to resize pipeline sidebar */}
                {isSidebarOpen && (
                    <div
                        onMouseDown={handlePipelineResize}
                        className="absolute top-0 right-0 w-[3px] h-full cursor-col-resize z-40 group/resize hover:bg-primary/20 active:bg-primary/30 transition-colors"
                        title="Drag to resize"
                    >
                        <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-[3px] h-8 rounded-full bg-transparent group-hover/resize:bg-primary/40 group-active/resize:bg-primary/60 transition-colors" />
                    </div>
                )}

                {/* ── Expanded State: Full sidebar ── */}
                {isSidebarOpen && (
                    <>
                {/* Sidebar Header — Notion pattern: title swaps to collapse on hover */}
                <div className="group/pheader px-3 border-b border-border flex items-center justify-between whitespace-nowrap h-12 shrink-0">
                    {/* Left: Title (default) / Collapse button (on hover) — they swap */}
                    <div className="flex items-center gap-1.5 min-w-0 relative">
                        {/* Default state: icon + label */}
                        <div className="flex items-center gap-1.5 group-hover/pipeline:opacity-0 transition-opacity duration-150">
                            <GitBranch className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <h3 className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground truncate">
                                Pipelines
                            </h3>
                        </div>
                        {/* Hover state: collapse button replaces title */}
                        <button
                            onClick={() => setIsSidebarOpen(false)}
                            className="absolute inset-0 flex items-center gap-1.5 opacity-0 group-hover/pipeline:opacity-100 transition-opacity duration-150 text-muted-foreground hover:text-foreground"
                            title="Collapse pipelines"
                        >
                            <ChevronsLeft className="h-4 w-4 shrink-0" />
                            <span className="text-[11px] font-medium">Hide</span>
                        </button>
                    </div>
                    {/* Right: Create pipeline button — always visible */}
                    <PermissionGate resource="leads" action="create">
                        <Button
                            variant="ghost" size="sm"
                            className="h-7 w-7 p-0 hover:bg-muted shrink-0"
                            onClick={() => setCreateOpen(true)}
                            title="Create new pipeline"
                        >
                            <Plus className="h-4 w-4" />
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
                <div className="px-4 border-b border-border bg-background shrink-0">
                    {/* Single-row compact toolbar (Linear/Attio style) */}
                    <div className="flex items-center justify-between h-10 gap-x-3 w-full">
                        <div className="flex items-center gap-2 min-w-0">
                            <h2 className="text-[13px] font-semibold leading-none truncate text-foreground">
                                {activePipeline?.name || "Select a Pipeline"}
                            </h2>
                            <span className="text-[11px] text-muted-foreground/70 tabular-nums whitespace-nowrap">
                                {leadsLoading ? "…" : filteredLeads.length}
                            </span>
                            {isHoldingView && activePipeline?.company?.name && (
                                <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded truncate max-w-[120px]">
                                    {activePipeline.company.name}
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 ml-auto max-w-full overflow-visible">
                            {/* Search Bar — compact, matches card text scale */}
                            <div className="relative shrink-0">
                                <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/60 pointer-events-none" />
                                <Input
                                    placeholder="Search..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-7 h-7 w-[140px] sm:w-[160px] lg:w-[180px] text-[11px] bg-muted/30 border-border/60 focus-visible:bg-background focus-visible:border-border focus-visible:w-[220px] transition-all placeholder:text-muted-foreground/50"
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
                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                            <MoreHorizontal className="h-3.5 w-3.5" />
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
                            <div className="flex items-center gap-1 shrink-0">
                                {/* Advanced Pipeline Filters */}
                                <PipelineFilters leads={leads} filters={filters} setFilters={setFilters} />

                                {/* Kanban Sort Dropdown (only in kanban view) */}
                                {viewMode === 'kanban' && (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 px-2 gap-1.5 text-[11px] font-normal border-border/60"
                                                title="Sort order"
                                            >
                                                <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                                                <span className="text-foreground">
                                                    {kanbanSort === 'manual' && 'Manual'}
                                                    {kanbanSort === 'newest' && 'Newest'}
                                                    {kanbanSort === 'oldest' && 'Oldest'}
                                                    {kanbanSort === 'close_date' && 'Close date'}
                                                    {kanbanSort === 'value_desc' && 'Value'}
                                                    {kanbanSort === 'updated' && 'Last updated'}
                                                </span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-56">
                                            {([
                                                { key: 'newest', label: 'Newest first', icon: Clock, desc: 'Recently created on top' },
                                                { key: 'oldest', label: 'Oldest first', icon: Clock, desc: 'Oldest on top' },
                                                { key: 'close_date', label: 'Close date', icon: CalendarClock, desc: 'Earliest due first' },
                                                { key: 'value_desc', label: 'Highest value', icon: DollarSign, desc: 'Largest deals first' },
                                                { key: 'updated', label: 'Last updated', icon: RotateCcw, desc: 'Recent activity' },
                                                { key: 'manual', label: 'Manual order', icon: GripVertical, desc: 'Drag & drop' },
                                            ] as const).map((opt) => {
                                                const Icon = opt.icon
                                                const active = kanbanSort === opt.key
                                                return (
                                                    <DropdownMenuItem
                                                        key={opt.key}
                                                        onClick={() => handleSortChange(opt.key as KanbanSort)}
                                                        className="flex items-start gap-2.5 py-2"
                                                    >
                                                        <Icon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-[12px] font-medium text-foreground">{opt.label}</div>
                                                            <div className="text-[10.5px] text-muted-foreground">{opt.desc}</div>
                                                        </div>
                                                        {active && <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />}
                                                    </DropdownMenuItem>
                                                )
                                            })}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                )}

                                {/* Portal target for Kanban Card Settings */}
                                {viewMode === 'kanban' && <div id="kanban-settings-portal" className="flex items-center shrink-0" />}

                                {/* Icon-only view toggle (Linear/Notion style) */}
                                <div className="flex items-center border rounded-md p-0.5 bg-muted/40 shrink-0">
                                    <button
                                        onClick={() => setViewMode('kanban')}
                                        title="Kanban view"
                                        className={`flex items-center justify-center w-6 h-6 rounded-sm transition-all ${viewMode === 'kanban'
                                            ? 'bg-background shadow-sm text-foreground'
                                            : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                    >
                                        <LayoutGrid className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        onClick={() => setViewMode('table')}
                                        title="Table view"
                                        className={`flex items-center justify-center w-6 h-6 rounded-sm transition-all ${viewMode === 'table'
                                            ? 'bg-background shadow-sm text-foreground'
                                            : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                    >
                                        <Table className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>

                            {/* Add Lead / Import */}
                            <PermissionGate resource="leads" action="create">
                                <div className="flex items-center">
                                    <Button
                                        size="sm"
                                        disabled={!activePipeline}
                                        className="h-7 rounded-r-none text-xs px-2.5"
                                        onClick={() => setAddSheetOpen(true)}
                                    >
                                        <Plus className="mr-1 h-3 w-3" /> New Lead
                                    </Button>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                size="sm"
                                                disabled={!activePipeline}
                                                className="h-7 rounded-l-none border-l border-primary-foreground/20 px-1"
                                            >
                                                <ChevronDown className="h-3 w-3" />
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

                {/* ─── Active Filter Pills ─────────────────────────────── */}
                <ActiveFilterPills filters={filters} setFilters={setFilters} />

                {/* ─── Board / Table Content ───────────────────────────── */}
                <div className={`flex-1 overflow-x-auto overflow-y-hidden ${
                    viewMode === 'kanban' ? 'pt-4 px-3 pb-3' : 'pt-1 pb-0 px-0'
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
                            dndEnabled={kanbanSort === 'manual'}
                            onAddLead={(stageId) => {
                                setAddSheetDefaultStageId(stageId)
                                setAddSheetOpen(true)
                            }}
                        />
                    ) : (
                        <div className="h-full flex flex-col">
                            <DataTable
                                columns={columns}
                                data={filteredLeads}
                                onRowClick={handleNavigateToLead}
                                defaultHiddenColumns={DEFAULT_HIDDEN_COLUMNS}
                                enableRowSelection
                                getRowId={(row) => String((row as Lead).id)}
                                totalValueAccessor={(row) => (row as Lead).estimated_value || 0}
                                totalValueLabel="Total value"
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
