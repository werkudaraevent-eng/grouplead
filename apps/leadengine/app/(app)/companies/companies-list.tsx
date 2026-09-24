"use client"

import * as React from "react"
import Link from "next/link"
import * as XLSX from "xlsx"
import {
    Briefcase, Building2, Download, Globe, Pencil, Phone,
    Plus, Trash2, Upload, Users, GitMerge,
} from "@/components/icons"
import { toast } from "sonner"

import { companyFilterOptionsAction, exportCompaniesAction, listCompaniesPageAction } from "@/app/actions/list-page-actions"
import { deleteClientCompaniesAction } from "@/app/actions/company-actions"
import { createClient } from "@/utils/supabase/client"
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
import { PermissionGate, useCan } from "@/features/users/components/permission-gate"
import { PermissionMenuItem } from "@/components/shared/permission-menu-item"
import { BulkActionBar } from "@/components/shared/bulk-action-bar"
import type { FilterDefinition, FilterValue } from "@/components/shared/filter-builder-types"
import { ListPageHeader } from "@/components/shared/list-page-header"
import type { ChromeMenuItem } from "@/components/layout/page-chrome"
import { FAB_CLEARANCE, Fab } from "@/components/layout/fab"
import { listIntroKey } from "@/lib/hints/hint-key"
import { SavedViewsBar, ViewsMenu } from "@/components/shared/saved-views-bar"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { ListControls, ListToolbar } from "@/components/shared/list-toolbar"
import { ColumnsMenu } from "@/components/shared/columns-menu"
import { ListFooter } from "@/components/shared/list-footer"
import { InitialsAvatar } from "@/components/shared/initials-avatar"
import { NeedsDetailsMark } from "@/components/shared/status-badge"
import { RecordCard } from "@/components/shared/record-card"
import { ListCardSkeleton, ListEmpty, MENU_CELL, MENU_COL, RowMenu, SELECT_COL, SortableHead, frozenCell, nextSort } from "@/components/shared/list-table"
import { useCompany } from "@/contexts/company-context"
import { useListOptions, useListPage } from "@/hooks/use-list-page"
import { useListUrl } from "@/hooks/use-list-url"
import { useListViews } from "@/hooks/use-list-views"
import { useRowLink } from "@/hooks/use-row-link"
import { COMPANY_LIST, type CompanyListRow } from "@/lib/lists/company-list"
import { urlSpecOf } from "@/lib/lists/list-plan"
import {
    EMPTY_LIST_STATE,
    clearedState,
    columnsKey,
    countActive,
    isPlainState,
    lastPage,
    stateFromViewConfig,
    viewConfigKey,
    withFilters,
    withPage,
    withSearch,
    withSize,
    withSort,
    type PageSize,
} from "@/lib/lists/list-state"
import type { SortState } from "@/lib/list-sort"
import { formatPhoneDisplay } from "@/lib/phone-normalize"
import { cn } from "@/lib/utils"
import { getScopedCompanyId } from "@/utils/supabase/scoped-query"

type CompanyRow = CompanyListRow

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

const COLUMNS_KEY = "companies_cols_order"
const SPEC = urlSpecOf(COMPANY_LIST)
const NO_SELECTION: ReadonlySet<string> = new Set()
const fmt = (n: number) => n.toLocaleString("en-US")

/** Stored or saved columns, kept in their order, with columns added since appended. */
function mergeColumns(stored: unknown): ColumnDef[] {
    if (!Array.isArray(stored)) return DEFAULT_COLUMNS
    const known = (stored as Partial<ColumnDef>[])
        .map((p) => {
            const base = DEFAULT_COLUMNS.find((d) => d.id === p?.id)
            return base ? { ...base, visible: p.visible !== false } : null
        })
        .filter((c): c is ColumnDef => c !== null)
    const missing = DEFAULT_COLUMNS.filter((d) => !known.some((m) => m.id === d.id))
    return [...known, ...missing]
}

