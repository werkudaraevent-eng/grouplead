"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import * as XLSX from "xlsx"
import {
    ArrowDown, ArrowUp, ArrowUpDown, Building2, Columns, Download,
    Eye, EyeOff, Facebook, Globe, GripVertical, Instagram, Link2,
    Linkedin, Mail, MoreHorizontal, Pencil, Phone, Plus, RotateCcw,
    Search, Trash2, Twitter, Upload, Users, AlertTriangle,
} from "lucide-react"
import { toast } from "sonner"

import { createClient } from "@/utils/supabase/client"
import { deleteContactsAction } from "@/app/actions/contact-actions"
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
import { Pagination } from "@/components/shared/pagination"
import { SavedViewsBar } from "@/components/shared/saved-views-bar"
import { SearchableSelect } from "@/components/shared/searchable-select"
import { TableSkeleton } from "@/components/shared/table-skeleton"
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

function getInitials(name: string) {
    if (!name) return "?"
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((n) => n[0]).join("").toUpperCase()
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
        const { data, error } = await supabase
            .from("contacts")
            .select("id, salutation, full_name, email, phone, job_title, created_at, client_company_id, secondary_email, secondary_phone, secondary_emails, secondary_phones, linkedin_url, notes, date_of_birth, address, social_urls, owner_id, needs_enrichment, client_company:client_company_id ( name ), owner:profiles!contacts_owner_id_fkey(full_name, avatar_url)")
            .order("full_name", { ascending: true })

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
    ], [uniqueCompanies, uniqueOwners])

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
        const headers = ["ID", "Name", "Job Title", "Company", "Email", "Phone", "Owner", "Notes"]
        const rows = source.map((c) => [
            c.id,
            c.full_name || "",
            c.job_title || "",
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
                        {contact.owner.avatar_url ? (
                            <img src={contact.owner.avatar_url} alt={contact.owner.full_name} className="w-5 h-5 rounded-full object-cover border shrink-0" />
                        ) : (
                            <div className={cn("w-5 h-5 rounded-full border flex items-center justify-center text-[9px] font-bold shrink-0", getAvatarColor(contact.owner.full_name))}>
                                {getInitials(contact.owner.full_name)}
                            </div>
                        )}
                        <span className="truncate">{contact.owner.full_name}</span>
                    </div>
                ) : <span className="text-muted-foreground/60">—</span>
            case "full_name": {
                const nameDisplay = contact.salutation ? `${contact.salutation} ${contact.full_name}` : contact.full_name
                return (
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={cn("w-6 h-6 rounded-md border flex items-center justify-center text-[10px] font-semibold shrink-0", getAvatarColor(contact.full_name))}>
                            {getInitials(contact.full_name)}
                        </div>
                        <span className="font-medium text-[13px] text-foreground group-hover:text-primary transition-colors truncate">{nameDisplay}</span>
                        {contact.needs_enrichment && (
                            <span title="Auto-created from a lead import. Edit and save to complete it." className="inline-flex items-center gap-0.5 rounded bg-amber-50 border border-amber-200 px-1 py-0 text-[10px] font-semibold text-amber-700 shrink-0">
                                <AlertTriangle className="w-2.5 h-2.5" />Needs details
                            </span>
                        )}
                    </div>
                )
            }
            case "company":
                return contact.client_company?.name ? <span className="truncate">{contact.client_company.name}</span> : <span className="text-muted-foreground/60">—</span>
            case "job_title":
                return contact.job_title ? <span className="truncate">{contact.job_title}</span> : <span className="text-muted-foreground/60">—</span>
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

            <div className="shrink-0 px-4 sm:px-6 lg:px-8">
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

            <div className="shrink-0 px-4 sm:px-6 lg:px-8 pb-4 border-b border-border">
                <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
                    <div className="flex flex-col sm:flex-row gap-2 min-w-0 flex-1">
                        <div className="relative min-w-[220px] sm:max-w-[360px] flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                            <Input
                                placeholder="Search by name, email, phone, or company"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 h-9 bg-card border-border text-[13px] rounded-lg"
                            />
                        </div>
                        <FilterBuilder definitions={filterDefinitions} value={filters} onChange={setFilters} />
                    </div>

                    <div className="flex items-center gap-2 shrink-0 justify-end">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-9 px-3 gap-2 bg-card text-[13px]">
                                    <Columns className="w-4 h-4 text-muted-foreground" /> Columns <span className="text-[11px] text-muted-foreground font-normal">{activeCols.length}/{columns.length}</span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent align="end" className="w-72 p-0">
                                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                                    <p className="text-[14px] font-semibold text-foreground">Columns</p>
                                    <button onClick={resetColumns} className="text-[12px] text-primary hover:text-primary/80 flex items-center gap-1 font-medium">
                                        <RotateCcw className="h-3 w-3" /> Reset
                                    </button>
                                </div>
                                <p className="px-4 pt-2 pb-1 text-[11px] text-muted-foreground">Drag to reorder · click eye to toggle</p>
                                <div className="max-h-[360px] overflow-y-auto px-2 pb-2 flex flex-col gap-0.5 custom-scrollbar">
                                    {columns.map((col, idx) => (
                                        <div
                                            key={col.id}
                                            className="flex items-center justify-between pl-1 pr-2 py-2 hover:bg-muted rounded-md group cursor-grab active:cursor-grabbing"
                                            draggable
                                            onDragStart={(e) => { e.dataTransfer.setData("colIdx", idx.toString()); e.dataTransfer.effectAllowed = "move" }}
                                            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move" }}
                                            onDrop={(e) => {
                                                e.preventDefault()
                                                const fromIdx = parseInt(e.dataTransfer.getData("colIdx"))
                                                if (fromIdx === idx) return
                                                const next = [...columns]
                                                const [moved] = next.splice(fromIdx, 1)
                                                next.splice(idx, 0, moved)
                                                setColumns(next)
                                                localStorage.setItem("contacts_cols_order", JSON.stringify(next))
                                            }}
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                                                <span className={cn("text-[13px] truncate", col.visible ? "text-foreground font-medium" : "text-muted-foreground line-through")}>{col.label}</span>
                                            </div>
                                            <button onClick={(e) => { e.stopPropagation(); toggleColumn(col.id, !col.visible) }} className="shrink-0 p-1 rounded hover:bg-muted transition-colors">
                                                {col.visible ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground/60" />}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </PopoverContent>
                        </Popover>

                        <Button variant="outline" size="sm" onClick={() => handleExport(false)} className="h-9 px-3 gap-2 bg-card text-[13px]">
                            <Download className="w-4 h-4 text-muted-foreground" /> Export
                        </Button>

                        <PermissionGate resource="contacts" action="create">
                            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="h-9 px-3 gap-2 bg-card text-[13px]">
                                <Upload className="w-4 h-4 text-muted-foreground" /> Import
                            </Button>
                        </PermissionGate>
                    </div>
                </div>
            </div>

            <div className="bg-card overflow-hidden flex flex-col min-h-0 flex-1 relative z-0">
                <div className="overflow-auto flex-1 custom-scrollbar">
                    <Table className="w-full">
                        <TableHeader>
                            <TableRow className="border-border hover:bg-transparent">
                                <TableHead className="h-10 px-4 min-w-[40px] max-w-[40px] w-[40px] text-center align-middle sticky left-0 bg-card z-40 shadow-[1px_0_0_0_var(--border)]">
                                    <Checkbox checked={paginatedData.length > 0 && selectedIds.size === paginatedData.length} onCheckedChange={toggleSelectAll} aria-label="Select all current page" />
                                </TableHead>
                                <TableHead className="h-10 px-2 min-w-[40px] max-w-[40px] w-[40px] text-center align-middle text-[11px] font-semibold text-muted-foreground sticky left-[40px] bg-card z-40 shadow-[1px_0_0_0_var(--border)]">No.</TableHead>
                                {activeCols.map((col, index) => {
                                    const isSticky = index < 2
                                    const isLastSticky = index === Math.min(1, activeCols.length - 1)
                                    const leftPos = index === 0 ? 80 : (index === 1 ? 80 + activeCols[0].width : undefined)
                                    const stickyShadow = isLastSticky ? "inset -1px 0 0 0 var(--border), 5px 0 10px -2px rgba(0,0,0,0.08)" : "inset -1px 0 0 0 var(--border)"
                                    const style: React.CSSProperties = isSticky ? { left: `${leftPos}px`, minWidth: col.width, maxWidth: col.width, width: col.width, boxShadow: stickyShadow } : { minWidth: col.width, maxWidth: col.width, width: col.width }
                                    const className = cn("h-10 px-4 align-middle text-[11px] font-semibold tracking-wide text-muted-foreground", isSticky && "sticky bg-card z-40")
                                    const sortKey = col.id === "company" ? "client_company" : col.id
                                    const activeSort = sortConfig?.key === sortKey
                                    const SortIcon = activeSort ? (sortConfig.direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown
                                    return (
                                        <TableHead key={col.id} className={className} style={style}>
                                            <button onClick={() => handleSort(sortKey)} className={cn("flex items-center gap-1.5 transition-colors", activeSort ? "text-foreground" : "hover:text-foreground")}>
                                                {col.label} <SortIcon className={cn("w-3 h-3 shrink-0", activeSort ? "opacity-100 text-primary" : "opacity-35")} />
                                            </button>
                                        </TableHead>
                                    )
                                })}
                                <TableHead className="h-10 px-4 align-middle min-w-[60px] max-w-[60px] w-[60px] sticky right-0 bg-card z-40 shadow-[-1px_0_0_0_var(--border)]" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableSkeleton rows={10} columns={activeCols.length + 3} />
                            ) : contacts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={activeCols.length + 3} className="text-center py-20">
                                        <EmptyState title="No contacts yet" description="Create your first contact and link them to a client company." action={<PermissionGate resource="contacts" action="create"><Button onClick={() => setAddContactOpen(true)}><Plus className="w-4 h-4 mr-2" /> Add contact</Button></PermissionGate>} />
                                    </TableCell>
                                </TableRow>
                            ) : paginatedData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={activeCols.length + 3} className="text-center py-20">
                                        <EmptyState title="No contacts match your filters" description="Try changing your search or clearing filters." action={<Button variant="outline" onClick={() => { setSearchQuery(""); setFilters([]) }}>Clear filters</Button>} />
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedData.map((contact, idx) => {
                                    const isSelected = selectedIds.has(contact.id)
                                    return (
                                        <TableRow key={contact.id} onClick={() => router.push(`/contacts/${contact.id}`)} className="transition-colors cursor-pointer group border-border hover:bg-muted/40">
                                            <TableCell className={cn("px-4 py-2 text-center align-middle sticky left-0 z-20 shadow-[1px_0_0_0_var(--border)] transition-colors", isSelected ? "bg-primary/10" : "bg-card group-hover:bg-muted/40")} onClick={(e) => e.stopPropagation()}>
                                                <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(contact.id)} aria-label={`Select ${contact.full_name}`} />
                                            </TableCell>
                                            <TableCell className={cn("px-2 py-2 text-center align-middle text-[12px] text-muted-foreground font-medium sticky left-[40px] z-20 shadow-[1px_0_0_0_var(--border)] transition-colors", isSelected ? "bg-primary/10" : "bg-card group-hover:bg-muted/40")}>
                                                {(currentPage - 1) * itemsPerPage + idx + 1}
                                            </TableCell>
                                            {activeCols.map((col, index) => {
                                                const isSticky = index < 2
                                                const isLastSticky = index === Math.min(1, activeCols.length - 1)
                                                const leftPos = index === 0 ? 80 : (index === 1 ? 80 + activeCols[0].width : undefined)
                                                const stickyShadow = isLastSticky ? "inset -1px 0 0 0 var(--border), 5px 0 10px -2px rgba(0,0,0,0.08)" : "inset -1px 0 0 0 var(--border)"
                                                const style: React.CSSProperties = isSticky ? { left: `${leftPos}px`, minWidth: col.width, maxWidth: col.width, width: col.width, boxShadow: stickyShadow } : { minWidth: col.width, maxWidth: col.width, width: col.width }
                                                const cellClass = cn("px-4 py-2 align-middle text-[13px] truncate", isSticky ? "sticky z-20 transition-colors" : "text-muted-foreground", isSticky && (isSelected ? "bg-primary/10" : "bg-card group-hover:bg-muted/40"))
                                                return <TableCell key={col.id} className={cellClass} style={style} title={["notes", "address"].includes(col.id) ? (contact as any)[col.id] || "" : ""}>{renderCellContent(col.id, contact)}</TableCell>
                                            })}
                                            <TableCell className={cn("px-4 py-2 align-middle text-right sticky right-0 z-20 shadow-[-1px_0_0_0_var(--border)] transition-colors", isSelected ? "bg-primary/10" : "bg-card group-hover:bg-muted/40")} onClick={(e) => e.stopPropagation()}>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-7 w-7 p-0 hover:bg-muted">
                                                            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-40">
                                                        <PermissionMenuItem resource="contacts" action="update" onClick={() => openEditSheet(contact)}><Pencil className="w-4 h-4 mr-2" /> Edit</PermissionMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <PermissionMenuItem resource="contacts" action="delete" className="text-destructive focus:text-destructive" onClick={() => handleDelete(contact)}><Trash2 className="w-4 h-4 mr-2" /> Delete</PermissionMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t border-border bg-card gap-3 sm:gap-0 mt-auto">
                    <div className="text-[13px] text-muted-foreground font-medium">
                        <span className="text-foreground font-semibold">{filteredData.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</span>–<span className="text-foreground font-semibold">{Math.min(currentPage * itemsPerPage, filteredData.length)}</span> of <span className="text-foreground font-semibold">{filteredData.length}</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-[13px] text-muted-foreground">Rows</span>
                            <SearchableSelect
                                value={itemsPerPage.toString()}
                                onChange={(val) => val && setItemsPerPage(Number(val))}
                                options={[10, 20, 50, 100].map((n) => ({ value: String(n), label: String(n) }))}
                                clearable={false}
                                contentWidth="auto"
                                className="h-8 w-[72px]"
                            />
                        </div>
                        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} size="sm" />
                    </div>
                </div>
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
                        <AlertDialogTitle>Delete selected contacts?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete <strong className="text-foreground">{selectedIds.size}</strong> selected contact{selectedIds.size === 1 ? "" : "s"}. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={(e) => { e.preventDefault(); executeBulkDelete() }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={!!contactToDelete} onOpenChange={(o) => { if (!o) setContactToDelete(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this contact?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete <strong className="text-foreground">{contactToDelete?.full_name}</strong>. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={(e) => { e.preventDefault(); executeSingleDelete() }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

function EmptyState({
    title,
    description,
    action,
}: {
    title: string
    description: string
    action?: React.ReactNode
}) {
    return (
        <div className="flex flex-col items-center justify-center text-center max-w-sm mx-auto">
            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center border border-border mb-4">
                <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
            {action && <div className="mt-5">{action}</div>}
        </div>
    )
}
