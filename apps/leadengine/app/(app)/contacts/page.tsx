"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import * as XLSX from "xlsx"
import {
    Download, Facebook, Globe, Instagram, Link2,
    Linkedin, Pencil, Plus, Trash2, Twitter, Upload, Users,
} from "@/components/icons"
import { toast } from "sonner"

import { createClient } from "@/utils/supabase/client"
import { deleteContactsAction } from "@/app/actions/contact-actions"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
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
import { FilterBuilder } from "@/components/shared/filter-builder"
import {
    applyFilters,
    type FilterDefinition,
    type FilterValue,
} from "@/components/shared/filter-builder-types"
import { ListPageHeader } from "@/components/shared/list-page-header"
import { SavedViewsBar, SaveViewButton } from "@/components/shared/saved-views-bar"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { ListToolbar, ToolbarIconButton } from "@/components/shared/list-toolbar"
import { ColumnsMenu } from "@/components/shared/columns-menu"
import { ListFooter } from "@/components/shared/list-footer"
import { InitialsAvatar } from "@/components/shared/initials-avatar"
import { NeedsDetailsBadge } from "@/components/shared/status-badge"
import { INDEX_COL, ListEmpty, MENU_COL, RowMenu, SELECT_COL, SortableHead, frozenCell } from "@/components/shared/list-table"
import { useListViews } from "@/hooks/use-list-views"
import { formatPhoneDisplay } from "@/lib/phone-normalize"
import { cn } from "@/lib/utils"

interface ContactRow {
    id: string
    salutation: string | null
    full_name: string
    email: string | null
    phone: string | null
    job_title: string | null
    contact_source: string | null
    created_at: string
    client_company_id: string | null
    client_company: { name: string } | null
    secondary_email: string | null
    secondary_phone: string | null
    secondary_emails: string[] | null
    secondary_phones: string[] | null
    linkedin_url: string | null
    notes: string | null
    date_of_birth: string | null
    address: string | null
    social_urls: { platform: string; url: string }[] | null
    owner_id: string | null
    owner?: { full_name: string; avatar_url?: string | null } | null
    needs_enrichment?: boolean
}

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

interface ContactsViewConfig {
    filters: FilterValue[]
    sort: { key: string; direction: "asc" | "desc" } | null
    columns: ColumnDef[]
    itemsPerPage: number
    searchQuery: string
}

const CONTACTS_SELECT_WITH_SOURCE = "id, salutation, full_name, email, phone, job_title, contact_source, created_at, client_company_id, secondary_email, secondary_phone, secondary_emails, secondary_phones, linkedin_url, notes, date_of_birth, address, social_urls, owner_id, needs_enrichment, client_company:client_company_id ( name ), owner:profiles!contacts_owner_id_fkey(full_name, avatar_url)"
const CONTACTS_SELECT_LEGACY = "id, salutation, full_name, email, phone, job_title, created_at, client_company_id, secondary_email, secondary_phone, secondary_emails, secondary_phones, linkedin_url, notes, date_of_birth, address, social_urls, owner_id, needs_enrichment, client_company:client_company_id ( name ), owner:profiles!contacts_owner_id_fkey(full_name, avatar_url)"

function isMissingContactSourceColumn(error: unknown) {
    const message = String((error as { message?: unknown })?.message ?? error ?? "").toLowerCase()
    return message.includes("contact_source") && (message.includes("column") || message.includes("schema cache"))
}