function persistColumns(columns: ColumnDef[]) {
    try {
        localStorage.setItem(COLUMNS_KEY, JSON.stringify(columns))
    } catch {
        // Storage unavailable: the order still applies for this visit.
    }
}

interface CompaniesViewConfig {
    filters: FilterValue[]
    sort: SortState
    columns: ColumnDef[]
    itemsPerPage: number
    searchQuery: string
}

export function CompaniesList({ fresh, introSeen }: { fresh: boolean; /** Whether this person has dismissed the list's description. */ introSeen: boolean }) {
    const rowLink = useRowLink()
    const supabase = React.useMemo(() => createClient(), [])
    const { activeCompany } = useCompany()
    const scope = getScopedCompanyId(activeCompany)
    const { state, query, update } = useListUrl("companies", SPEC)
    const list = useListPage(listCompaniesPageAction, query, scope, "Failed to load company data")
    const { options, reload: reloadOptions } = useListOptions(companyFilterOptionsAction, scope)
    const rows = list.rows

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
    const [exporting, setExporting] = React.useState(false)
    const [columns, setColumns] = React.useState<ColumnDef[]>(DEFAULT_COLUMNS)

    // A selection belongs to the page it was made on (Gmail): any change to
    // the page, the filters, the sort or the unit leaves it behind, so a
    // bulk delete or a merge never reaches rows the person cannot see.
    const selectionKey = `${scope ?? ""}|${query}`
    const [selection, setSelection] = React.useState<{ key: string; ids: Set<string> }>({ key: "", ids: new Set() })
    const selectedIds = selection.key === selectionKey ? selection.ids : NO_SELECTION
    const setSelectedIds = (next: (prev: ReadonlySet<string>) => Set<string>) =>
        setSelection((prev) => ({ key: selectionKey, ids: next(prev.key === selectionKey ? prev.ids : NO_SELECTION) }))
    const clearSelection = () => setSelection({ key: "", ids: new Set() })

    React.useEffect(() => {
        let stored: string | null = null
        try {
            stored = localStorage.getItem(COLUMNS_KEY)
        } catch {
            return
        }
        if (!stored) return
        try {
            setColumns(mergeColumns(JSON.parse(stored)))
        } catch {
            setColumns(DEFAULT_COLUMNS)
        }
    }, [])

    // A page past the end (the last rows were deleted, or an old link) steps back to the last page.
    React.useEffect(() => {
        if (list.loaded && !list.pending && rows.length === 0 && state.page > 0) {
            update((s) => withPage(s, lastPage(list.total, s.size)))
        }
    }, [list.loaded, list.pending, rows.length, list.total, state.page, update])

    const reloadAll = React.useCallback(() => {
        list.reload()
        reloadOptions()
    }, [list, reloadOptions])

    const activeCols = React.useMemo(() => columns.filter((c) => c.visible), [columns])

    const filterDefinitions = React.useMemo<FilterDefinition[]>(
        () =>
            COMPANY_LIST.fields.map((f) => ({
                field: f.field,
                label: f.label,
                type: f.type,
                pinned: f.pinned,
                defaultOperator: f.defaultOperator,
                options: f.type === "select" || f.type === "multi-select" ? (options[f.field] ?? []).map((v) => ({ value: v, label: v })) : undefined,
            })),
        [options],
    )

    /* ── URL transitions ── */
    const setSearch = React.useCallback((q: string) => update((s) => withSearch(s, q)), [update])
    const setFilters = React.useCallback((filters: FilterValue[]) => update((s) => withFilters(s, filters)), [update])
    const clearAll = React.useCallback(() => update((s) => clearedState(s)), [update])
    const handleSort = (key: string) => update((s) => withSort(s, nextSort(s.sort, key)))
    const setPage = (page: number) => update((s) => withPage(s, page))
    const setSize = (size: PageSize) => update((s) => withSize(s, size))

    /* ── Saved views: a view is pushed into the URL; "Save view" saves what the URL shows ── */
    const snapshot = React.useCallback((): CompaniesViewConfig => ({
        filters: state.filters,
        sort: state.sort,
        columns,
        itemsPerPage: state.size,
        searchQuery: state.q,
    }), [state, columns])

    const applySnapshot = React.useCallback((config: CompaniesViewConfig) => {
        update({ ...stateFromViewConfig(config, SPEC), page: 0 })
        if (Array.isArray(config.columns)) {
            const merged = mergeColumns(config.columns)
            setColumns(merged)
            persistColumns(merged)
        }
    }, [update])

    const canonical = React.useCallback(
        (config: CompaniesViewConfig) => viewConfigKey({ ...config, columns: mergeColumns(config.columns) }, SPEC),
        [],
    )

    const listViews = useListViews<CompaniesViewConfig>({
        pageKey: "companies",
        snapshot,
        applySnapshot,
        storageKey: "companies_active_view_id",
        canonical,
        applyDefaultOnLoad: fresh && isPlainState(state),
    })

    /* ── Selection ── */
    // The header box reads this page's rows, never the size of the set.
    const pageSelected = rows.filter((c) => selectedIds.has(c.id)).length
    const headerChecked: boolean | "indeterminate" =
        rows.length > 0 && pageSelected === rows.length ? true : pageSelected > 0 ? "indeterminate" : false
    const toggleSelectAll = () => {
        setSelectedIds((prev) => {
            const next = new Set(prev)
            if (headerChecked === true) rows.forEach((c) => next.delete(c.id))
            else rows.forEach((c) => next.add(c.id))
            return next
        })
    }
    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const resetColumns = () => {
        setColumns(DEFAULT_COLUMNS)
        try {
            localStorage.removeItem(COLUMNS_KEY)
        } catch {
            // Nothing stored to forget.
        }
    }

    // The Views menu's "Default view": the list as it first opens (no search,
    // filters or sort, 25 rows, the default columns), no saved view chosen.
    const showDefaultView = () => {
        listViews.clearView()
        update(EMPTY_LIST_STATE)
        resetColumns()
    }

    /* ── Writes ── */
    const executeBulkDelete = async () => {
        const ids = Array.from(selectedIds)
        const result = await deleteClientCompaniesAction(ids)
        if (!result.success) { toast.error(result.error || "Failed to delete companies"); return }
        toast.success(`${ids.length} companies deleted`)
        clearSelection()
        setDeleteConfirmOpen(false)
        reloadAll()
    }
    // Merge needs exactly two rows. The counts are fetched here rather than
    // carried on every list row, because they only matter at this moment.
    const openMerge = async () => {
        const ids = Array.from(selectedIds)
        if (ids.length !== 2) return
        const picked = rows.filter((c) => ids.includes(c.id))
        if (picked.length !== 2) return
        const counted = await Promise.all(picked.map(async (c) => {
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
        reloadAll()
        if (selectedCompany?.id === company.id) setSheetOpen(false)
    }

    /** Every company that matches (up to the export cap), or the ticked rows of this page. */
    const handleExport = async (onlySelected = false) => {
        let source: CompanyRow[]
        if (onlySelected) {
            source = rows.filter((c) => selectedIds.has(c.id))
        } else {
            setExporting(true)
            const result = await exportCompaniesAction({ query, scope })
            setExporting(false)
            if (!result.success || !result.data) {
                toast.error(result.error || "The export could not be prepared")
                return
            }
            source = result.data.rows
            if (result.data.total > source.length) {
                toast.message(`Exported the first ${fmt(source.length)} of ${fmt(result.data.total)} companies. Narrow the filters to export the rest.`)
            }
        }
        const headers = ["ID", "Name", "Parent Company", "Sector", "Line Industry", "Phone", "Website", "Owner", "Address", "City", "Postal Code", "Country", "Created At"]
        const sheetRows = source.map((c) => [c.id, c.name || "", c.parent?.name || "", c.industry || "", c.line_industry || "", c.phone || "", c.website || "", c.owner?.full_name || "", c.address || "", c.city || "", c.postal_code || "", c.country || "", c.created_at ? new Date(c.created_at).toLocaleDateString() : ""])
        const ws = XLSX.utils.aoa_to_sheet([headers, ...sheetRows])
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Companies")
        XLSX.writeFile(wb, `companies_export_${new Date().toISOString().split("T")[0]}.xlsx`)
    }
    const handleAddContact = (companyId: string) => { setAddContactCompanyId(companyId); setAddContactOpen(true) }
    const openAdd = () => { setSelectedCompany(null); setAddOpen(true) }

    const hrefOf = (company: CompanyRow) => `/companies/${company.id}`
    const dash = <span className="text-muted-foreground/60">—</span>

    const renderCellContent = (colId: ColId, company: CompanyRow) => {
        switch (colId) {
            case "name": return (
                <div className="flex min-w-0 items-center gap-3">
                    <InitialsAvatar name={company.name} size="md" shape="square" />
                    <div className="min-w-0">
                        <span className="flex items-center gap-2 truncate font-medium text-foreground">
                            {/* The name is the row's link: keyboard, hover preview, open in a new tab. */}
                            <Link href={hrefOf(company)} prefetch={false} className="truncate transition-colors hover:underline group-hover:text-primary">{company.name}</Link>
                            {company.needs_enrichment && <NeedsDetailsMark />}
                        </span>
                        {company.parent?.name && <p className="truncate text-[11px] text-muted-foreground">{company.parent.name}</p>}
                    </div>
                </div>
            )
            case "industry": return company.industry ? <div className="flex items-center gap-2"><Briefcase className="w-3 h-3 text-muted-foreground shrink-0" /><span className="truncate">{company.industry}</span></div> : dash
            case "line_industry": return company.line_industry ? <span className="truncate">{company.line_industry}</span> : dash
            case "phone": return company.phone ? <div className="flex items-center gap-2"><Phone className="w-3 h-3 text-muted-foreground shrink-0" /><span className="truncate">{formatPhoneDisplay(company.phone)}</span></div> : dash
            case "website": return company.website ? <a href={company.website.startsWith("http") ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline"><Globe className="w-3 h-3 shrink-0" /><span className="truncate">{company.website}</span></a> : dash
            case "owner": return company.owner?.full_name ? <div className="flex items-center gap-2"><InitialsAvatar name={company.owner.full_name} src={company.owner.avatar_url} size="xs" /><span className="truncate">{company.owner.full_name}</span></div> : dash
            case "parent": return company.parent?.name ? <span className="truncate">{company.parent.name}</span> : dash
            case "address": return company.address ? <span className="truncate">{company.address}</span> : dash
            case "city": return company.city ? <span className="truncate">{company.city}</span> : dash
            case "postal_code": return company.postal_code ? <span className="truncate">{company.postal_code}</span> : dash
            case "country": return company.country ? <span className="truncate">{company.country}</span> : dash
            case "created_at": return company.created_at ? new Date(company.created_at).toLocaleDateString() : dash
            default: return null
        }
    }

    const rowMenuItems = (company: CompanyRow) => (
        <>
            <PermissionMenuItem resource="companies" action="update" onClick={() => { setSelectedCompany(company); setAddOpen(true) }}><Pencil className="mr-2 h-4 w-4" /> Edit</PermissionMenuItem>
            <PermissionMenuItem resource="contacts" action="create" onClick={() => handleAddContact(company.id)}><Users className="mr-2 h-4 w-4" /> Add contact</PermissionMenuItem>
            <DropdownMenuSeparator />
            <PermissionMenuItem resource="companies" action="delete" className="text-destructive focus:text-destructive" onClick={() => handleDelete(company)}><Trash2 className="mr-2 h-4 w-4" /> Delete</PermissionMenuItem>
        </>
    )

    const filtered = countActive(state) > 0
    // Worth saving as a view once the list differs from how it first opens.
    const customised = !isPlainState(state) || columnsKey(columns) !== columnsKey(DEFAULT_COLUMNS)
    const exportCount = list.loaded && list.total > 0 ? ` (${fmt(list.total)})` : ""
    const canCreate = useCan("companies", "create")
    const addButton = (className?: string) => (
        <PermissionGate resource="companies" action="create">
            <Button size="sm" className={className} onClick={openAdd}>
                <Plus className="h-4 w-4" /> Add company
            </Button>
        </PermissionGate>
    )
    // Below `lg`: Export and Import behind the top app bar's ⋮, Add as the FAB.
    const phoneMenu: ChromeMenuItem[] = [
        { label: exporting ? "Exporting…" : `Export${exportCount}`, icon: Download, onSelect: () => { if (!exporting) handleExport(false) } },
        ...(canCreate ? [{ label: "Import", icon: Upload, onSelect: () => setImportOpen(true) }] : []),
    ]

    const empty: React.ReactNode = !list.loaded
        ? list.failed
            ? <ListEmpty icon={Building2} title="Companies could not be loaded" description="Check your connection and try again." action={<Button variant="outline" onClick={list.reload}>Try again</Button>} />
            : null
        : rows.length > 0 || state.page > 0
            ? null // a page past the end steps back (above) before anything is said
            : !filtered
                ? <ListEmpty icon={Building2} title="No companies yet" description="Create your first company and begin tracking opportunities." action={addButton()} />
                : <ListEmpty icon={Building2} title="No companies match your filters" description="Try changing your search or clearing filters." action={<Button variant="outline" onClick={clearAll}>Clear filters</Button>} />

    return (
        // Opts out of the shell's 900px floor: built for a phone's own width
        // (cards below md, the table scrolls inside its own box above it).
        // Below `lg` it ends clear of the FAB, so the last card and the pager are never under it.
        <div data-fluid-page className={cn("flex w-full flex-col bg-background md:h-full md:overflow-hidden", canCreate && FAB_CLEARANCE)}>
            {/* One compact row; the description under it only until dismissed.
                Below `lg` the phone shell carries it (title, ⋮, FAB). */}
            <div className="shrink-0 px-4 max-lg:hidden sm:px-6 md:has-[p]:pb-3 lg:px-8">
                <ListPageHeader title="Companies" subtitle="Manage client organisations, accounts, and company-level context." intro={{ key: listIntroKey("companies"), seen: introSeen }} phoneMenu={phoneMenu} actions={
                    <>
                        {/* Secondary actions beside the primary one, as in Sales Activity. */}
                        <Button variant="outline" size="sm" onClick={() => handleExport(false)} disabled={exporting} title={`Export ${fmt(list.total)} companies that match the filters`}>
                            <Download className="h-4 w-4" /> {exporting ? "Exporting…" : `Export${exportCount}`}
                        </Button>
                        <PermissionGate resource="companies" action="create">
                            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                                <Upload className="h-4 w-4" /> Import
                            </Button>
                        </PermissionGate>
                        {addButton()}
                    </>
                } />
            </div>

            {/* The controls: on a desk the toolbar's band over the table; on a
                phone one block that scrolls away reading down and returns,
                pinned under the top app bar, on the first scroll up. */}
            <ListControls>
                {/* Phone: the saved views as chips above the search. On a desk they are
                    chosen from the Views menu in the toolbar, so the table never moves
                    down when a view is saved. */}
                <div className="empty:hidden md:hidden">
                    <SavedViewsBar views={listViews.views.map((v) => ({ id: v.id, name: v.name, is_default: v.is_default }))} activeViewId={listViews.activeViewId} onSelectView={listViews.selectView} isDirty={listViews.isDirty} onSaveCurrent={listViews.saveCurrent} onSaveAs={listViews.saveAs} onRename={listViews.renameView} onDelete={listViews.deleteView} onMakeDefault={listViews.makeDefault} />
                </div>
                <ListToolbar
                    search={{ value: state.q, onChange: setSearch, placeholder: "Search by company, sector, phone, or website", "aria-label": "Search companies" }}
                    filters={{ definitions: filterDefinitions, value: state.filters, onChange: setFilters, onClearAll: clearAll }}
                    actions={
                        <>
                            <ViewsMenu views={listViews} customised={customised} onChooseDefault={showDefaultView} />
                            <ColumnsMenu columns={columns} onChange={setColumns} onReset={resetColumns} storageKey={COLUMNS_KEY} />
                        </>
                    }
                />
            </ListControls>

            {/* Desk: the table, frozen select and name columns, scrolling inside its own box. */}
            <div className="relative z-0 hidden min-h-0 flex-1 flex-col overflow-hidden bg-card md:flex">
                <div className={cn("custom-scrollbar flex-1 overflow-auto transition-opacity", list.pending && list.loaded && "opacity-60")} aria-busy={list.pending}>
                    <Table className="w-full">
                        <TableHeader>
                            <TableRow className="hover:[&_td]:bg-transparent">
                                <TableHead className="sticky left-0 z-10 px-3 text-center" style={{ width: SELECT_COL, minWidth: SELECT_COL, maxWidth: SELECT_COL }}>
                                    <Checkbox checked={headerChecked} onCheckedChange={toggleSelectAll} aria-label="Select all on this page" />
                                </TableHead>
                                {activeCols.map((col, index) => {
                                    const frozen = frozenCell(index, activeCols)
                                    const activeSort = state.sort?.key === col.id
                                    return <SortableHead key={col.id} label={col.label} active={activeSort} direction={activeSort ? state.sort?.direction : undefined} onSort={() => handleSort(col.id)} className={frozen.className} style={frozen.style} />
                                })}
                                <TableHead className={MENU_CELL} style={{ width: MENU_COL, minWidth: MENU_COL, maxWidth: MENU_COL }}>
                                    <span className="sr-only">Actions</span>
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {!list.loaded && !list.failed ? (
                                <TableSkeleton rows={10} columns={activeCols.length + 2} />
                            ) : empty ? (
                                <TableRow>
                                    <TableCell colSpan={activeCols.length + 2} className="h-auto">{empty}</TableCell>
                                </TableRow>
                            ) : (
                                rows.map((company) => {
                                    const isSelected = selectedIds.has(company.id)
                                    return (
                                        <TableRow key={company.id} data-state={isSelected ? "selected" : undefined} onClick={rowLink(hrefOf(company))} className="cursor-pointer">
                                            <TableCell className="sticky left-0 z-10 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(company.id)} aria-label={`Select ${company.name}`} />
                                            </TableCell>
                                            {activeCols.map((col, index) => {
                                                const frozen = frozenCell(index, activeCols)
                                                return (
                                                    <TableCell key={col.id} className={cn("truncate", frozen.className, index >= 2 && "text-muted-foreground")} style={frozen.style}>
                                                        {renderCellContent(col.id, company)}
                                                    </TableCell>
                                                )
                                            })}
                                            <TableCell className={cn(MENU_CELL, "px-2 text-right")} onClick={(e) => e.stopPropagation()}>
                                                <RowMenu label={`Actions for ${company.name}`}>{rowMenuItems(company)}</RowMenu>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Phone: one card per company in Sales Activity's anatomy (`RecordCard`):
                the name, sector · line industry · city, phone · website, a hairline,
                then the owner and the ⋮ (Edit, Add contact, Delete). The card opens
                the company. No top padding: the controls above end 12px over the first card. */}
            <div className={cn("px-4 pb-3 transition-opacity md:hidden", list.pending && list.loaded && "opacity-60")} aria-busy={list.pending}>
                {!list.loaded && !list.failed ? (
                    <ListCardSkeleton />
                ) : empty ? (
                    empty
                ) : (
                    <ul className="space-y-3">
                        {rows.map((company) => (
                            <RecordCard
                                key={company.id}
                                href={hrefOf(company)}
                                onOpen={rowLink(hrefOf(company))}
                                name={company.name}
                                mark={company.needs_enrichment && <NeedsDetailsMark />}
                                supporting={[company.industry, company.line_industry, company.city].filter(Boolean).join(" · ")}
                                supportingEmpty="No sector"
                                fact={[company.phone ? formatPhoneDisplay(company.phone) : null, company.website].filter(Boolean).join(" · ")}
                                factEmpty="No phone or website"
                                owner={company.owner}
                                action={<RowMenu label={`Actions for ${company.name}`} className="h-11 w-11 opacity-100">{rowMenuItems(company)}</RowMenu>}
                            />
                        ))}
                    </ul>
                )}
            </div>

            {list.loaded && (
                <ListFooter total={list.total} page={state.page} size={state.size} onPageChange={setPage} onSizeChange={setSize} noun="companies" pending={list.pending} narrowed={filtered} unfiltered={list.unfiltered} />
            )}

            <BulkActionBar count={selectedIds.size} onClear={clearSelection}>
                <Button variant="ghost" size="sm" onClick={() => handleExport(true)} className="h-7 px-2.5 text-background/90 hover:text-background hover:bg-background/10 text-xs"><Download className="h-3.5 w-3.5 mr-1" /> Export</Button>
                {selectedIds.size === 2 && <PermissionGate resource="companies" action="delete"><Button variant="ghost" size="sm" onClick={openMerge} className="h-7 px-2.5 text-background/90 hover:text-background hover:bg-background/10 text-xs"><GitMerge className="h-3.5 w-3.5 mr-1" /> Merge</Button></PermissionGate>}
                <PermissionGate resource="companies" action="delete"><Button variant="ghost" size="sm" onClick={() => setDeleteConfirmOpen(true)} className="h-7 px-2.5 text-background/90 hover:text-background hover:bg-background/10 text-xs"><Trash2 className="h-3.5 w-3.5 mr-1" /> Delete</Button></PermissionGate>
            </BulkActionBar>

            <AddCompanyModal open={addOpen} onOpenChange={setAddOpen} initialData={selectedCompany} onCreated={reloadAll} />
            <CompanyDetailSheet company={selectedCompany} open={sheetOpen} onOpenChange={setSheetOpen} onAddContact={handleAddContact} />
            <AddContactModal isOpen={addContactOpen} onOpenChange={setAddContactOpen} preselectedCompanyId={addContactCompanyId} onSuccess={() => { setAddContactOpen(false); reloadAll() }} />
            <ImportCompaniesModal open={importOpen} onOpenChange={setImportOpen} onSuccess={reloadAll} />
            {canCreate && <Fab label="Add company" onClick={openAdd} />}
            <MergeCompaniesDialog open={mergeOpen} onOpenChange={setMergeOpen} candidates={mergeCandidates} onMerged={() => { clearSelection(); reloadAll() }} />
            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Move to Recycle Bin?</AlertDialogTitle><AlertDialogDescription>This will move <strong className="text-foreground">{selectedIds.size}</strong> selected compan{selectedIds.size === 1 ? "y" : "ies"} to the Recycle Bin. An admin can restore them later.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={e => { e.preventDefault(); executeBulkDelete() }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Move to Recycle Bin</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
            <AlertDialog open={!!companyToDelete} onOpenChange={(o) => { if (!o) setCompanyToDelete(null) }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Move to Recycle Bin?</AlertDialogTitle><AlertDialogDescription>This will move <strong className="text-foreground">{companyToDelete?.name}</strong> to the Recycle Bin. An admin can restore it later.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={e => { e.preventDefault(); executeSingleDelete() }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Move to Recycle Bin</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
        </div>
    )
}
