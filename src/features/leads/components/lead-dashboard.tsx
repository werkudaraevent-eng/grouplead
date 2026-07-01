"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { DataTable } from "@/components/shared/data-table"
import { getColumns, DEFAULT_HIDDEN_COLUMNS } from "@/features/leads/components/lead-columns"
import { useCurrency } from "@/contexts/currency-context"
import { LeadKanban } from "@/features/leads/components/lead-kanban"
import { LeadForm } from "@/features/leads/components/lead-form"
import { ImportLeadsModal } from "@/features/leads/components/import-leads-modal"
import { Lead, Pipeline, PipelineStage, TransitionRule } from "@/types/index"
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
    Copy, ListTree, ChevronRight, Pencil, X,
    Search, SlidersHorizontal, ChevronDown, ChevronUp,
    Archive, RotateCcw, Settings2, ArchiveRestore, Upload, Download,
    ChevronsLeft, ChevronsRight, TrendingUp, ArrowUpDown,
    Check, Clock, CalendarClock, DollarSign, GripVertical,
} from "lucide-react"
import { PipelineFilters, PipelineFilterState, INITIAL_FILTER_STATE, ActiveFilterPills, applyFilters } from "@/features/leads/components/pipeline-filters"
import { PipelineIconPicker, PipelineIcon, DEFAULT_PIPELINE_ICON } from "@/features/leads/components/pipeline-icon-picker"
import { useResizablePanel } from "@/hooks/use-resizable-panel"
import { usePersistentViewMode } from "@/hooks/use-persistent-view-mode"
import { useRouter, usePathname } from "next/navigation"
import { PermissionGate } from "@/features/users/components/permission-gate"
import { usePermissions } from "@/contexts/permissions-context"
import { Input } from "@/components/ui/input"

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
import { bulkDeleteLeadsAction, deleteLeadAction } from "@/app/actions/lead-actions"
import * as XLSX from "xlsx"

type ViewMode = 'table' | 'kanban'
const VIEW_MODES = ['kanban', 'table'] as const satisfies readonly ViewMode[]

// Persist the last-selected pipeline per company scope so a page refresh
// restores the user's choice instead of snapping back to the first pipeline.
const PIPELINE_STORAGE_PREFIX = 'leadengine.activePipeline.'
// URL search param name — authoritative + shareable across refresh/back/forward.
const PIPELINE_QUERY_KEY = 'pipeline'

function getUrlPipelineId(): string | null {
    if (typeof window === 'undefined') return null
    try {
        return new URLSearchParams(window.location.search).get(PIPELINE_QUERY_KEY)
    } catch {
        return null
    }
}

function getStoredPipelineId(scope: string): string | null {
    if (typeof window === 'undefined' || !scope) return null
    try {
        return window.localStorage.getItem(PIPELINE_STORAGE_PREFIX + scope)
    } catch {
        return null
    }
}

function setStoredPipelineId(scope: string, id: string) {
    if (typeof window === 'undefined' || !scope) return
    try {
        window.localStorage.setItem(PIPELINE_STORAGE_PREFIX + scope, id)
    } catch {
        /* ignore quota / privacy-mode errors */
    }
}

