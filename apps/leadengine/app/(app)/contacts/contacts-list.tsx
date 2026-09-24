"use client"

import * as React from "react"
import Link from "next/link"
import * as XLSX from "xlsx"
import {
    Download, Facebook, Globe, Instagram, Link2,
    Linkedin, Pencil, Plus, Trash2, Twitter, Upload, Users,
} from "@/components/icons"
import { toast } from "sonner"

import { contactFilterOptionsAction, exportContactsAction, listContactsPageAction } from "@/app/actions/list-page-actions"
import { deleteContactsAction } from "@/app/actions/contact-actions"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
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

import { AddContactModal } from "@/features/contacts/components/add-contact-modal"
import { ImportContactsModal } from "@/features/contacts/components/import-contacts-modal"
import { PermissionGate } from "@/features/users/components/permission-gate"
import { PermissionMenuItem } from "@/components/shared/permission-menu-item"
import { BulkActionBar } from "@/components/shared/bulk-action-bar"
import type { FilterDefinition, FilterValue } from "@/components/shared/filter-builder-types"
import { HeaderOverflowMenu, ListPageHeader } from "@/components/shared/list-page-header"
import { listIntroKey } from "@/lib/hints/hint-key"
import { SavedViewsBar, SaveViewButton } from "@/components/shared/saved-views-bar"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { ListToolbar } from "@/components/shared/list-toolbar"
import { ColumnsMenu } from "@/components/shared/columns-menu"
import { ListFooter } from "@/components/shared/list-footer"
import { InitialsAvatar } from "@/components/shared/initials-avatar"
import { NeedsDetailsMark } from "@/components/shared/status-badge"
import { ListCardSkeleton, ListEmpty, MENU_CELL, MENU_COL, RowMenu, SELECT_COL, SortableHead, frozenCell, nextSort } from "@/components/shared/list-table"
import { useCompany } from "@/contexts/company-context"
import { useListOptions, useListPage } from "@/hooks/use-list-page"
import { useListUrl } from "@/hooks/use-list-url"
import { useListViews } from "@/hooks/use-list-views"
import { useRowLink } from "@/hooks/use-row-link"
import { CONTACT_LIST, type ContactListRow } from "@/lib/lists/contact-list"
import { urlSpecOf } from "@/lib/lists/list-plan"
import {
    clearedState,
    countActive,
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

type ContactRow = ContactListRow

type ColId =
    | "owner"
    | "full_name"
    | "company"
    | "job_title"
    | "contact_source"
    | "email"
    | "phone"
    | "secondary_email"
    | "secondary_phone"
    | "address"
    | "date_of_birth"
    | "socials"
    | "notes"

interface ColumnDef {
    id: ColId
    label: string
    visible: boolean
    width: number
}

const DEFAULT_COLUMNS: ColumnDef[] = [
    { id: "full_name", label: "Contact name", visible: true, width: 220 },
    { id: "company", label: "Company", visible: true, width: 180 },
    { id: "job_title", label: "Job title", visible: true, width: 160 },
    { id: "contact_source", label: "Source", visible: false, width: 150 },
    { id: "email", label: "Email", visible: true, width: 200 },
    { id: "phone", label: "Phone", visible: true, width: 160 },
    { id: "owner", label: "Owner", visible: false, width: 160 },
    { id: "secondary_email", label: "Alt email", visible: false, width: 180 },
    { id: "secondary_phone", label: "Alt phone", visible: false, width: 160 },
    { id: "address", label: "Address", visible: false, width: 240 },
    { id: "date_of_birth", label: "Date of birth", visible: false, width: 140 },
    { id: "socials", label: "Social links", visible: false, width: 150 },
    { id: "notes", label: "Notes", visible: false, width: 260 },
]

/** The sort key a column's header sets (as saved views name it); social links have no order. */
const SORT_KEY: Partial<Record<ColId, string>> = {
    full_name: "full_name",
    company: "client_company",
    job_title: "job_title",
    contact_source: "contact_source",
    email: "email",
    phone: "phone",
    owner: "owner",
    secondary_email: "secondary_email",
    secondary_phone: "secondary_phone",
    address: "address",
    date_of_birth: "date_of_birth",
    notes: "notes",
}

const COLUMNS_KEY = "contacts_cols_order"
const SPEC = urlSpecOf(CONTACT_LIST)
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

interface ContactsViewConfig {
    filters: FilterValue[]
    sort: SortState
    columns: ColumnDef[]
    itemsPerPage: number
    searchQuery: string
}

export function ContactsList({ fresh, introSeen }: { fresh: boolean; /** Whether this person has dismissed the list's description. */ introSeen: boolean }) {
    const rowLink = useRowLink()
    const { activeCompany } = useCompany()
    const scope = getScopedCompanyId(activeCompany)
    const { state, query, update } = useListUrl("contacts", SPEC)
    const list = useListPage(listContactsPageAction, query, scope, "Failed to load contacts")
    const { options, reload: reloadOptions } = useListOptions(contactFilterOptionsAction, scope)
    const rows = list.rows

    const [addContactOpen, setAddContactOpen] = React.useState(false)
    const [editingContact, setEditingContact] = React.useState<ContactRow | undefined>()
    const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false)
    const [contactToDelete, setContactToDelete] = React.useState<ContactRow | null>(null)
    const [importOpen, setImportOpen] = React.useState(false)
    const [exporting, setExporting] = React.useState(false)
    const [columns, setColumns] = React.useState<ColumnDef[]>(DEFAULT_COLUMNS)

    // A selection belongs to the page it was made on (Gmail): any change to
    // the page, the filters, the sort or the unit leaves it behind, so a
    // bulk delete never reaches rows the person cannot see.
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
            CONTACT_LIST.fields.map((f) => ({
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
    const snapshot = React.useCallback((): ContactsViewConfig => ({
        filters: state.filters,
        sort: state.sort,
        columns,
        itemsPerPage: state.size,
        searchQuery: state.q,
    }), [state, columns])

    const applySnapshot = React.useCallback((config: ContactsViewConfig) => {
        update({ ...stateFromViewConfig(config, SPEC), page: 0 })
        if (Array.isArray(config.columns)) {
            const merged = mergeColumns(config.columns)
            setColumns(merged)
            persistColumns(merged)
        }
    }, [update])

    const canonical = React.useCallback(
        (config: ContactsViewConfig) => viewConfigKey({ ...config, columns: mergeColumns(config.columns) }, SPEC),
        [],
    )

    const listViews = useListViews<ContactsViewConfig>({
        pageKey: "contacts",
        snapshot,
        applySnapshot,
        storageKey: "contacts_active_view_id",
        canonical,
        applyDefaultOnLoad: fresh && countActive(state) === 0 && state.sort === null,
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

    /* ── Writes ── */
    const executeBulkDelete = async () => {
        const ids = Array.from(selectedIds)
        const result = await deleteContactsAction(ids)
        if (!result.success) {
            toast.error(result.error || "Failed to delete contacts")
            setDeleteConfirmOpen(false)
            return
        }
        toast.success(`${ids.length} contacts deleted`)
        clearSelection()
        setDeleteConfirmOpen(false)
        reloadAll()
    }

    const handleDelete = (contact: ContactRow) => {
        // Open the custom confirm dialog (no native confirm()).
        setContactToDelete(contact)
    }
    const executeSingleDelete = async () => {
        if (!contactToDelete) return
        const result = await deleteContactsAction([contactToDelete.id])
        setContactToDelete(null)
        if (!result.success) {
            console.warn("[Contact Delete]:", result.error)
            toast.error(result.error || "Failed to delete contact")
            return
        }
        toast.success("Contact deleted")
        reloadAll()
    }

    /** Every contact that matches (up to the export cap), or the ticked rows of this page. */
    const handleExport = async (onlySelected = false) => {
        let source: ContactRow[]
        if (onlySelected) {
            source = rows.filter((c) => selectedIds.has(c.id))
        } else {
            setExporting(true)
            const result = await exportContactsAction({ query, scope })
            setExporting(false)
            if (!result.success || !result.data) {
                toast.error(result.error || "The export could not be prepared")
                return
            }
            source = result.data.rows
            if (result.data.total > source.length) {
                toast.message(`Exported the first ${fmt(source.length)} of ${fmt(result.data.total)} contacts. Narrow the filters to export the rest.`)
            }
        }
        const headers = ["ID", "Name", "Job Title", "Contact Source", "Company", "Email", "Phone", "Owner", "Notes"]
        const sheetRows = source.map((c) => [
            c.id,
            c.full_name || "",
            c.job_title || "",
            c.contact_source || "",
            c.client_company?.name || "",
            c.email || "",
            c.phone || "",
            c.owner?.full_name || "",
            (c.notes || "").replace(/\n/g, " "),
        ])
        const ws = XLSX.utils.aoa_to_sheet([headers, ...sheetRows])
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Contacts")
        XLSX.writeFile(wb, `contacts_export_${new Date().toISOString().split("T")[0]}.xlsx`)
    }

    const openEditSheet = (contact: ContactRow) => {
        setEditingContact(contact)
        setAddContactOpen(true)
    }

    const resetColumns = () => {
        setColumns(DEFAULT_COLUMNS)
        try {
            localStorage.removeItem(COLUMNS_KEY)
        } catch {
            // Nothing stored to forget.
        }
    }

    const hrefOf = (contact: ContactRow) => `/contacts/${contact.id}`
    const nameOf = (contact: ContactRow) => (contact.salutation ? `${contact.salutation} ${contact.full_name}` : contact.full_name)
    const dash = <span className="text-muted-foreground/60">—</span>

    const renderCellContent = (colId: ColId, contact: ContactRow) => {
        switch (colId) {
            case "owner":
                return contact.owner?.full_name ? (
                    <div className="flex items-center gap-2 min-w-0">
                        <InitialsAvatar name={contact.owner.full_name} src={contact.owner.avatar_url} size="xs" />
                        <span className="truncate">{contact.owner.full_name}</span>
                    </div>
                ) : dash
            case "full_name":
                return (
                    <div className="flex items-center gap-3 min-w-0">
                        <InitialsAvatar name={contact.full_name} size="sm" />
                        {/* The name is the row's link: keyboard, hover preview, open in a new tab. */}
                        <Link href={hrefOf(contact)} prefetch={false} className="truncate font-medium text-foreground transition-colors hover:underline group-hover:text-primary">
                            {nameOf(contact)}
                        </Link>
                        {contact.needs_enrichment && <NeedsDetailsMark />}
                    </div>
                )
            case "company":
                return contact.client_company?.name ? <span className="truncate">{contact.client_company.name}</span> : dash
            case "job_title":
                return contact.job_title ? <span className="truncate">{contact.job_title}</span> : dash
            case "contact_source":
                return contact.contact_source ? <span className="truncate">{contact.contact_source}</span> : dash
            case "email":
                return contact.email ? <span className="truncate hover:text-primary transition-colors">{contact.email}</span> : dash
            case "phone":
                return contact.phone ? <span className="truncate hover:text-primary transition-colors">{formatPhoneDisplay(contact.phone)}</span> : dash
            case "secondary_email":
                return contact.secondary_email ? contact.secondary_email : (contact.secondary_emails?.[0] || dash)
            case "secondary_phone": {
                const sp = contact.secondary_phone || contact.secondary_phones?.[0]
                return sp ? formatPhoneDisplay(sp) : dash
            }
            case "address":
                return contact.address || dash
            case "date_of_birth":
                return contact.date_of_birth ? new Date(contact.date_of_birth).toLocaleDateString() : dash
            case "socials": {
                const links: { platform: string; url: string }[] = []
                if (contact.linkedin_url) links.push({ platform: "LinkedIn", url: contact.linkedin_url })
                if (Array.isArray(contact.social_urls)) {
                    contact.social_urls.forEach((s) => {
                        if (s.url && s.url !== contact.linkedin_url) links.push(s)
                    })
                }
                if (links.length === 0) return dash
                return (
                    <div className="flex flex-wrap items-center gap-1.5" data-row-link-ignore>
                        {links.map((link, i) => {
                            const p = link.platform.toLowerCase()
                            const Icon = p.includes("linkedin") ? Linkedin : p.includes("twitter") ? Twitter : p.includes("instagram") ? Instagram : p.includes("facebook") ? Facebook : p.includes("website") ? Globe : Link2
                            return (
                                <a key={i} href={link.url.startsWith("http") ? link.url : `https://${link.url}`} target="_blank" rel="noreferrer" title={link.platform} className="text-muted-foreground hover:text-primary transition-colors p-1 border border-border rounded-md bg-muted/40 hover:bg-primary/5 hover:border-primary/20">
                                    <Icon className="w-3.5 h-3.5" />
                                </a>
                            )
                        })}
                    </div>
                )
            }
            case "notes":
                return contact.notes || dash
            default:
                return null
        }
    }

    const rowMenuItems = (contact: ContactRow) => (
        <>
            <PermissionMenuItem resource="contacts" action="update" onClick={() => openEditSheet(contact)}><Pencil className="mr-2 h-4 w-4" /> Edit</PermissionMenuItem>
            <DropdownMenuSeparator />
            <PermissionMenuItem resource="contacts" action="delete" className="text-destructive focus:text-destructive" onClick={() => handleDelete(contact)}><Trash2 className="mr-2 h-4 w-4" /> Delete</PermissionMenuItem>
        </>
    )

    const filtered = countActive(state) > 0
    const selectedCount = selectedIds.size
    // Worth saving as a view once the list is no longer the default one.
    const customised = filtered || state.sort !== null
    const exportCount = list.loaded && list.total > 0 ? ` (${fmt(list.total)})` : ""
    const addButton = (className?: string) => (
        <PermissionGate resource="contacts" action="create">
            <Button size="sm" className={className} onClick={() => setAddContactOpen(true)}>
                <Plus className="h-4 w-4" /> Add contact
            </Button>
        </PermissionGate>
    )

    const empty: React.ReactNode = !list.loaded
        ? list.failed
            ? <ListEmpty icon={Users} title="Contacts could not be loaded" description="Check your connection and try again." action={<Button variant="outline" onClick={list.reload}>Try again</Button>} />
            : null
        : rows.length > 0 || state.page > 0
            ? null // a page past the end steps back (above) before anything is said
            : !filtered
                ? <ListEmpty icon={Users} title="No contacts yet" description="Create your first contact and link them to a client company." action={addButton()} />
                : <ListEmpty icon={Users} title="No contacts match your filters" description="Try changing your search or clearing filters." action={<Button variant="outline" onClick={clearAll}>Clear filters</Button>} />

    return (
        // Opts out of the shell's 900px floor: built for a phone's own width
        // (cards below md, the table scrolls inside its own box above it).
        <div data-fluid-page className="flex w-full flex-col bg-background md:h-full md:overflow-hidden">
            {/* One compact row; the description under it only until dismissed. */}
            <div className="shrink-0 px-4 pb-2 sm:px-6 md:pb-0 md:has-[p]:pb-3 lg:px-8">
                <ListPageHeader
                    title="Contacts"
                    subtitle="Manage client contacts, vendors, and associates."
                    intro={{ key: listIntroKey("contacts"), seen: introSeen }}
                    actions={
                        <>
                            {/* Secondary actions as labelled outlined buttons beside the
                                primary one, the way Sales Activity's lists carry them. */}
                            <div className="hidden items-center gap-2 md:flex">
                                <Button variant="outline" size="sm" onClick={() => handleExport(false)} disabled={exporting} title={`Export ${fmt(list.total)} contacts that match the filters`}>
                                    <Download className="h-4 w-4" /> {exporting ? "Exporting…" : `Export${exportCount}`}
                                </Button>
                                <PermissionGate resource="contacts" action="create">
                                    <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                                        <Upload className="h-4 w-4" /> Import
                                    </Button>
                                </PermissionGate>
                                {addButton()}
                            </div>
                            {/* On a phone: Add stays a button, Export and Import go behind ⋮. */}
                            <div className="flex items-center gap-2 md:hidden">
                                {addButton("h-11")}
                                <HeaderOverflowMenu>
                                    <DropdownMenuItem disabled={exporting} onSelect={() => handleExport(false)}>
                                        <Download className="mr-2 h-4 w-4" /> Export{exportCount}
                                    </DropdownMenuItem>
                                    <PermissionGate resource="contacts" action="create">
                                        <DropdownMenuItem onSelect={() => setImportOpen(true)}>
                                            <Upload className="mr-2 h-4 w-4" /> Import
                                        </DropdownMenuItem>
                                    </PermissionGate>
                                </HeaderOverflowMenu>
                            </div>
                        </>
                    }
                />
            </div>

            <div className="shrink-0 px-4 sm:px-6 lg:px-8 empty:hidden">
                <SavedViewsBar
                    views={listViews.views.map((v) => ({ id: v.id, name: v.name, is_default: v.is_default }))}
                    activeViewId={listViews.activeViewId}
                    onSelectView={listViews.selectView}
                    isDirty={listViews.isDirty}
                    onSaveCurrent={listViews.saveCurrent}
                    onSaveAs={listViews.saveAs}
                    onRename={listViews.renameView}
                    onDelete={listViews.deleteView}
                    onMakeDefault={listViews.makeDefault}
                    className="mb-3"
                />
            </div>

            <div className="shrink-0 border-b border-border px-4 pb-4 sm:px-6 lg:px-8">
                <ListToolbar
                    search={{ value: state.q, onChange: setSearch, placeholder: "Search by name, email, phone, or company", "aria-label": "Search contacts" }}
                    filters={{ definitions: filterDefinitions, value: state.filters, onChange: setFilters, onClearAll: clearAll }}
                    actions={
                        <>
                            {customised && <SaveViewButton onSaveAs={listViews.saveAs} />}
                            <ColumnsMenu columns={columns} onChange={setColumns} onReset={resetColumns} storageKey={COLUMNS_KEY} />
                        </>
                    }
                />
            </div>

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
                                    const sortKey = SORT_KEY[col.id]
                                    if (!sortKey) {
                                        return <TableHead key={col.id} className={frozen.className} style={frozen.style}>{col.label}</TableHead>
                                    }
                                    const activeSort = state.sort?.key === sortKey
                                    return (
                                        <SortableHead
                                            key={col.id}
                                            label={col.label}
                                            active={activeSort}
                                            direction={activeSort ? state.sort?.direction : undefined}
                                            onSort={() => handleSort(sortKey)}
                                            className={frozen.className}
                                            style={frozen.style}
                                        />
                                    )
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
                                rows.map((contact) => {
                                    const isSelected = selectedIds.has(contact.id)
                                    return (
                                        <TableRow key={contact.id} data-state={isSelected ? "selected" : undefined} onClick={rowLink(hrefOf(contact))} className="cursor-pointer">
                                            <TableCell className="sticky left-0 z-10 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(contact.id)} aria-label={`Select ${contact.full_name}`} />
                                            </TableCell>
                                            {activeCols.map((col, index) => {
                                                const frozen = frozenCell(index, activeCols)
                                                return (
                                                    <TableCell key={col.id} className={cn("truncate", frozen.className, index >= 2 && "text-muted-foreground")} style={frozen.style} title={col.id === "notes" ? contact.notes || "" : col.id === "address" ? contact.address || "" : ""}>
                                                        {renderCellContent(col.id, contact)}
                                                    </TableCell>
                                                )
                                            })}
                                            <TableCell className={cn(MENU_CELL, "px-2 text-right")} onClick={(e) => e.stopPropagation()}>
                                                <RowMenu label={`Actions for ${contact.full_name}`}>{rowMenuItems(contact)}</RowMenu>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Phone: one card per contact; the card opens the contact, the ⋮ holds Edit and Delete. */}
            <div className={cn("px-4 py-3 transition-opacity md:hidden", list.pending && list.loaded && "opacity-60")} aria-busy={list.pending}>
                {!list.loaded && !list.failed ? (
                    <ListCardSkeleton />
                ) : empty ? (
                    empty
                ) : (
                    <ul className="space-y-2">
                        {rows.map((contact) => {
                            const line2 = [contact.client_company?.name, contact.job_title].filter(Boolean).join(" · ")
                            const line3 = [contact.email, contact.phone ? formatPhoneDisplay(contact.phone) : null].filter(Boolean).join(" · ")
                            return (
                                <li key={contact.id} onClick={rowLink(hrefOf(contact))} className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card py-3 pl-3 pr-1 transition-colors hover:bg-muted/50">
                                    <InitialsAvatar name={contact.full_name} size="md" className="mt-0.5" />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex min-w-0 items-center gap-1.5">
                                            <Link href={hrefOf(contact)} prefetch={false} className="truncate font-semibold text-foreground hover:underline">{nameOf(contact)}</Link>
                                            {contact.needs_enrichment && <NeedsDetailsMark />}
                                        </div>
                                        <p className="truncate text-xs text-muted-foreground">{line2 || "No company"}</p>
                                        <p className={cn("mt-1 truncate text-sm", line3 ? "text-foreground" : "text-muted-foreground")}>{line3 || "No email or phone"}</p>
                                    </div>
                                    <RowMenu label={`Actions for ${contact.full_name}`} className="h-11 w-11 opacity-100">{rowMenuItems(contact)}</RowMenu>
                                </li>
                            )
                        })}
                    </ul>
                )}
            </div>

            {list.loaded && (
                <ListFooter total={list.total} page={state.page} size={state.size} onPageChange={setPage} onSizeChange={setSize} noun="contacts" pending={list.pending} />
            )}

            <BulkActionBar count={selectedCount} onClear={clearSelection}>
                <Button variant="ghost" size="sm" onClick={() => handleExport(true)} className="h-7 px-2.5 text-background/90 hover:text-background hover:bg-background/10 text-xs">
                    <Download className="h-3.5 w-3.5 mr-1" /> Export
                </Button>
                <PermissionGate resource="contacts" action="delete">
                    <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmOpen(true)} className="h-7 px-2.5 text-background/90 hover:text-background hover:bg-background/10 text-xs">
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                    </Button>
                </PermissionGate>
            </BulkActionBar>

            <AddContactModal
                isOpen={addContactOpen}
                onOpenChange={(open) => {
                    setAddContactOpen(open)
                    if (!open) setEditingContact(undefined)
                }}
                initialData={editingContact}
                onSuccess={reloadAll}
            />

            <ImportContactsModal open={importOpen} onOpenChange={setImportOpen} onSuccess={reloadAll} />

            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Move to Recycle Bin?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will move <strong className="text-foreground">{selectedIds.size}</strong> selected contact{selectedIds.size === 1 ? "" : "s"} to the Recycle Bin. An admin can restore them later.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={(e) => { e.preventDefault(); executeBulkDelete() }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Move to Recycle Bin
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={!!contactToDelete} onOpenChange={(o) => { if (!o) setContactToDelete(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Move to Recycle Bin?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will move <strong className="text-foreground">{contactToDelete?.full_name}</strong> to the Recycle Bin. An admin can restore it later.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={(e) => { e.preventDefault(); executeSingleDelete() }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Move to Recycle Bin
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
