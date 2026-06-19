"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import * as XLSX from "xlsx"
import {
    ArrowDown, ArrowUp, ArrowUpDown, Briefcase, Building2, Columns, Download,
    Eye, EyeOff, Globe, GripVertical, MoreHorizontal, Pencil, Phone,
    Plus, RotateCcw, Search, Trash2, Upload, Users, AlertTriangle,
} from "lucide-react"
import { toast } from "sonner"

import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
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

import { AddCompanyModal } from "@/features/companies/components/add-company-modal"
import { CompanyDetailSheet } from "@/features/companies/components/company-detail-sheet"
import { AddContactModal } from "@/features/contacts/components/add-contact-modal"
import { ImportCompaniesModal } from "@/features/companies/components/import-companies-modal"
import { PermissionGate } from "@/features/users/components/permission-gate"
import { BulkActionBar } from "@/components/shared/bulk-action-bar"
import { FilterBuilder } from "@/components/shared/filter-builder"
import { applyFilters, type FilterDefinition, type FilterValue } from "@/components/shared/filter-builder-types"
import { ListPageHeader } from "@/components/shared/list-page-header"
import { Pagination } from "@/components/shared/pagination"
import { SavedViewsBar } from "@/components/shared/saved-views-bar"
import { SearchableSelect } from "@/components/shared/searchable-select"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { useListViews } from "@/hooks/use-list-views"
import { formatPhoneDisplay } from "@/lib/phone-normalize"
import { cn } from "@/lib/utils"
import type { ClientCompany } from "@/types"

type CompanyRow = ClientCompany & {
    lead_count: number
    owner?: { full_name: string; avatar_url?: string | null } | null
    parent?: { id: string; name: string } | null
}

type ColId = "name" | "industry" | "line_industry" | "phone" | "website" | "owner" | "parent" | "address" | "city" | "postal_code" | "country" | "created_at"

interface ColumnDef {
    id: ColId
    label: string
    visible: boolean
    width: number
}

const DEFAULT_COLUMNS: ColumnDef[] = [
    { id: "name", label: "Company name", visible: true, width: 260 },
    { id: "industry", label: "Sector", visible: true, width: 170 },
    { id: "line_industry", label: "Line industry", visible: true, width: 180 },
    { id: "phone", label: "Phone", visible: true, width: 160 },
    { id: "website", label: "Website", visible: true, width: 200 },
    { id: "owner", label: "Owner", visible: false, width: 160 },
    { id: "parent", label: "Parent company", visible: false, width: 220 },
    { id: "address", label: "Address", visible: false, width: 260 },
    { id: "city", label: "City", visible: false, width: 140 },
    { id: "postal_code", label: "Postal code", visible: false, width: 130 },
    { id: "country", label: "Country", visible: false, width: 140 },
    { id: "created_at", label: "Date added", visible: false, width: 140 },
]

interface CompaniesViewConfig {
    filters: FilterValue[]
    sort: { key: string; direction: "asc" | "desc" } | null
    columns: ColumnDef[]
    itemsPerPage: number
    searchQuery: string
}

function getInitials(name: string) {
    if (!name) return "?"
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(n => n[0]).join("").toUpperCase()
}

function getAvatarColor(name: string) {
    const colors = [
        "bg-primary/10 text-primary border-primary/15",
        "bg-emerald-50 text-emerald-700 border-emerald-100",
        "bg-amber-50 text-amber-700 border-amber-100",
        "bg-violet-50 text-violet-700 border-violet-100",
        "bg-rose-50 text-rose-700 border-rose-100",
        "bg-cyan-50 text-cyan-700 border-cyan-100",
    ]
    let hash = 0
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
    return colors[Math.abs(hash) % colors.length]
}