export default function ContactsPage() {
    const router = useRouter()
    const supabase = React.useMemo(() => createClient(), [])

    const [contacts, setContacts] = React.useState<ContactRow[]>([])
    const [loading, setLoading] = React.useState(true)
    const [addContactOpen, setAddContactOpen] = React.useState(false)
    const [editingContact, setEditingContact] = React.useState<ContactRow | undefined>()
    const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false)
    const [contactToDelete, setContactToDelete] = React.useState<ContactRow | null>(null)
    const [importOpen, setImportOpen] = React.useState(false)

    const [searchQuery, setSearchQuery] = React.useState("")
    const [filters, setFilters] = React.useState<FilterValue[]>([])
    const [sortConfig, setSortConfig] = React.useState<{ key: string; direction: "asc" | "desc" } | null>(null)
    const [columns, setColumns] = React.useState<ColumnDef[]>(DEFAULT_COLUMNS)
    const [currentPage, setCurrentPage] = React.useState(1)
    const [itemsPerPage, setItemsPerPage] = React.useState(20)
    const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())

    React.useEffect(() => {
        const stored = localStorage.getItem("contacts_cols_order")
        if (!stored) return
        try {
            const parsed = JSON.parse(stored) as ColumnDef[]
            const merged = parsed.filter((p) => DEFAULT_COLUMNS.some((d) => d.id === p.id))
            const missing = DEFAULT_COLUMNS.filter((d) => !merged.some((m) => m.id === d.id))
            setColumns([...merged, ...missing])
        } catch {
            setColumns(DEFAULT_COLUMNS)
        }
    }, [])

    const fetchContacts = React.useCallback(async () => {
        setLoading(true)
        const initial = await supabase
            .from("contacts")
            .select(CONTACTS_SELECT_WITH_SOURCE)
            .is("deleted_at", null)
            .order("full_name", { ascending: true })
        let data: unknown = initial.data
        let error = initial.error

        if (error && isMissingContactSourceColumn(error)) {
            const retry = await supabase
                .from("contacts")
                .select(CONTACTS_SELECT_LEGACY)
                .is("deleted_at", null)
                .order("full_name", { ascending: true })
            data = retry.data
            error = retry.error
        }

        if (error) {
            console.warn("[Contacts Fetch]:", error.message || error)
            toast.error("Failed to load contacts")
            setLoading(false)
            return
        }
        setContacts((data as unknown as ContactRow[]) || [])
        setLoading(false)
    }, [supabase])

    React.useEffect(() => {
        fetchContacts()
    }, [fetchContacts])

    const activeCols = React.useMemo(() => columns.filter((c) => c.visible), [columns])

    const uniqueCompanies = React.useMemo(() => {
        return Array.from(new Set(contacts.map((c) => c.client_company?.name).filter(Boolean))) as string[]
    }, [contacts])

    const uniqueOwners = React.useMemo(() => {
        return Array.from(new Set(contacts.map((c) => c.owner?.full_name).filter(Boolean))) as string[]
    }, [contacts])

    const uniqueSources = React.useMemo(() => {
        return Array.from(new Set(contacts.map((c) => c.contact_source).filter(Boolean))) as string[]
    }, [contacts])

    const filterDefinitions = React.useMemo<FilterDefinition[]>(() => [
        {
            field: "client_company.name",
            label: "Company",
            type: "select",
            pinned: true,
            options: uniqueCompanies.map((c) => ({ value: c, label: c })),
            accessor: (row) => (row as ContactRow).client_company?.name ?? "",
        },
        {
            field: "owner.full_name",
            label: "Owner",
            type: "select",
            pinned: true,
            options: uniqueOwners.map((o) => ({ value: o, label: o })),
            accessor: (row) => (row as ContactRow).owner?.full_name ?? "",
        },
        {
            field: "contact_source",
            label: "Contact source",
            type: "select",
            pinned: true,
            options: uniqueSources.map((s) => ({ value: s, label: s })),
            accessor: (row) => (row as ContactRow).contact_source ?? "",
        },
        {
            field: "email",
            label: "Has email",
            type: "boolean",
            pinned: true,
            defaultOperator: "is_not_empty",
            accessor: (row) => (row as ContactRow).email,
        },
        {
            field: "phone",
            label: "Has phone",
            type: "boolean",
            pinned: false,
            defaultOperator: "is_not_empty",
            accessor: (row) => (row as ContactRow).phone,
        },
        { field: "job_title", label: "Job title", type: "text", accessor: (row) => (row as ContactRow).job_title ?? "" },
        { field: "needs_enrichment", label: "Needs details", type: "boolean", defaultOperator: "is_true", accessor: (row) => (row as ContactRow).needs_enrichment ?? false },
        { field: "created_at", label: "Created date", type: "date-range", accessor: (row) => (row as ContactRow).created_at },
        { field: "notes", label: "Notes", type: "text", accessor: (row) => (row as ContactRow).notes ?? "" },
    ], [uniqueCompanies, uniqueOwners, uniqueSources])

    const snapshot = React.useCallback((): ContactsViewConfig => ({
        filters,
        sort: sortConfig,
        columns,
        itemsPerPage,
        searchQuery,
    }), [filters, sortConfig, columns, itemsPerPage, searchQuery])

    const applySnapshot = React.useCallback((config: Partial<ContactsViewConfig>) => {
        if (Array.isArray(config.filters)) setFilters(config.filters)
        if ("sort" in config) setSortConfig(config.sort ?? null)
        if (Array.isArray(config.columns)) setColumns(config.columns)
        if (typeof config.itemsPerPage === "number") setItemsPerPage(config.itemsPerPage)
        if (typeof config.searchQuery === "string") setSearchQuery(config.searchQuery)
        setCurrentPage(1)
    }, [])

    const listViews = useListViews<ContactsViewConfig>({
        pageKey: "contacts",
        snapshot,
        applySnapshot: applySnapshot as (config: ContactsViewConfig) => void,
        storageKey: "contacts_active_view_id",
    })

    const searchedData = React.useMemo(() => {
        const q = searchQuery.trim().toLowerCase()
        if (!q) return contacts
        return contacts.filter((item) => {
            const haystack = [
                item.full_name,
                item.salutation,
                item.email,
                item.phone,
                item.job_title,
                item.contact_source,
                item.client_company?.name,
                item.secondary_email,
                item.secondary_phone,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
            return haystack.includes(q)
        })
    }, [contacts, searchQuery])

    const filteredData = React.useMemo(() => {
        return applyFilters(searchedData, filters, filterDefinitions)
    }, [searchedData, filters, filterDefinitions])

    const sortedData = React.useMemo(() => {
        return [...filteredData].sort((a, b) => {
            if (!sortConfig) return 0
            const { key, direction } = sortConfig
            const valA = key === "client_company" ? a.client_company?.name || "" : (a as any)[key] || ""
            const valB = key === "client_company" ? b.client_company?.name || "" : (b as any)[key] || ""
            if (valA < valB) return direction === "asc" ? -1 : 1
            if (valA > valB) return direction === "asc" ? 1 : -1
            return 0
        })
    }, [filteredData, sortConfig])

    const totalPages = Math.max(1, Math.ceil(sortedData.length / itemsPerPage))
    const paginatedData = React.useMemo(() => {
        return sortedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    }, [sortedData, currentPage, itemsPerPage])

    React.useEffect(() => {
        setCurrentPage(1)
        setSelectedIds(new Set())
    }, [searchQuery, filters, itemsPerPage])

    const handleSort = (key: string) => {
        const nextDirection: "asc" | "desc" = sortConfig?.key === key && sortConfig.direction === "asc" ? "desc" : "asc"
        setSortConfig({ key, direction: nextDirection })
    }

    const toggleSelectAll = () => {
        if (selectedIds.size === paginatedData.length && paginatedData.length > 0) setSelectedIds(new Set())
        else setSelectedIds(new Set(paginatedData.map((c) => c.id)))
    }

    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const executeBulkDelete = async () => {
        const ids = Array.from(selectedIds)
        const result = await deleteContactsAction(ids)
        if (!result.success) {
            toast.error(result.error || "Failed to delete contacts")
            setDeleteConfirmOpen(false)
            return
        }
        toast.success(`${ids.length} contacts deleted`)
        setSelectedIds(new Set())
        setDeleteConfirmOpen(false)
        fetchContacts()
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
        fetchContacts()
    }

    const handleExport = (onlySelected = false) => {
        const source = onlySelected ? sortedData.filter((c) => selectedIds.has(c.id)) : sortedData
        const headers = ["ID", "Name", "Job Title", "Contact Source", "Company", "Email", "Phone", "Owner", "Notes"]
        const rows = source.map((c) => [
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
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Contacts")
        XLSX.writeFile(wb, `contacts_export_${new Date().toISOString().split("T")[0]}.xlsx`)
    }

    const openEditSheet = (contact: ContactRow) => {
        setEditingContact(contact)
        setAddContactOpen(true)
    }

    const toggleColumn = (id: ColId, visible: boolean) => {
        const next = columns.map((c) => c.id === id ? { ...c, visible } : c)
        setColumns(next)
        localStorage.setItem("contacts_cols_order", JSON.stringify(next))
    }

    const resetColumns = () => {
        setColumns(DEFAULT_COLUMNS)
        localStorage.removeItem("contacts_cols_order")
    }

    const renderCellContent = (colId: ColId, contact: ContactRow) => {
        switch (colId) {
            case "owner":
                return contact.owner?.full_name ? (
                    <div className="flex items-center gap-2 min-w-0">
                        <InitialsAvatar name={contact.owner.full_name} src={contact.owner.avatar_url} size="xs" />
                        <span className="truncate">{contact.owner.full_name}</span>
                    </div>
                ) : <span className="text-muted-foreground/60">—</span>
            case "full_name": {
                const nameDisplay = contact.salutation ? `${contact.salutation} ${contact.full_name}` : contact.full_name
                return (
                    <div className="flex items-center gap-3 min-w-0">
                        <InitialsAvatar name={contact.full_name} size="sm" />
                        <span className="font-medium text-foreground group-hover:text-primary transition-colors truncate">{nameDisplay}</span>
                        {contact.needs_enrichment && <NeedsDetailsBadge />}
                    </div>
                )
            }
            case "company":
                return contact.client_company?.name ? <span className="truncate">{contact.client_company.name}</span> : <span className="text-muted-foreground/60">—</span>
            case "job_title":
                return contact.job_title ? <span className="truncate">{contact.job_title}</span> : <span className="text-muted-foreground/60">—</span>
            case "contact_source":
                return contact.contact_source ? <span className="truncate">{contact.contact_source}</span> : <span className="text-muted-foreground/60">—</span>
            case "email":
                return contact.email ? <span className="truncate hover:text-primary transition-colors">{contact.email}</span> : <span className="text-muted-foreground/60">—</span>
            case "phone":
                return contact.phone ? <span className="truncate hover:text-primary transition-colors">{formatPhoneDisplay(contact.phone)}</span> : <span className="text-muted-foreground/60">—</span>
            case "secondary_email":
                return contact.secondary_email ? contact.secondary_email : (contact.secondary_emails?.[0] || <span className="text-muted-foreground/60">—</span>)
            case "secondary_phone": {
                const sp = contact.secondary_phone || contact.secondary_phones?.[0]
                return sp ? formatPhoneDisplay(sp) : <span className="text-muted-foreground/60">—</span>
            }
            case "address":
                return contact.address || <span className="text-muted-foreground/60">—</span>
            case "date_of_birth":
                return contact.date_of_birth ? new Date(contact.date_of_birth).toLocaleDateString() : <span className="text-muted-foreground/60">—</span>
            case "socials": {
                const links: { platform: string; url: string }[] = []
                if (contact.linkedin_url) links.push({ platform: "LinkedIn", url: contact.linkedin_url })
                if (Array.isArray(contact.social_urls)) {
                    contact.social_urls.forEach((s) => {
                        if (s.url && s.url !== contact.linkedin_url) links.push(s)
                    })
                }
                if (links.length === 0) return <span className="text-muted-foreground/60">—</span>
                return (
                    <div className="flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
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
                return contact.notes || <span className="text-muted-foreground/60">—</span>
            default:
                return null
        }
    }

    const selectedCount = selectedIds.size
    // Worth saving as a view once the list is no longer the default one.
    const customised = filters.length > 0 || sortConfig !== null || searchQuery.trim() !== ""

    return (
        <div className="w-full h-[calc(100vh-64px)] sm:h-full flex flex-col overflow-hidden bg-background">
            <div className="shrink-0 px-4 sm:px-6 lg:px-8 pt-6 pb-4">
                <ListPageHeader
                    title="Contacts"
                    subtitle="Manage client contacts, vendors, and associates."
                    actions={
                        <PermissionGate resource="contacts" action="create">
                            <Button onClick={() => setAddContactOpen(true)} className="h-9 px-4 text-[13px]">
                                <Plus className="w-4 h-4 mr-1.5" /> Add contact
                            </Button>
                        </PermissionGate>
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
                    search={{ value: searchQuery, onChange: setSearchQuery, placeholder: "Search by name, email, phone, or company", "aria-label": "Search contacts" }}
                    filters={{ definitions: filterDefinitions, value: filters, onChange: setFilters }}
                    actions={
                        <>
                            {customised && <SaveViewButton onSaveAs={listViews.saveAs} />}
                            <ColumnsMenu columns={columns} onChange={setColumns} onReset={resetColumns} storageKey="contacts_cols_order" />
                            <ToolbarIconButton label="Export to Excel" onClick={() => handleExport(false)}>
                                <Download className="h-5 w-5" />
                            </ToolbarIconButton>
                            <PermissionGate resource="contacts" action="create">
                                <ToolbarIconButton label="Import from Excel" onClick={() => setImportOpen(true)}>
                                    <Upload className="h-5 w-5" />
                                </ToolbarIconButton>
                            </PermissionGate>
                        </>
                    }
                />
            </div>

            <div className="relative z-0 flex min-h-0 flex-1 flex-col overflow-hidden bg-card">
                <div className="custom-scrollbar flex-1 overflow-auto">
                    <Table className="w-full">
                        <TableHeader>
                            <TableRow className="hover:[&_td]:bg-transparent">
                                <TableHead className="sticky left-0 z-10 px-3 text-center" style={{ width: SELECT_COL, minWidth: SELECT_COL, maxWidth: SELECT_COL }}>
                                    <Checkbox checked={paginatedData.length > 0 && selectedIds.size === paginatedData.length} onCheckedChange={toggleSelectAll} aria-label="Select all on this page" />
                                </TableHead>
                                <TableHead className="sticky z-10 px-2 text-center" style={{ left: SELECT_COL, width: INDEX_COL, minWidth: INDEX_COL, maxWidth: INDEX_COL }}>No.</TableHead>
                                {activeCols.map((col, index) => {
                                    const frozen = frozenCell(index, activeCols)
                                    const sortKey = col.id === "company" ? "client_company" : col.id
                                    const activeSort = sortConfig?.key === sortKey
                                    return (
                                        <SortableHead
                                            key={col.id}
                                            label={col.label}
                                            active={activeSort}
                                            direction={activeSort ? sortConfig?.direction : undefined}
                                            onSort={() => handleSort(sortKey)}
                                            className={frozen.className}
                                            style={frozen.style}
                                        />
                                    )
                                })}
                                <TableHead className="sticky right-0 z-10" style={{ width: MENU_COL, minWidth: MENU_COL, maxWidth: MENU_COL }}>
                                    <span className="sr-only">Actions</span>
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableSkeleton rows={10} columns={activeCols.length + 3} />
                            ) : contacts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={activeCols.length + 3} className="h-auto">
                                        <ListEmpty icon={Users} title="No contacts yet" description="Create your first contact and link them to a client company." action={<PermissionGate resource="contacts" action="create"><Button onClick={() => setAddContactOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add contact</Button></PermissionGate>} />
                                    </TableCell>
                                </TableRow>
                            ) : paginatedData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={activeCols.length + 3} className="h-auto">
                                        <ListEmpty icon={Users} title="No contacts match your filters" description="Try changing your search or clearing filters." action={<Button variant="outline" onClick={() => { setSearchQuery(""); setFilters([]) }}>Clear filters</Button>} />
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedData.map((contact, idx) => {
                                    const isSelected = selectedIds.has(contact.id)
                                    return (
                                        <TableRow key={contact.id} data-state={isSelected ? "selected" : undefined} onClick={() => router.push(`/contacts/${contact.id}`)} className="cursor-pointer">
                                            <TableCell className="sticky left-0 z-10 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(contact.id)} aria-label={`Select ${contact.full_name}`} />
                                            </TableCell>
                                            <TableCell className="sticky z-10 px-2 text-center text-xs text-muted-foreground tabular-nums" style={{ left: SELECT_COL }}>
                                                {(currentPage - 1) * itemsPerPage + idx + 1}
                                            </TableCell>
                                            {activeCols.map((col, index) => {
                                                const frozen = frozenCell(index, activeCols)
                                                return (
                                                    <TableCell key={col.id} className={cn("truncate", frozen.className, index >= 2 && "text-muted-foreground")} style={frozen.style} title={col.id === "notes" ? contact.notes || "" : col.id === "address" ? contact.address || "" : ""}>
                                                        {renderCellContent(col.id, contact)}
                                                    </TableCell>
                                                )
                                            })}
                                            <TableCell className="sticky right-0 z-10 px-2 text-right" onClick={(e) => e.stopPropagation()}>
                                                <RowMenu label={`Actions for ${contact.full_name}`}>
                                                    <PermissionMenuItem resource="contacts" action="update" onClick={() => openEditSheet(contact)}><Pencil className="mr-2 h-4 w-4" /> Edit</PermissionMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <PermissionMenuItem resource="contacts" action="delete" className="text-destructive focus:text-destructive" onClick={() => handleDelete(contact)}><Trash2 className="mr-2 h-4 w-4" /> Delete</PermissionMenuItem>
                                                </RowMenu>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>

                <ListFooter total={filteredData.length} page={currentPage} perPage={itemsPerPage} onPageChange={setCurrentPage} onPerPageChange={setItemsPerPage} noun="contacts" />
            </div>

            <BulkActionBar count={selectedCount} onClear={() => setSelectedIds(new Set())}>
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
                onSuccess={fetchContacts}
            />

            <ImportContactsModal open={importOpen} onOpenChange={setImportOpen} onSuccess={fetchContacts} />

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