export function LeadDashboard() {
    const { activeCompany, isHoldingView } = useCompany()
    // Tenant scope for lead queries. When the user is viewing "All units"
    // (holding lens) we pass null and let RLS union every company they belong
    // to. When focused on a single subsidiary we filter to that company_id.
    // Pipelines themselves are global definitions and are NOT scoped here.
    const leadScopeCompanyId = isHoldingView ? null : (activeCompany?.id ?? null)
    const { can } = usePermissions()
    const { fmt } = useCurrency()
    const supabase = createClient()
    const router = useRouter()
    const pathname = usePathname()
    const canDeleteLeads = can("leads", "delete")
    // Pipeline definitions are global and admin-managed (DB RLS allows only
    // super_admin/admin to mutate them). Gate the create/rename/delete UI on
    // the same admin-config permission so operators don't see dead buttons.
    const canManagePipelines = can("master_options", "update")

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
    // Archived pipelines
    const [archivedPipelines, setArchivedPipelines] = useState<Pipeline[]>([])
    const [showArchived, setShowArchived] = useState(false)
    const [restoringId, setRestoringId] = useState<string | null>(null)

    // Lead state
    const [leads, setLeads] = useState<Lead[]>([])
    const [leadsLoading, setLeadsLoading] = useState(true)

    // Pipeline stages + transition rules — used by the inline stage editor
    // in the table cell as well as the kanban view.
    const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([])
    const [transitionRules, setTransitionRules] = useState<TransitionRule[]>([])

    // Columns with currency formatting from context. Defined after state so
    // the closure captures the live stages/rules values.
    const columns = useMemo(
        () =>
            getColumns(fmt, {
                stages: pipelineStages,
                transitionRules,
                onStageChanged: (leadId, stage, updates) => {
                    setLeads((prev) =>
                        prev.map((l) =>
                            l.id === leadId
                                ? {
                                      ...l,
                                      ...(updates ?? {}),
                                      pipeline_stage_id: stage.id,
                                      status: stage.name,
                                      pipeline_stage: { name: stage.name, color: stage.color },
                                  }
                                : l,
                        ),
                    )
                },
            }),
        [fmt, pipelineStages, transitionRules],
    )

    // UI state — Sheet-based create & quick-edit
    const [addSheetOpen, setAddSheetOpen] = useState(false)
    const [addSheetDefaultStageId, setAddSheetDefaultStageId] = useState<string | undefined>()
    const [importOpen, setImportOpen] = useState(false)
    const [editLead, setEditLead] = useState<Lead | null>(null)
    const [editOpen, setEditOpen] = useState(false)
    // View mode persists across refreshes via URL (?view=table) and falls back
    // to localStorage so the choice also survives navigating away and back.
    const [viewMode, setViewMode] = usePersistentViewMode<ViewMode>({
        storageKey: "leads.view_mode",
        queryKey: "view",
        allowed: VIEW_MODES,
        defaultMode: "kanban",
    })

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
                // Sort by kanban_sort_order DESC (falls back to created_at DESC).
                // Client-side sort is required so optimistic DnD updates stay
                // in sync — after a drag, parent state keeps the fetched array
                // order but row values change; we must re-sort to reflect them.
                sorted.sort((a, b) => {
                    const sa = a.kanban_sort_order
                    const sb = b.kanban_sort_order
                    if (sa != null && sb != null && sa !== sb) return sb - sa
                    if (sa != null && sb == null) return -1
                    if (sa == null && sb != null) return 1
                    const ta = a.created_at ? new Date(a.created_at).getTime() : 0
                    const tb = b.created_at ? new Date(b.created_at).getTime() : 0
                    return tb - ta
                })
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
        const toastId = toast.loading('Deleting lead…')
        try {
            const result = await deleteLeadAction(deleteLeadId)
            if (!result.success) {
                toast.error(`Delete failed: ${result.error || "Permission denied"}`, { id: toastId })
            } else {
                toast.success('Lead deleted', { id: toastId })
                fetchLeads()
            }
        } catch (err) {
            toast.error(`Delete failed: ${err instanceof Error ? err.message : "Unexpected error"}`, { id: toastId })
        } finally {
            setDeleteLeadId(null)
            setDeleting(false)
        }
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
        const toastId = toast.loading(`Deleting ${targets.length} lead${targets.length !== 1 ? 's' : ''}…`)
        try {
            const result = await bulkDeleteLeadsAction(numericIds)
            if (!result.success) {
                toast.error(`Bulk delete failed: ${result.error || "Permission denied"}`, { id: toastId })
            } else {
                const deleted = result.data?.deleted ?? targets.length
                toast.success(`${deleted} lead${deleted !== 1 ? 's' : ''} deleted`, { id: toastId })
                setSelectedLeadIds([])
                fetchLeads()
            }
        } catch (err) {
            toast.error(`Bulk delete failed: ${err instanceof Error ? err.message : "Unexpected error"}`, { id: toastId })
        } finally {
            setBulkDeleteOpen(false)
            setBulkDeleteLeads([])
            setDeleting(false)
        }
    }

    // ─── Export Leads (XLSX) ─────────────────────────────────────────
    const handleBulkExport = (rows: Lead[]) => {
        if (rows.length === 0) return
        const headers = [
            'No', 'Manual ID', 'Subsidiary', 'Client', 'Contact Person', 'Project', 'Category',
            'Stream', 'Stream Type', 'Format', 'Stage', 'Grade', 'PIC Sales', 'Account Manager',
            'Lead Source', 'Referral Source', 'Business Purpose', 'Target Close Date',
            'Event Dates', 'Pax Count', 'Destinations', 'Estimated Value', 'Confirmed Value',
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
        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...csvRows])
        worksheet['!cols'] = headers.map((header) => ({ wch: Math.max(14, header.length + 2) }))

        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads')
        XLSX.writeFile(workbook, `leads_export_${new Date().toISOString().slice(0, 10)}.xlsx`)
        toast.success(`Exported ${rows.length} lead(s) to XLSX`)
    }

    // ─── Fetch pipelines (global definitions, shared by all users) ──────
    const fetchPipelines = useCallback(async () => {
        setPipelinesLoading(true)

        // Pipelines are global: everyone sees the same active set. Lead rows
        // are what get scoped per-subsidiary (see fetchLeads), not the pipeline
        // definitions themselves.
        const { data } = await supabase
            .from('pipelines')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: true })

        const fetched = (data ?? []) as Pipeline[]
        setPipelines(fetched)
        setActivePipeline((prev) => {
            if (prev && fetched.find(p => p.id === prev.id)) return prev
            const urlId = getUrlPipelineId()
            const fromUrl = urlId ? fetched.find(p => p.id === urlId) : undefined
            if (fromUrl) return fromUrl
            const storedId = getStoredPipelineId('global')
            const stored = storedId ? fetched.find(p => p.id === storedId) : undefined
            return stored ?? fetched[0] ?? null
        })

        setPipelinesLoading(false)
    }, [supabase])

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
        // Pipelines are global — archived ones are shared too.
        const { data } = await supabase
            .from('pipelines')
            .select('*')
            .eq('is_active', false)
            .order('created_at', { ascending: false })
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

    // ─── Fetch leads for active pipeline (scoped to current tenant lens) ──
    const fetchLeads = useCallback(async () => {
        if (!activePipeline) { setLeads([]); setLeadsLoading(false); return }
        setLeadsLoading(true)
        let query = supabase
            .from('leads')
            .select(`
                *,
                company:companies!company_id(name),
                client_company:client_companies!client_company_id(name),
                contact:contacts!contact_id(salutation, full_name, email, phone),
                pipeline_stage:pipeline_stages!pipeline_stage_id(name, color),
                pic_sales_profile:profiles!pic_sales_id(full_name, avatar_url),
                account_manager_profile:profiles!account_manager_id(full_name, avatar_url)
            `)
            .eq('pipeline_id', activePipeline.id)
            .is('deleted_at', null)

        // Scope leads to the active subsidiary. In "All units" (holding) lens
        // we leave it unfiltered and RLS unions every company the user can see.
        if (leadScopeCompanyId) {
            query = query.eq('company_id', leadScopeCompanyId)
        }

        const { data, error } = await query
            .order('kanban_sort_order', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false })

        if (error) console.error('[Lead Fetch]', error.message)
        setLeads((data ?? []) as Lead[])
        setLeadsLoading(false)
    }, [activePipeline?.id, leadScopeCompanyId, supabase])

    useEffect(() => { fetchPipelines() }, [fetchPipelines])
    useEffect(() => { fetchLeads() }, [fetchLeads])

    // ─── Persist active pipeline → URL (?pipeline=) + localStorage ──────
    // URL is authoritative/shareable; localStorage is the cross-session
    // fallback when the URL has no param (matches usePersistentViewMode).
    useEffect(() => {
        if (!activePipeline) return
        setStoredPipelineId('global', activePipeline.id)

        if (typeof window === 'undefined') return
        const params = new URLSearchParams(window.location.search)
        if (params.get(PIPELINE_QUERY_KEY) !== activePipeline.id) {
            params.set(PIPELINE_QUERY_KEY, activePipeline.id)
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        }
    }, [activePipeline?.id, pathname, router])

    // ─── Fetch pipeline stages + transition rules for the active pipeline ──
    // Mirrors the kanban's own fetch so the table and the kanban share the
    // same source of truth for the inline stage editor.
    useEffect(() => {
        if (!activePipeline) {
            setPipelineStages([])
            setTransitionRules([])
            return
        }
        let cancelled = false
        const load = async () => {
            const [{ data: stagesData }, { data: rulesData }] = await Promise.all([
                supabase
                    .from("pipeline_stages")
                    .select("*")
                    .eq("pipeline_id", activePipeline.id)
                    .order("sort_order", { ascending: true }),
                supabase
                    .from("pipeline_transition_rules")
                    .select("*")
                    .eq("pipeline_id", activePipeline.id),
            ])
            if (cancelled) return
            setPipelineStages((stagesData ?? []) as PipelineStage[])
            setTransitionRules((rulesData ?? []) as TransitionRule[])
        }
        void load()
        return () => {
            cancelled = true
        }
    }, [activePipeline?.id, supabase])

    // ─── Pipeline CRUD ───────────────────────────────────────────────
    const handleCreatePipeline = async () => {
        if (!newPipelineName.trim()) return
        setCreating(true)

        // Pipelines are global definitions — no owner company, no visibility.
        const { data, error } = await supabase
            .from('pipelines')
            .insert({
                name: newPipelineName.trim(),
                company_id: null,
                icon: newPipelineIcon,
            })
            .select('*')
            .single()
        if (error) { toast.error(error.message); setCreating(false); return }

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
        setCreateOpen(false)
        setCreating(false)
        toast.success(`Pipeline "${pipeline.name}" created with default stages`)
    }

    const handleClonePipeline = async () => {
        if (!activePipeline) return
        setCloning(true)
        const { data: newPipeline, error } = await supabase
            .from('pipelines')
            .insert({ name: `${activePipeline.name} (Copy)`, company_id: null, icon: activePipeline.icon || DEFAULT_PIPELINE_ICON })
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
                    {/* Right: Create pipeline button — admin only */}
                    {canManagePipelines && (
                        <Button
                            variant="ghost" size="sm"
                            className="h-7 w-7 p-0 hover:bg-muted shrink-0"
                            onClick={() => setCreateOpen(true)}
                            title="Create new pipeline"
                        >
                            <Plus className="h-4 w-4" />
                        </Button>
                    )}
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
                            return (
                                <div key={pipeline.id} className="group relative">
                                    <button
                                        onClick={() => setActivePipeline(pipeline)}
                                        className={`w-full flex items-center gap-2 rounded-md pl-3 pr-9 py-2.5 text-left transition-all ${isActive
                                                ? 'bg-primary text-primary-foreground shadow-sm'
                                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                            }`}
                                    >
                                        <PipelineIcon icon={pipeline.icon} className="h-3.5 w-3.5 shrink-0 opacity-80" />
                                        <span className="truncate min-w-0 text-sm font-medium">{pipeline.name}</span>
                                    </button>
                                    {/* Context Menu */}
                                    {canManagePipelines && (
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
                                            <DropdownMenuItem onClick={() => { setRenameValue(pipeline.name); setRenameIcon(pipeline.icon || DEFAULT_PIPELINE_ICON); setActivePipeline(pipeline); setRenameOpen(true) }}>
                                                <Pencil className="h-3.5 w-3.5 mr-2" /> Rename Pipeline
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => router.push(`/settings/pipeline?id=${pipeline.id}`)}>
                                                <Settings2 className="h-3.5 w-3.5 mr-2" /> Manage Stages
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={() => handleArchivePipeline(pipeline)} disabled={archiving}>
                                                <Archive className="h-3.5 w-3.5 mr-2" /> Archive Pipeline
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleTriggerDelete(pipeline)}>
                                                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Pipeline
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    )}
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

                {/* ─── Page Header (Linear / Attio style two-row layout) ─────────── */}
                <div className="border-b border-border bg-background shrink-0">
                    {/* Row 1: Pipeline identity + primary action */}
                    <div className="flex items-center justify-between gap-4 px-6 pt-4 pb-2">
                        <div className="flex items-center gap-3 min-w-0">
                            {activePipeline?.icon && (
                                <PipelineIcon icon={activePipeline.icon} className="h-5 w-5 text-muted-foreground shrink-0" />
                            )}
                            <div className="min-w-0">
                                <h1 className="text-[18px] font-semibold tracking-tight leading-snug text-foreground truncate">
                                    {activePipeline?.name || "Select a Pipeline"}
                                </h1>
                            </div>
                            <span className="ml-1 inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-full bg-muted text-muted-foreground text-[12px] font-medium tabular-nums">
                                {leadsLoading ? "…" : filteredLeads.length}
                            </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            {activePipeline && canManagePipelines && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
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

                            <PermissionGate resource="leads" action="create">
                                <div className="flex items-center">
                                    <Button
                                        disabled={!activePipeline}
                                        className="h-9 rounded-r-none px-4 text-[13px]"
                                        onClick={() => setAddSheetOpen(true)}
                                    >
                                        <Plus className="mr-1.5 h-4 w-4" /> New Lead
                                    </Button>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                disabled={!activePipeline}
                                                className="h-9 rounded-l-none border-l border-primary-foreground/20 px-2"
                                            >
                                                <ChevronDown className="h-4 w-4" />
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
                                            <DropdownMenuItem
                                                disabled={filteredLeads.length === 0}
                                                onClick={() => handleBulkExport(filteredLeads)}
                                            >
                                                <Download className="mr-2 h-4 w-4" />
                                                Export to XLSX
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </PermissionGate>
                        </div>
                    </div>

                    {/* Row 2: Toolbar */}
                    <div className="flex items-center justify-between gap-3 px-6 pb-2.5">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className="relative w-full max-w-[280px]">
                                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 pointer-events-none" />
                                <Input
                                    placeholder="Search leads..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-8 h-8 text-[12px] bg-muted/30 border-border/60 focus-visible:bg-background focus-visible:border-border placeholder:text-muted-foreground/50"
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
                            <PipelineFilters leads={leads} filters={filters} setFilters={setFilters} />
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            {viewMode === 'kanban' && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 px-2.5 gap-1.5 text-[12px] font-normal border-border/60"
                                            title="Sort order"
                                        >
                                            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
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

                            {/* Portal target for Table Columns popover */}
                            {viewMode === 'table' && <div id="table-columns-portal" className="flex items-center shrink-0" />}

                            <div className="flex items-center border rounded-md p-0.5 bg-muted/40 shrink-0">
                                <button
                                    onClick={() => setViewMode('kanban')}
                                    title="Kanban view"
                                    className={`inline-flex items-center gap-1.5 px-2.5 h-7 rounded-sm text-[12px] font-medium transition-all ${viewMode === 'kanban'
                                        ? 'bg-background shadow-sm text-foreground'
                                        : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                >
                                    <LayoutGrid className="h-3.5 w-3.5" />
                                    Kanban
                                </button>
                                <button
                                    onClick={() => setViewMode('table')}
                                    title="Table view"
                                    className={`inline-flex items-center gap-1.5 px-2.5 h-7 rounded-sm text-[12px] font-medium transition-all ${viewMode === 'table'
                                        ? 'bg-background shadow-sm text-foreground'
                                        : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                >
                                    <Table className="h-3.5 w-3.5" />
                                    Table
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ─── Active Filter Pills ─────────────────────────────── */}
                <ActiveFilterPills filters={filters} setFilters={setFilters} />

                {/* ─── Board / Table Content ───────────────────────────── */}
                <div className={`flex-1 overflow-x-auto overflow-y-hidden ${
                    viewMode === 'kanban' ? 'pt-3 px-3 pb-2' : 'pt-1 pb-0 px-0'
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
                                storageKey="leads"
                                getRowId={(row) => String((row as Lead).id)}
                                totalValueAccessor={(row) => (row as Lead).estimated_value || 0}
                                totalValueLabel="Total value"
                                bulkActions={{
                                    onBulkDelete: canDeleteLeads ? handleTableBulkDelete : undefined,
                                }}
                                columnsPopoverSlot={({ Trigger }) => {
                                    const target = typeof document !== 'undefined' ? document.getElementById('table-columns-portal') : null
                                    return target ? createPortal(Trigger, target) : null
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
            <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) { setNewPipelineIcon(DEFAULT_PIPELINE_ICON) } }}>
                <DialogContent className="sm:max-w-md">
                    <div className="space-y-4">
                        <DialogHeader>
                            <DialogTitle>Create Pipeline</DialogTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                                A new pipeline with default stages will be created. Pipelines are shared across all business units.
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

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                disabled={!newPipelineName.trim() || creating}
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
                        <AlertDialogTitle>Move this lead to Recycle Bin?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will move the lead to the Recycle Bin. An admin can restore it later.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => { e.preventDefault(); handleDeleteSingleLead() }}
                            disabled={deleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                            {deleting ? 'Moving…' : 'Move to Recycle Bin'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Bulk Delete Confirm */}
            <AlertDialog open={bulkDeleteOpen} onOpenChange={(open) => { if (!open) { setBulkDeleteOpen(false); setBulkDeleteLeads([]) } }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Move {bulkDeleteLeads.length} lead{bulkDeleteLeads.length !== 1 ? 's' : ''} to Recycle Bin?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will move all selected leads to the Recycle Bin. An admin can restore them later.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => { e.preventDefault(); handleBulkDelete() }}
                            disabled={deleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                            {deleting ? 'Moving…' : `Move ${bulkDeleteLeads.length} Lead${bulkDeleteLeads.length !== 1 ? 's' : ''} to Recycle Bin`}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