export default function CompaniesPage() {
    const router = useRouter()
    const supabase = React.useMemo(() => createClient(), [])

    const [companies, setCompanies] = React.useState<CompanyRow[]>([])
    const [loading, setLoading] = React.useState(true)
    const [addOpen, setAddOpen] = React.useState(false)
    const [selectedCompany, setSelectedCompany] = React.useState<CompanyRow | null>(null)
    const [sheetOpen, setSheetOpen] = React.useState(false)
    const [addContactOpen, setAddContactOpen] = React.useState(false)
    const [addContactCompanyId, setAddContactCompanyId] = React.useState<string | null>(null)
    const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false)
    const [importOpen, setImportOpen] = React.useState(false)

    const [searchQuery, setSearchQuery] = React.useState("")
    const [filters, setFilters] = React.useState<FilterValue[]>([])
    const [sortConfig, setSortConfig] = React.useState<{ key: string; direction: "asc" | "desc" } | null>(null)
    const [currentPage, setCurrentPage] = React.useState(1)
    const [itemsPerPage, setItemsPerPage] = React.useState(20)
    const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
    const [columns, setColumns] = React.useState<ColumnDef[]>(DEFAULT_COLUMNS)

    React.useEffect(() => {
        const stored = localStorage.getItem("companies_cols_order")
        if (!stored) return
        try {
            const parsed = JSON.parse(stored) as ColumnDef[]
            const merged = parsed.filter(p => DEFAULT_COLUMNS.some(d => d.id === p.id))
            const missing = DEFAULT_COLUMNS.filter(d => !merged.some(m => m.id === d.id))
            setColumns([...merged, ...missing])
        } catch {
            setColumns(DEFAULT_COLUMNS)
        }
    }, [])

    const fetchCompanies = React.useCallback(async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from("client_companies")
            .select("id, name, industry, line_industry, website, phone, address, area, street_address, city, postal_code, country, parent_id, owner_id, created_at, account_status, needs_enrichment, custom_data, parent:parent_id(id, name), owner:profiles!client_companies_owner_id_fkey(full_name, avatar_url)")
            .order("name", { ascending: true })
        if (error) {
            console.warn("[Companies Fetch]:", error.message || error)
            toast.error("Failed to load company data")
            setLoading(false)
            return
        }
        setCompanies(((data as unknown as CompanyRow[]) || []).map(c => ({ ...c, lead_count: 0 })))
        setLoading(false)
    }, [supabase])

    React.useEffect(() => { fetchCompanies() }, [fetchCompanies])

    const activeCols = React.useMemo(() => columns.filter(c => c.visible), [columns])
    const uniqueSectors = React.useMemo(() => Array.from(new Set(companies.map(c => c.industry).filter(Boolean))) as string[], [companies])
    const uniqueLines = React.useMemo(() => Array.from(new Set(companies.map(c => c.line_industry).filter(Boolean))) as string[], [companies])
    const uniqueOwners = React.useMemo(() => Array.from(new Set(companies.map(c => c.owner?.full_name).filter(Boolean))) as string[], [companies])
    const uniqueCountries = React.useMemo(() => Array.from(new Set(companies.map(c => c.country).filter(Boolean))) as string[], [companies])

    const filterDefinitions = React.useMemo<FilterDefinition[]>(() => [
        { field: "industry", label: "Sector", type: "select", pinned: true, options: uniqueSectors.map(v => ({ value: v, label: v })), accessor: row => (row as CompanyRow).industry ?? "" },
        { field: "line_industry", label: "Line industry", type: "select", pinned: true, options: uniqueLines.map(v => ({ value: v, label: v })), accessor: row => (row as CompanyRow).line_industry ?? "" },
        { field: "owner.full_name", label: "Owner", type: "select", pinned: true, options: uniqueOwners.map(v => ({ value: v, label: v })), accessor: row => (row as CompanyRow).owner?.full_name ?? "" },
        { field: "phone", label: "Has phone", type: "boolean", defaultOperator: "is_not_empty", accessor: row => (row as CompanyRow).phone },
        { field: "website", label: "Has website", type: "boolean", defaultOperator: "is_not_empty", accessor: row => (row as CompanyRow).website },
        { field: "country", label: "Country", type: "select", options: uniqueCountries.map(v => ({ value: v, label: v })), accessor: row => (row as CompanyRow).country ?? "" },
        { field: "needs_enrichment", label: "Needs details", type: "boolean", defaultOperator: "is_true", accessor: row => (row as CompanyRow).needs_enrichment ?? false },
        { field: "created_at", label: "Created date", type: "date-range", accessor: row => (row as CompanyRow).created_at },
    ], [uniqueSectors, uniqueLines, uniqueOwners, uniqueCountries])

    const snapshot = React.useCallback((): CompaniesViewConfig => ({ filters, sort: sortConfig, columns, itemsPerPage, searchQuery }), [filters, sortConfig, columns, itemsPerPage, searchQuery])
    const applySnapshot = React.useCallback((config: Partial<CompaniesViewConfig>) => {
        if (Array.isArray(config.filters)) setFilters(config.filters)
        if ("sort" in config) setSortConfig(config.sort ?? null)
        if (Array.isArray(config.columns)) setColumns(config.columns)
        if (typeof config.itemsPerPage === "number") setItemsPerPage(config.itemsPerPage)
        if (typeof config.searchQuery === "string") setSearchQuery(config.searchQuery)
        setCurrentPage(1)
    }, [])
    const listViews = useListViews<CompaniesViewConfig>({ pageKey: "companies", snapshot, applySnapshot: applySnapshot as (config: CompaniesViewConfig) => void, storageKey: "companies_active_view_id" })

    const searchedData = React.useMemo(() => {
        const q = searchQuery.trim().toLowerCase()
        if (!q) return companies
        return companies.filter(item => [item.name, item.industry, item.line_industry, item.phone, item.website, item.owner?.full_name, item.parent?.name, item.city, item.country].filter(Boolean).join(" ").toLowerCase().includes(q))
    }, [companies, searchQuery])
    const filteredData = React.useMemo(() => applyFilters(searchedData, filters, filterDefinitions), [searchedData, filters, filterDefinitions])
    const sortedData = React.useMemo(() => [...filteredData].sort((a: any, b: any) => {
        if (!sortConfig) return 0
        const { key, direction } = sortConfig
        const valA = key === "owner" ? a.owner?.full_name || "" : (key === "parent" ? a.parent?.name || "" : a[key] || "")
        const valB = key === "owner" ? b.owner?.full_name || "" : (key === "parent" ? b.parent?.name || "" : b[key] || "")
        if (valA < valB) return direction === "asc" ? -1 : 1
        if (valA > valB) return direction === "asc" ? 1 : -1
        return 0
    }), [filteredData, sortConfig])
    const totalPages = Math.max(1, Math.ceil(sortedData.length / itemsPerPage))
    const paginatedData = React.useMemo(() => sortedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage), [sortedData, currentPage, itemsPerPage])
    React.useEffect(() => { setCurrentPage(1); setSelectedIds(new Set()) }, [searchQuery, filters, itemsPerPage])

    const handleSort = (key: string) => setSortConfig({ key, direction: sortConfig?.key === key && sortConfig.direction === "asc" ? "desc" : "asc" })
    const toggleSelectAll = () => selectedIds.size === paginatedData.length && paginatedData.length > 0 ? setSelectedIds(new Set()) : setSelectedIds(new Set(paginatedData.map(c => c.id)))
    const toggleSelect = (id: string) => setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
    const resetColumns = () => { setColumns(DEFAULT_COLUMNS); localStorage.removeItem("companies_cols_order") }
    const toggleColumn = (id: ColId, visible: boolean) => { const next = columns.map(c => c.id === id ? { ...c, visible } : c); setColumns(next); localStorage.setItem("companies_cols_order", JSON.stringify(next)) }

    const executeBulkDelete = async () => {
        const ids = Array.from(selectedIds)
        const { error } = await supabase.from("client_companies").delete().in("id", ids)
        if (error) { toast.error(error.message || "Failed to delete companies"); return }
        toast.success(`${ids.length} companies deleted`)
        setSelectedIds(new Set())
        setDeleteConfirmOpen(false)
        fetchCompanies()
    }
    const handleDelete = async (company: CompanyRow) => {
        if (!confirm(`Delete ${company.name}? This cannot be undone.`)) return
        const { error } = await supabase.from("client_companies").delete().eq("id", company.id)
        if (error) { toast.error("Failed to delete company"); return }
        toast.success("Company deleted")
        fetchCompanies()
        if (selectedCompany?.id === company.id) setSheetOpen(false)
    }
    const handleExport = (onlySelected = false) => {
        const source = onlySelected ? sortedData.filter(c => selectedIds.has(c.id)) : sortedData
        const headers = ["ID", "Name", "Parent Company", "Sector", "Line Industry", "Phone", "Website", "Owner", "Address", "City", "Postal Code", "Country", "Created At"]
        const rows = source.map(c => [c.id, c.name || "", c.parent?.name || "", c.industry || "", c.line_industry || "", c.phone || "", c.website || "", c.owner?.full_name || "", c.address || "", c.city || "", c.postal_code || "", c.country || "", c.created_at ? new Date(c.created_at).toLocaleDateString() : ""])
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Companies"); XLSX.writeFile(wb, `companies_export_${new Date().toISOString().split("T")[0]}.xlsx`)
    }
    const handleAddContact = (companyId: string) => { setAddContactCompanyId(companyId); setAddContactOpen(true) }

    const renderCellContent = (colId: ColId, company: CompanyRow) => {
        switch (colId) {
            case "name": return <div className="flex items-center gap-3 min-w-0"><div className={cn("w-8 h-8 rounded-md border flex items-center justify-center text-[10px] font-semibold shrink-0", getAvatarColor(company.name))}>{getInitials(company.name)}</div><div className="min-w-0"><span className="font-medium text-[13px] text-foreground group-hover:text-primary transition-colors truncate block">{company.name}{company.needs_enrichment && <span title="Auto-created from a lead import. Edit and save to complete it." className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-amber-50 border border-amber-200 px-1 py-0 text-[10px] font-semibold text-amber-700 align-middle"><AlertTriangle className="w-2.5 h-2.5" />Needs details</span>}</span>{company.parent?.name && <p className="text-[11px] text-muted-foreground truncate">{company.parent.name}</p>}</div></div>
            case "industry": return company.industry ? <div className="flex items-center gap-2"><Briefcase className="w-3 h-3 text-muted-foreground shrink-0" /><span className="truncate">{company.industry}</span></div> : <span className="text-muted-foreground/60">—</span>
            case "line_industry": return company.line_industry ? <span className="truncate">{company.line_industry}</span> : <span className="text-muted-foreground/60">—</span>
            case "phone": return company.phone ? <div className="flex items-center gap-2"><Phone className="w-3 h-3 text-muted-foreground shrink-0" /><span className="truncate">{formatPhoneDisplay(company.phone)}</span></div> : <span className="text-muted-foreground/60">—</span>
            case "website": return company.website ? <a href={company.website.startsWith("http") ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline" onClick={e => e.stopPropagation()}><Globe className="w-3 h-3 shrink-0" /><span className="truncate">{company.website}</span></a> : <span className="text-muted-foreground/60">—</span>
            case "owner": return company.owner?.full_name ? <div className="flex items-center gap-2">{company.owner.avatar_url ? <img src={company.owner.avatar_url} alt={company.owner.full_name} className="w-5 h-5 rounded-full object-cover border shrink-0" /> : <div className={cn("w-5 h-5 rounded-full border flex items-center justify-center text-[9px] font-bold shrink-0", getAvatarColor(company.owner.full_name))}>{getInitials(company.owner.full_name)}</div>}<span className="truncate">{company.owner.full_name}</span></div> : <span className="text-muted-foreground/60">—</span>
            case "parent": return company.parent?.name ? <span className="truncate">{company.parent.name}</span> : <span className="text-muted-foreground/60">—</span>
            case "address": return company.address ? <span className="truncate">{company.address}</span> : <span className="text-muted-foreground/60">—</span>
            case "city": return company.city ? <span className="truncate">{company.city}</span> : <span className="text-muted-foreground/60">—</span>
            case "postal_code": return company.postal_code ? <span className="truncate">{company.postal_code}</span> : <span className="text-muted-foreground/60">—</span>
            case "country": return company.country ? <span className="truncate">{company.country}</span> : <span className="text-muted-foreground/60">—</span>
            case "created_at": return company.created_at ? new Date(company.created_at).toLocaleDateString() : <span className="text-muted-foreground/60">—</span>
            default: return null
        }
    }

    return (
        <div className="w-full h-[calc(100vh-64px)] sm:h-full flex flex-col overflow-hidden bg-background">
            <div className="shrink-0 px-4 sm:px-6 lg:px-8 pt-6 pb-4">
                <ListPageHeader title="Companies" subtitle="Manage client organisations, accounts, and company-level context." actions={<PermissionGate resource="companies" action="create"><Button onClick={() => { setSelectedCompany(null); setAddOpen(true) }} className="h-9 px-4 text-[13px]"><Plus className="w-4 h-4 mr-1.5" /> Add company</Button></PermissionGate>} />
            </div>

            <div className="shrink-0 px-4 sm:px-6 lg:px-8"><SavedViewsBar views={listViews.views.map(v => ({ id: v.id, name: v.name, is_default: v.is_default }))} activeViewId={listViews.activeViewId} onSelectView={listViews.selectView} isDirty={listViews.isDirty} onSaveCurrent={listViews.saveCurrent} onSaveAs={listViews.saveAs} onRename={listViews.renameView} onDelete={listViews.deleteView} onMakeDefault={listViews.makeDefault} className="mb-3" /></div>

            <div className="shrink-0 px-4 sm:px-6 lg:px-8 pb-4 border-b border-border">
                <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
                    <div className="flex flex-col sm:flex-row gap-2 min-w-0 flex-1">
                        <div className="relative min-w-[220px] sm:max-w-[360px] flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" /><Input placeholder="Search by company, sector, phone, or website" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-9 bg-card border-border text-[13px] rounded-lg" /></div>
                        <FilterBuilder definitions={filterDefinitions} value={filters} onChange={setFilters} />
                    </div>
                    <div className="flex items-center gap-2 shrink-0 justify-end"><ColumnsMenu columns={columns} activeCols={activeCols} toggleColumn={toggleColumn} resetColumns={resetColumns} setColumns={setColumns} /><Button variant="outline" size="sm" onClick={() => handleExport(false)} className="h-9 px-3 gap-2 bg-card text-[13px]"><Download className="w-4 h-4 text-muted-foreground" /> Export</Button><PermissionGate resource="companies" action="create"><Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="h-9 px-3 gap-2 bg-card text-[13px]"><Upload className="w-4 h-4 text-muted-foreground" /> Import</Button></PermissionGate></div>
                </div>
            </div>

            <DataTable loading={loading} companies={companies} paginatedData={paginatedData} activeCols={activeCols} columns={columns} selectedIds={selectedIds} currentPage={currentPage} itemsPerPage={itemsPerPage} sortConfig={sortConfig} toggleSelectAll={toggleSelectAll} toggleSelect={toggleSelect} handleSort={handleSort} renderCellContent={renderCellContent} router={router} handleDelete={handleDelete} setSelectedCompany={setSelectedCompany} setAddOpen={setAddOpen} handleAddContact={handleAddContact} />

            <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t border-border bg-card gap-3 sm:gap-0 mt-auto"><div className="text-[13px] text-muted-foreground font-medium"><span className="text-foreground font-semibold">{filteredData.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</span>–<span className="text-foreground font-semibold">{Math.min(currentPage * itemsPerPage, filteredData.length)}</span> of <span className="text-foreground font-semibold">{filteredData.length}</span></div><div className="flex items-center gap-4"><div className="flex items-center gap-2"><span className="text-[13px] text-muted-foreground">Rows</span><SearchableSelect value={itemsPerPage.toString()} onChange={val => val && setItemsPerPage(Number(val))} options={[10,20,50,100].map(n => ({value:String(n), label:String(n)}))} clearable={false} contentWidth="auto" className="h-8 w-[72px]" /></div><Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} size="sm" /></div></div>

            <BulkActionBar count={selectedIds.size} onClear={() => setSelectedIds(new Set())}><Button variant="ghost" size="sm" onClick={() => handleExport(true)} className="h-7 px-2.5 text-background/90 hover:text-background hover:bg-background/10 text-xs"><Download className="h-3.5 w-3.5 mr-1" /> Export</Button><PermissionGate resource="companies" action="delete"><Button variant="ghost" size="sm" onClick={() => setDeleteConfirmOpen(true)} className="h-7 px-2.5 text-background/90 hover:text-background hover:bg-background/10 text-xs"><Trash2 className="h-3.5 w-3.5 mr-1" /> Delete</Button></PermissionGate></BulkActionBar>

            <AddCompanyModal open={addOpen} onOpenChange={setAddOpen} initialData={selectedCompany} onCreated={fetchCompanies} />
            <CompanyDetailSheet company={selectedCompany} open={sheetOpen} onOpenChange={setSheetOpen} onAddContact={handleAddContact} />
            <AddContactModal isOpen={addContactOpen} onOpenChange={setAddContactOpen} preselectedCompanyId={addContactCompanyId} onSuccess={() => { setAddContactOpen(false); fetchCompanies() }} />
            <ImportCompaniesModal open={importOpen} onOpenChange={setImportOpen} onSuccess={fetchCompanies} />
            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete selected companies?</AlertDialogTitle><AlertDialogDescription>This will permanently delete <strong className="text-foreground">{selectedIds.size}</strong> selected compan{selectedIds.size === 1 ? "y" : "ies"}. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={e => { e.preventDefault(); executeBulkDelete() }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
        </div>
    )
}

function ColumnsMenu({ columns, activeCols, toggleColumn, resetColumns, setColumns }: { columns: ColumnDef[]; activeCols: ColumnDef[]; toggleColumn: (id: ColId, visible: boolean) => void; resetColumns: () => void; setColumns: (c: ColumnDef[]) => void }) {
    return <Popover><PopoverTrigger asChild><Button variant="outline" size="sm" className="h-9 px-3 gap-2 bg-card text-[13px]"><Columns className="w-4 h-4 text-muted-foreground" /> Columns <span className="text-[11px] text-muted-foreground font-normal">{activeCols.length}/{columns.length}</span></Button></PopoverTrigger><PopoverContent align="end" className="w-72 p-0"><div className="px-4 py-3 border-b border-border flex items-center justify-between"><p className="text-[14px] font-semibold text-foreground">Columns</p><button onClick={resetColumns} className="text-[12px] text-primary hover:text-primary/80 flex items-center gap-1 font-medium"><RotateCcw className="h-3 w-3" /> Reset</button></div><p className="px-4 pt-2 pb-1 text-[11px] text-muted-foreground">Drag to reorder · click eye to toggle</p><div className="max-h-[360px] overflow-y-auto px-2 pb-2 flex flex-col gap-0.5 custom-scrollbar">{columns.map((col, idx) => <div key={col.id} className="flex items-center justify-between pl-1 pr-2 py-2 hover:bg-muted rounded-md group cursor-grab active:cursor-grabbing" draggable onDragStart={e => { e.dataTransfer.setData("colIdx", idx.toString()); e.dataTransfer.effectAllowed = "move" }} onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move" }} onDrop={e => { e.preventDefault(); const fromIdx = parseInt(e.dataTransfer.getData("colIdx")); if (fromIdx === idx) return; const next = [...columns]; const [moved] = next.splice(fromIdx, 1); next.splice(idx, 0, moved); setColumns(next); localStorage.setItem("companies_cols_order", JSON.stringify(next)) }}><div className="flex items-center gap-2 min-w-0"><GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0" /><span className={cn("text-[13px] truncate", col.visible ? "text-foreground font-medium" : "text-muted-foreground line-through")}>{col.label}</span></div><button onClick={e => { e.stopPropagation(); toggleColumn(col.id, !col.visible) }} className="shrink-0 p-1 rounded hover:bg-muted transition-colors">{col.visible ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground/60" />}</button></div>)}</div></PopoverContent></Popover>
}

function DataTable({ loading, companies, paginatedData, activeCols, columns, selectedIds, currentPage, itemsPerPage, sortConfig, toggleSelectAll, toggleSelect, handleSort, renderCellContent, router, handleDelete, setSelectedCompany, setAddOpen, handleAddContact }: any) {
    return <div className="bg-card overflow-hidden flex flex-col min-h-0 flex-1 relative z-0"><div className="overflow-auto flex-1 custom-scrollbar"><Table className="w-full"><TableHeader><TableRow className="border-border hover:bg-transparent"><TableHead className="h-10 px-4 min-w-[40px] max-w-[40px] w-[40px] text-center align-middle sticky left-0 bg-card z-40 shadow-[1px_0_0_0_var(--border)]"><Checkbox checked={paginatedData.length > 0 && selectedIds.size === paginatedData.length} onCheckedChange={toggleSelectAll} aria-label="Select all current page" /></TableHead><TableHead className="h-10 px-2 min-w-[40px] max-w-[40px] w-[40px] text-center align-middle text-[11px] font-semibold text-muted-foreground sticky left-[40px] bg-card z-40 shadow-[1px_0_0_0_var(--border)]">No.</TableHead>{activeCols.map((col: ColumnDef, index: number) => { const isSticky = index < 2; const isLastSticky = index === Math.min(1, activeCols.length - 1); const leftPos = index === 0 ? 80 : (index === 1 ? 80 + activeCols[0].width : undefined); const style: React.CSSProperties = isSticky ? { left: `${leftPos}px`, minWidth: col.width, maxWidth: col.width, width: col.width, boxShadow: isLastSticky ? "inset -1px 0 0 0 var(--border), 5px 0 10px -2px rgba(0,0,0,0.08)" : "inset -1px 0 0 0 var(--border)" } : { minWidth: col.width, maxWidth: col.width, width: col.width }; const sortKey = col.id; const activeSort = sortConfig?.key === sortKey; const SortIcon = activeSort ? (sortConfig.direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown; return <TableHead key={col.id} className={cn("h-10 px-4 align-middle text-[11px] font-semibold tracking-wide text-muted-foreground", isSticky && "sticky bg-card z-40")} style={style}><button onClick={() => handleSort(sortKey)} className={cn("flex items-center gap-1.5 transition-colors", activeSort ? "text-foreground" : "hover:text-foreground")}>{col.label} <SortIcon className={cn("w-3 h-3 shrink-0", activeSort ? "opacity-100 text-primary" : "opacity-35")} /></button></TableHead>})}<TableHead className="h-10 px-4 align-middle min-w-[60px] max-w-[60px] w-[60px] sticky right-0 bg-card z-40 shadow-[-1px_0_0_0_var(--border)]" /></TableRow></TableHeader><TableBody>{loading ? <TableSkeleton rows={10} columns={activeCols.length + 3} /> : companies.length === 0 ? <TableRow><TableCell colSpan={activeCols.length + 3} className="text-center py-20"><EmptyState title="No companies yet" description="Create your first company and begin tracking opportunities." action={<PermissionGate resource="companies" action="create"><Button onClick={() => { setSelectedCompany(null); setAddOpen(true) }}><Plus className="w-4 h-4 mr-2" /> Add company</Button></PermissionGate>} /></TableCell></TableRow> : paginatedData.length === 0 ? <TableRow><TableCell colSpan={activeCols.length + 3} className="text-center py-20"><EmptyState title="No companies match your filters" description="Try changing your search or clearing filters." /></TableCell></TableRow> : paginatedData.map((company: CompanyRow, idx: number) => { const isSelected = selectedIds.has(company.id); return <TableRow key={company.id} onClick={() => router.push(`/companies/${company.id}`)} className="transition-colors cursor-pointer group border-border hover:bg-muted/40"><TableCell className={cn("px-4 py-2 text-center align-middle sticky left-0 z-20 shadow-[1px_0_0_0_var(--border)] transition-colors", isSelected ? "bg-primary/10" : "bg-card group-hover:bg-muted/40")} onClick={e => e.stopPropagation()}><Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(company.id)} aria-label={`Select ${company.name}`} /></TableCell><TableCell className={cn("px-2 py-2 text-center align-middle text-[12px] text-muted-foreground font-medium sticky left-[40px] z-20 shadow-[1px_0_0_0_var(--border)] transition-colors", isSelected ? "bg-primary/10" : "bg-card group-hover:bg-muted/40")}>{(currentPage - 1) * itemsPerPage + idx + 1}</TableCell>{activeCols.map((col: ColumnDef, index: number) => { const isSticky = index < 2; const isLastSticky = index === Math.min(1, activeCols.length - 1); const leftPos = index === 0 ? 80 : (index === 1 ? 80 + activeCols[0].width : undefined); const style: React.CSSProperties = isSticky ? { left: `${leftPos}px`, minWidth: col.width, maxWidth: col.width, width: col.width, boxShadow: isLastSticky ? "inset -1px 0 0 0 var(--border), 5px 0 10px -2px rgba(0,0,0,0.08)" : "inset -1px 0 0 0 var(--border)" } : { minWidth: col.width, maxWidth: col.width, width: col.width }; return <TableCell key={col.id} className={cn("px-4 py-2 align-middle text-[13px] truncate", isSticky ? "sticky z-20 transition-colors" : "text-muted-foreground", isSticky && (isSelected ? "bg-primary/10" : "bg-card group-hover:bg-muted/40"))} style={style}>{renderCellContent(col.id, company)}</TableCell>})}<TableCell className={cn("px-4 py-2 align-middle text-right sticky right-0 z-20 shadow-[-1px_0_0_0_var(--border)] transition-colors", isSelected ? "bg-primary/10" : "bg-card group-hover:bg-muted/40")} onClick={e => e.stopPropagation()}><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" className="h-7 w-7 p-0 hover:bg-muted"><MoreHorizontal className="h-4 w-4 text-muted-foreground" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-44"><PermissionGate resource="companies" action="update"><DropdownMenuItem onClick={() => { setSelectedCompany(company); setAddOpen(true) }}><Pencil className="w-4 h-4 mr-2" /> Edit</DropdownMenuItem></PermissionGate><PermissionGate resource="contacts" action="create"><DropdownMenuItem onClick={() => handleAddContact(company.id)}><Users className="w-4 h-4 mr-2" /> Add contact</DropdownMenuItem></PermissionGate><PermissionGate resource="companies" action="delete"><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(company)}><Trash2 className="w-4 h-4 mr-2" /> Delete</DropdownMenuItem></PermissionGate></DropdownMenuContent></DropdownMenu></TableCell></TableRow> })}</TableBody></Table></div></div>
}

function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
    return <div className="flex flex-col items-center justify-center text-center max-w-sm mx-auto"><div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center border border-border mb-4"><Building2 className="h-6 w-6 text-muted-foreground" /></div><h3 className="text-base font-semibold text-foreground">{title}</h3><p className="text-sm text-muted-foreground mt-1">{description}</p>{action && <div className="mt-5">{action}</div>}</div>
}

