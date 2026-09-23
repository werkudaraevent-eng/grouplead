"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import * as XLSX from "xlsx"
import {
    Briefcase, Building2, Download, Globe, Pencil, Phone,
    Plus, Trash2, Upload, Users, GitMerge,
} from "@/components/icons"
import { toast } from "sonner"

import { createClient } from "@/utils/supabase/client"
import { deleteClientCompaniesAction } from "@/app/actions/company-actions"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
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
import { MergeCompaniesDialog, type MergeCandidate } from "@/features/companies/components/merge-companies-dialog"
import { PermissionGate } from "@/features/users/components/permission-gate"
import { PermissionMenuItem } from "@/components/shared/permission-menu-item"
import { BulkActionBar } from "@/components/shared/bulk-action-bar"
import { FilterBuilder } from "@/components/shared/filter-builder"
import { applyFilters, type FilterDefinition, type FilterValue } from "@/components/shared/filter-builder-types"
import { ListPageHeader } from "@/components/shared/list-page-header"
import { SavedViewsBar, SaveViewButton } from "@/components/shared/saved-views-bar"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { ListToolbar } from "@/components/shared/list-toolbar"
import { ColumnsMenu } from "@/components/shared/columns-menu"
import { ListFooter } from "@/components/shared/list-footer"
import { InitialsAvatar } from "@/components/shared/initials-avatar"
import { NeedsDetailsBadge } from "@/components/shared/status-badge"
import { INDEX_COL, ListEmpty, MENU_COL, RowMenu, SELECT_COL, SortableHead, frozenCell } from "@/components/shared/list-table"
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
    const [companyToDelete, setCompanyToDelete] = React.useState<CompanyRow | null>(null)
    const [importOpen, setImportOpen] = React.useState(false)
    const [mergeOpen, setMergeOpen] = React.useState(false)
    const [mergeCandidates, setMergeCandidates] = React.useState<[MergeCandidate, MergeCandidate] | null>(null)

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
            .is("deleted_at", null)
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
        { field: "phone", label: "Has phone", type: "boolean", defaultOperator: "is_true", accessor: row => Boolean((row as CompanyRow).phone?.trim()) },
        { field: "website", label: "Has website", type: "boolean", defaultOperator: "is_true", accessor: row => Boolean((row as CompanyRow).website?.trim()) },
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
    // A selection belongs to the page it was made on (Gmail): a bulk delete
    // never reaches rows the person cannot see.
    React.useEffect(() => { setSelectedIds(new Set()) }, [currentPage])

    const handleSort = (key: string) => setSortConfig({ key, direction: sortConfig?.key === key && sortConfig.direction === "asc" ? "desc" : "asc" })
    // The header box reads this page's rows, never the size of the set.
    const pageSelected = paginatedData.filter((c) => selectedIds.has(c.id)).length
    const headerChecked: boolean | "indeterminate" =
        paginatedData.length > 0 && pageSelected === paginatedData.length ? true : pageSelected > 0 ? "indeterminate" : false
    const toggleSelectAll = () => {
        setSelectedIds((prev) => {
            const next = new Set(prev)
            if (headerChecked === true) paginatedData.forEach((c) => next.delete(c.id))
            else paginatedData.forEach((c) => next.add(c.id))
            return next
        })
    }
    const toggleSelect = (id: string) => setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
    const resetColumns = () => { setColumns(DEFAULT_COLUMNS); localStorage.removeItem("companies_cols_order") }
    const toggleColumn = (id: ColId, visible: boolean) => { const next = columns.map(c => c.id === id ? { ...c, visible } : c); setColumns(next); localStorage.setItem("companies_cols_order", JSON.stringify(next)) }

    const executeBulkDelete = async () => {
        const ids = Array.from(selectedIds)
        const result = await deleteClientCompaniesAction(ids)
        if (!result.success) { toast.error(result.error || "Failed to delete companies"); return }
        toast.success(`${ids.length} companies deleted`)
        setSelectedIds(new Set())
        setDeleteConfirmOpen(false)
        fetchCompanies()
    }
    // Merge needs exactly two rows. The counts are fetched here rather than
    // carried on every list row, because they only matter at this moment.
    const openMerge = async () => {
        const ids = Array.from(selectedIds)
        if (ids.length !== 2) return
        const picked = companies.filter(c => ids.includes(c.id))
        const counted = await Promise.all(picked.map(async c => {
            const [{ count: leads }, { count: contacts }] = await Promise.all([
                supabase.from("leads").select("id", { count: "exact", head: true }).eq("client_company_id", c.id).is("deleted_at", null),
                supabase.from("contacts").select("id", { count: "exact", head: true }).eq("client_company_id", c.id).is("deleted_at", null),
            ])
            return { id: c.id, name: c.name, industry: c.industry, city: c.city, lead_count: leads ?? 0, contact_count: contacts ?? 0 }
        }))
        setMergeCandidates([counted[0], counted[1]])
        setMergeOpen(true)
    }
    const handleDelete = (company: CompanyRow) => {
        // Open the custom confirm dialog (no native confirm()).
        setCompanyToDelete(company)
    }
    const executeSingleDelete = async () => {
        if (!companyToDelete) return
        const company = companyToDelete
        const result = await deleteClientCompaniesAction([company.id])
        setCompanyToDelete(null)
        if (!result.success) { toast.error(result.error || "Failed to delete company"); return }
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
            case "name": return (
                <div className="flex min-w-0 items-center gap-3">
                    <InitialsAvatar name={company.name} size="md" shape="square" />
                    <div className="min-w-0">
                        <span className="flex items-center gap-2 truncate font-medium text-foreground transition-colors group-hover:text-primary">
                            <span className="truncate">{company.name}</span>
                            {company.needs_enrichment && <NeedsDetailsBadge />}
                        </span>
                        {company.parent?.name && <p className="truncate text-[11px] text-muted-foreground">{company.parent.name}</p>}
                    </div>
                </div>
            )
            case "industry": return company.industry ? <div className="flex items-center gap-2"><Briefcase className="w-3 h-3 text-muted-foreground shrink-0" /><span className="truncate">{company.industry}</span></div> : <span className="text-muted-foreground/60">—</span>
            case "line_industry": return company.line_industry ? <span className="truncate">{company.line_industry}</span> : <span className="text-muted-foreground/60">—</span>
            case "phone": return company.phone ? <div className="flex items-center gap-2"><Phone className="w-3 h-3 text-muted-foreground shrink-0" /><span className="truncate">{formatPhoneDisplay(company.phone)}</span></div> : <span className="text-muted-foreground/60">—</span>
            case "website": return company.website ? <a href={company.website.startsWith("http") ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline" onClick={e => e.stopPropagation()}><Globe className="w-3 h-3 shrink-0" /><span className="truncate">{company.website}</span></a> : <span className="text-muted-foreground/60">—</span>
            case "owner": return company.owner?.full_name ? <div className="flex items-center gap-2"><InitialsAvatar name={company.owner.full_name} src={company.owner.avatar_url} size="xs" /><span className="truncate">{company.owner.full_name}</span></div> : <span className="text-muted-foreground/60">—</span>
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
                <ListPageHeader title="Companies" subtitle="Manage client organisations, accounts, and company-level context." actions={
                    <>
                        {/* Secondary actions beside the primary one, as in Sales Activity. */}
                        <Button variant="outline" size="sm" onClick={() => handleExport(false)} title={`Export ${sortedData.length} companies that match the filters`}>
                            <Download className="h-4 w-4" /> Export{sortedData.length > 0 ? ` (${sortedData.length})` : ""}
                        </Button>
                        <PermissionGate resource="companies" action="create">
                            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                                <Upload className="h-4 w-4" /> Import
                            </Button>
                        </PermissionGate>
                        <PermissionGate resource="companies" action="create">
                            <Button size="sm" onClick={() => { setSelectedCompany(null); setAddOpen(true) }}>
                                <Plus className="h-4 w-4" /> Add company
                            </Button>
                        </PermissionGate>
                    </>
                } />
            </div>

            <div className="shrink-0 px-4 sm:px-6 lg:px-8 empty:hidden"><SavedViewsBar views={listViews.views.map(v => ({ id: v.id, name: v.name, is_default: v.is_default }))} activeViewId={listViews.activeViewId} onSelectView={listViews.selectView} isDirty={listViews.isDirty} onSaveCurrent={listViews.saveCurrent} onSaveAs={listViews.saveAs} onRename={listViews.renameView} onDelete={listViews.deleteView} onMakeDefault={listViews.makeDefault} className="mb-2" /></div>

            <div className="shrink-0 border-b border-border px-4 pb-4 sm:px-6 lg:px-8">
                <ListToolbar
                    search={{ value: searchQuery, onChange: setSearchQuery, placeholder: "Search by company, sector, phone, or website", "aria-label": "Search companies" }}
                    filters={{ definitions: filterDefinitions, value: filters, onChange: setFilters }}
                    actions={
                        <>
                            {(filters.length > 0 || sortConfig !== null || searchQuery.trim() !== "") && <SaveViewButton onSaveAs={listViews.saveAs} />}
                            <ColumnsMenu columns={columns} onChange={setColumns} onReset={resetColumns} storageKey="companies_cols_order" />
                        </>
                    }
                />
            </div>

            <DataTable loading={loading} companies={companies} paginatedData={paginatedData} activeCols={activeCols} selectedIds={selectedIds} currentPage={currentPage} itemsPerPage={itemsPerPage} sortConfig={sortConfig} headerChecked={headerChecked} onClearFilters={() => { setSearchQuery(""); setFilters([]) }} toggleSelectAll={toggleSelectAll} toggleSelect={toggleSelect} handleSort={handleSort} renderCellContent={renderCellContent} router={router} handleDelete={handleDelete} setSelectedCompany={setSelectedCompany} setAddOpen={setAddOpen} handleAddContact={handleAddContact} />

            <ListFooter total={filteredData.length} page={currentPage} perPage={itemsPerPage} onPageChange={setCurrentPage} onPerPageChange={setItemsPerPage} noun="companies" />

            <BulkActionBar count={selectedIds.size} onClear={() => setSelectedIds(new Set())}><Button variant="ghost" size="sm" onClick={() => handleExport(true)} className="h-7 px-2.5 text-background/90 hover:text-background hover:bg-background/10 text-xs"><Download className="h-3.5 w-3.5 mr-1" /> Export</Button>{selectedIds.size === 2 && <PermissionGate resource="companies" action="delete"><Button variant="ghost" size="sm" onClick={openMerge} className="h-7 px-2.5 text-background/90 hover:text-background hover:bg-background/10 text-xs"><GitMerge className="h-3.5 w-3.5 mr-1" /> Merge</Button></PermissionGate>}<PermissionGate resource="companies" action="delete"><Button variant="ghost" size="sm" onClick={() => setDeleteConfirmOpen(true)} className="h-7 px-2.5 text-background/90 hover:text-background hover:bg-background/10 text-xs"><Trash2 className="h-3.5 w-3.5 mr-1" /> Delete</Button></PermissionGate></BulkActionBar>

            <AddCompanyModal open={addOpen} onOpenChange={setAddOpen} initialData={selectedCompany} onCreated={fetchCompanies} />
            <CompanyDetailSheet company={selectedCompany} open={sheetOpen} onOpenChange={setSheetOpen} onAddContact={handleAddContact} />
            <AddContactModal isOpen={addContactOpen} onOpenChange={setAddContactOpen} preselectedCompanyId={addContactCompanyId} onSuccess={() => { setAddContactOpen(false); fetchCompanies() }} />
            <ImportCompaniesModal open={importOpen} onOpenChange={setImportOpen} onSuccess={fetchCompanies} />
            <MergeCompaniesDialog open={mergeOpen} onOpenChange={setMergeOpen} candidates={mergeCandidates} onMerged={() => { setSelectedIds(new Set()); fetchCompanies() }} />
            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Move to Recycle Bin?</AlertDialogTitle><AlertDialogDescription>This will move <strong className="text-foreground">{selectedIds.size}</strong> selected compan{selectedIds.size === 1 ? "y" : "ies"} to the Recycle Bin. An admin can restore them later.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={e => { e.preventDefault(); executeBulkDelete() }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Move to Recycle Bin</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
            <AlertDialog open={!!companyToDelete} onOpenChange={(o) => { if (!o) setCompanyToDelete(null) }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Move to Recycle Bin?</AlertDialogTitle><AlertDialogDescription>This will move <strong className="text-foreground">{companyToDelete?.name}</strong> to the Recycle Bin. An admin can restore it later.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={e => { e.preventDefault(); executeSingleDelete() }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Move to Recycle Bin</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
        </div>
    )
}

function DataTable({ loading, companies, paginatedData, activeCols, selectedIds, currentPage, itemsPerPage, sortConfig, headerChecked, onClearFilters, toggleSelectAll, toggleSelect, handleSort, renderCellContent, router, handleDelete, setSelectedCompany, setAddOpen, handleAddContact }: {
    loading: boolean
    companies: CompanyRow[]
    paginatedData: CompanyRow[]
    activeCols: ColumnDef[]
    selectedIds: Set<string>
    currentPage: number
    itemsPerPage: number
    sortConfig: { key: string; direction: "asc" | "desc" } | null
    headerChecked: boolean | "indeterminate"
    onClearFilters: () => void
    toggleSelectAll: () => void
    toggleSelect: (id: string) => void
    handleSort: (key: string) => void
    renderCellContent: (colId: ColId, company: CompanyRow) => React.ReactNode
    router: ReturnType<typeof useRouter>
    handleDelete: (company: CompanyRow) => void
    setSelectedCompany: (company: CompanyRow | null) => void
    setAddOpen: (open: boolean) => void
    handleAddContact: (companyId: string) => void
}) {
    return (
        <div className="relative z-0 flex min-h-0 flex-1 flex-col overflow-hidden bg-card">
            <div className="custom-scrollbar flex-1 overflow-auto">
                <Table className="w-full">
                    <TableHeader>
                        <TableRow className="hover:[&_td]:bg-transparent">
                            <TableHead className="sticky left-0 z-10 px-3 text-center" style={{ width: SELECT_COL, minWidth: SELECT_COL, maxWidth: SELECT_COL }}>
                                <Checkbox checked={headerChecked} onCheckedChange={toggleSelectAll} aria-label="Select all on this page" />
                            </TableHead>
                            <TableHead className="sticky z-10 px-2 text-center" style={{ left: SELECT_COL, width: INDEX_COL, minWidth: INDEX_COL, maxWidth: INDEX_COL }}>No.</TableHead>
                            {activeCols.map((col, index) => {
                                const frozen = frozenCell(index, activeCols)
                                const activeSort = sortConfig?.key === col.id
                                return <SortableHead key={col.id} label={col.label} active={activeSort} direction={activeSort ? sortConfig?.direction : undefined} onSort={() => handleSort(col.id)} className={frozen.className} style={frozen.style} />
                            })}
                            <TableHead className="sticky right-0 z-10" style={{ width: MENU_COL, minWidth: MENU_COL, maxWidth: MENU_COL }}>
                                <span className="sr-only">Actions</span>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableSkeleton rows={10} columns={activeCols.length + 3} />
                        ) : companies.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={activeCols.length + 3} className="h-auto">
                                    <ListEmpty icon={Building2} title="No companies yet" description="Create your first company and begin tracking opportunities." action={<PermissionGate resource="companies" action="create"><Button onClick={() => { setSelectedCompany(null); setAddOpen(true) }}><Plus className="mr-2 h-4 w-4" /> Add company</Button></PermissionGate>} />
                                </TableCell>
                            </TableRow>
                        ) : paginatedData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={activeCols.length + 3} className="h-auto">
                                    <ListEmpty icon={Building2} title="No companies match your filters" description="Try changing your search or clearing filters." action={<Button variant="outline" onClick={onClearFilters}>Clear filters</Button>} />
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedData.map((company, idx) => {
                                const isSelected = selectedIds.has(company.id)
                                return (
                                    <TableRow key={company.id} data-state={isSelected ? "selected" : undefined} onClick={() => router.push(`/companies/${company.id}`)} className="cursor-pointer">
                                        <TableCell className="sticky left-0 z-10 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                            <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(company.id)} aria-label={`Select ${company.name}`} />
                                        </TableCell>
                                        <TableCell className="sticky z-10 px-2 text-center text-xs text-muted-foreground tabular-nums" style={{ left: SELECT_COL }}>
                                            {(currentPage - 1) * itemsPerPage + idx + 1}
                                        </TableCell>
                                        {activeCols.map((col, index) => {
                                            const frozen = frozenCell(index, activeCols)
                                            return (
                                                <TableCell key={col.id} className={cn("truncate", frozen.className, index >= 2 && "text-muted-foreground")} style={frozen.style}>
                                                    {renderCellContent(col.id, company)}
                                                </TableCell>
                                            )
                                        })}
                                        <TableCell className="sticky right-0 z-10 px-2 text-right" onClick={(e) => e.stopPropagation()}>
                                            <RowMenu label={`Actions for ${company.name}`}>
                                                <PermissionMenuItem resource="companies" action="update" onClick={() => { setSelectedCompany(company); setAddOpen(true) }}><Pencil className="mr-2 h-4 w-4" /> Edit</PermissionMenuItem>
                                                <PermissionMenuItem resource="contacts" action="create" onClick={() => handleAddContact(company.id)}><Users className="mr-2 h-4 w-4" /> Add contact</PermissionMenuItem>
                                                <DropdownMenuSeparator />
                                                <PermissionMenuItem resource="companies" action="delete" className="text-destructive focus:text-destructive" onClick={() => handleDelete(company)}><Trash2 className="mr-2 h-4 w-4" /> Delete</PermissionMenuItem>
                                            </RowMenu>
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
