"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
    Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Users, Search, Mail, Phone, Building2, Briefcase, Loader2, Plus, ArrowUpDown, Pencil, Linkedin, MoreHorizontal, Trash2, Columns, Download, Upload, Instagram, Twitter, Facebook, Globe, Link2, ChevronUp, ChevronDown } from "lucide-react"
import { AddContactModal } from "@/features/contacts/components/add-contact-modal"
import { ImportContactsModal } from "@/features/contacts/components/import-contacts-modal"
import { PermissionGate } from "@/features/users/components/permission-gate"
import { toast } from "sonner"
import * as XLSX from "xlsx"

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
    owner?: { full_name: string } | null
}

type ColId = "owner" | "full_name" | "company" | "job_title" | "email" | "phone" | "secondary_email" | "secondary_phone" | "address" | "date_of_birth" | "socials" | "notes";

interface ColumnDef {
    id: ColId;
    label: string;
    visible: boolean;
    width: number;
}

const DEFAULT_COLUMNS: ColumnDef[] = [
    { id: "owner", label: "Owner", visible: true, width: 140 },
    { id: "full_name", label: "Contact Name", visible: true, width: 220 },
    { id: "company", label: "Company", visible: true, width: 150 },
    { id: "job_title", label: "Job Title", visible: true, width: 130 },
    { id: "email", label: "Email", visible: true, width: 160 },
    { id: "phone", label: "Phone", visible: true, width: 130 },
    { id: "secondary_email", label: "Sec. Email", visible: false, width: 160 },
    { id: "secondary_phone", label: "Sec. Phone", visible: false, width: 130 },
    { id: "address", label: "Address", visible: false, width: 200 },
    { id: "date_of_birth", label: "Date of Birth", visible: false, width: 120 },
    { id: "socials", label: "Social Links", visible: false, width: 150 },
    { id: "notes", label: "Notes", visible: false, width: 250 },
];

export default function ContactsPage() {
    const router = useRouter()
    const [contacts, setContacts] = useState<ContactRow[]>([])
    const [loading, setLoading] = useState(true)
    const [addContactOpen, setAddContactOpen] = useState(false)
    const [editingContact, setEditingContact] = useState<ContactRow | undefined>()
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
    const [importOpen, setImportOpen] = useState(false)

    // Data Table State
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedCompanyFilter, setSelectedCompanyFilter] = useState("all")
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null)
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(20)

    // Selection State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

    // Column Ordering State
    const [columns, setColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS)

    useEffect(() => {
        const stored = localStorage.getItem("contacts_cols_order")
        if (stored) {
            try {
                const parsed = JSON.parse(stored) as ColumnDef[]
                const merged = parsed.filter(p => DEFAULT_COLUMNS.some(d => d.id === p.id))
                const missing = DEFAULT_COLUMNS.filter(d => !merged.some(m => m.id === d.id))
                setColumns([...merged, ...missing])
            } catch(e) {
                setColumns(DEFAULT_COLUMNS)
            }
        }
    }, [])

    const toggleColumn = (id: ColId, visible: boolean) => {
        const next = columns.map(c => c.id === id ? { ...c, visible } : c)
        setColumns(next)
        localStorage.setItem("contacts_cols_order", JSON.stringify(next))
    }

    const moveColumn = (index: number, direction: -1 | 1) => {
        if (index + direction < 0 || index + direction >= columns.length) return
        const next = [...columns]
        const temp = next[index]
        next[index] = next[index + direction]
        next[index + direction] = temp
        setColumns(next)
        localStorage.setItem("contacts_cols_order", JSON.stringify(next))
    }

    const supabase = createClient()

    const fetchContacts = useCallback(async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from("contacts")
            .select("id, salutation, full_name, email, phone, job_title, created_at, client_company_id, secondary_email, secondary_phone, secondary_emails, secondary_phones, linkedin_url, notes, date_of_birth, address, social_urls, owner_id, client_company:client_company_id ( name ), owner:profiles!contacts_owner_id_fkey(full_name)")
            .order("full_name", { ascending: true })
        if (error) {
            console.warn("[Contacts Fetch]:", error.message || error)
            toast.error("Failed to load contacts")
            setLoading(false)
            return
        }
        setContacts((data as unknown as ContactRow[]) || [])
        setLoading(false)
    }, [])

    useEffect(() => { fetchContacts() }, [fetchContacts])

    const uniqueCompanies = useMemo(() => {
        return Array.from(new Set(contacts.map(c => c.client_company?.name))).filter(Boolean) as string[]
    }, [contacts])

    const filteredData = useMemo(() => {
        return contacts.filter((item) => {
            const matchSearch = Object.values(item).some((val) =>
                val && String(val).toLowerCase().includes(searchQuery.toLowerCase())
            )
            const matchCompany = selectedCompanyFilter === "all" || item.client_company?.name === selectedCompanyFilter
            return matchSearch && matchCompany
        })
    }, [contacts, searchQuery, selectedCompanyFilter])

    const sortedData = useMemo(() => {
        return [...filteredData].sort((a: any, b: any) => {
            if (!sortConfig) return 0
            const { key, direction } = sortConfig
            
            const valA = key === "client_company" ? a.client_company?.name || "" : a[key] || ""
            const valB = key === "client_company" ? b.client_company?.name || "" : b[key] || ""
            
            if (valA < valB) return direction === "asc" ? -1 : 1
            if (valA > valB) return direction === "asc" ? 1 : -1
            return 0
        })
    }, [filteredData, sortConfig])

    const totalPages = Math.max(1, Math.ceil(sortedData.length / itemsPerPage))
    const paginatedData = useMemo(() => {
        return sortedData.slice(
            (currentPage - 1) * itemsPerPage,
            currentPage * itemsPerPage
        )
    }, [sortedData, currentPage, itemsPerPage])

    // Reset pagination when filters change
    useEffect(() => { setCurrentPage(1) }, [searchQuery, selectedCompanyFilter, itemsPerPage])

    const handleSort = (key: string) => {
        let direction: "asc" | "desc" = "asc"
        if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
            direction = "desc"
        }
        setSortConfig({ key, direction })
    }

    const toggleSelectAll = () => {
        if (selectedIds.size === paginatedData.length && paginatedData.length > 0) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(paginatedData.map(c => c.id)))
        }
    }

    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds)
        if (newSet.has(id)) newSet.delete(id)
        else newSet.add(id)
        setSelectedIds(newSet)
    }

    const handleBulkDelete = () => {
        if (selectedIds.size === 0) return
        setDeleteConfirmOpen(true)
    }

    const executeBulkDelete = async () => {
        const ids = Array.from(selectedIds)
        const { error } = await supabase.from("contacts").delete().in("id", ids)
        if (error) { toast.error(error.message || "Failed to delete contacts"); setDeleteConfirmOpen(false); return }
        
        toast.success(`${ids.length} contacts deleted`)
        setSelectedIds(new Set())
        setDeleteConfirmOpen(false)
        fetchContacts()
    }

    const handleExport = () => {
        const headers = ["ID", "Name", "Job Title", "Company", "Email", "Phone", "Notes"]
        const rows = sortedData.map(c => [
            c.id,
            c.full_name || "",
            c.job_title || "",
            c.client_company?.name || "",
            c.email || "",
            c.phone || "",
            (c.notes || "").replace(/\n/g, " ")
        ])
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Contacts")
        XLSX.writeFile(wb, `contacts_export_${new Date().toISOString().split("T")[0]}.xlsx`)
    }

    const getInitials = (name: string) => {
        if (!name) return "?"
        return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    }

    const openEditSheet = (contact: ContactRow) => {
        setEditingContact(contact)
        setAddContactOpen(true)
    }

    const handleDelete = async (contact: ContactRow) => {
        if (!confirm(`Are you sure you want to delete ${contact.full_name}?`)) return
        const { error } = await supabase.from("contacts").delete().eq("id", contact.id)
        if (error) { console.warn("[Contact Delete]:", error.message || error); toast.error("Failed to delete contact"); return }
        toast.success("Contact deleted")
        fetchContacts()
    }

    const activeCols = columns.filter(c => c.visible)

    const renderCellContent = (colId: ColId, contact: ContactRow) => {
        switch (colId) {
            case "owner":
                return contact.owner?.full_name ? (
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-600 shrink-0">
                            {getInitials(contact.owner.full_name)}
                        </div>
                        <span className="truncate">{contact.owner.full_name}</span>
                    </div>
                ) : <span className="text-slate-400">&mdash;</span>;
            case "full_name":
                const nameDisplay = contact.salutation ? `${contact.salutation} ${contact.full_name}` : contact.full_name;
                return (
                    <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-semibold text-slate-600 shrink-0">
                            {getInitials(contact.full_name)}
                        </div>
                        <span className="font-medium text-[13px] text-slate-900 group-hover:text-blue-600 transition-colors truncate">{nameDisplay}</span>
                    </div>
                );
            case "company":
                return contact.client_company?.name ? <span className="truncate">{contact.client_company.name}</span> : <span className="text-slate-400">&mdash;</span>;
            case "job_title":
                return contact.job_title ? <span className="truncate">{contact.job_title}</span> : <span className="text-slate-400">&mdash;</span>;
            case "email":
                return contact.email ? <span className="truncate hover:text-blue-600 transition-colors">{contact.email}</span> : <span className="text-slate-400">&mdash;</span>;
            case "phone":
                return contact.phone ? <span className="truncate hover:text-blue-600 transition-colors">{contact.phone}</span> : <span className="text-slate-400">&mdash;</span>;
            case "secondary_email":
                return contact.secondary_email ? contact.secondary_email : (contact.secondary_emails?.[0] || <span className="text-slate-400">&mdash;</span>);
            case "secondary_phone":
                return contact.secondary_phone ? contact.secondary_phone : (contact.secondary_phones?.[0] || <span className="text-slate-400">&mdash;</span>);
            case "address":
                return contact.address || <span className="text-slate-400">&mdash;</span>;
            case "date_of_birth":
                return contact.date_of_birth ? new Date(contact.date_of_birth).toLocaleDateString() : <span className="text-slate-400">&mdash;</span>;
            case "socials":
                const links = [];
                if (contact.linkedin_url) links.push({ platform: "LinkedIn", url: contact.linkedin_url });
                if (contact.social_urls && Array.isArray(contact.social_urls)) {
                    contact.social_urls.forEach(s => {
                        if (s.url && s.url !== contact.linkedin_url) links.push(s);
                    });
                }
                if (links.length === 0) return <span className="text-slate-400 text-[13px]">&mdash;</span>;
                return (
                    <div className="flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {links.map((link, i) => {
                            const p = link.platform.toLowerCase()
                            return (
                                <a key={i} href={link.url.startsWith("http") ? link.url : `https://${link.url}`} target="_blank" rel="noreferrer" title={link.platform} className="text-slate-400 hover:text-blue-500 transition-colors p-1 border border-slate-200 rounded-md bg-slate-50 hover:bg-blue-50 hover:border-blue-200">
                                    {p.includes("linkedin") ? <Linkedin className="w-3.5 h-3.5" /> : 
                                     p.includes("twitter") ? <Twitter className="w-3.5 h-3.5" /> : 
                                     p.includes("instagram") ? <Instagram className="w-3.5 h-3.5" /> : 
                                     p.includes("facebook") ? <Facebook className="w-3.5 h-3.5" /> : 
                                     p.includes("website") ? <Globe className="w-3.5 h-3.5" /> : 
                                     <Link2 className="w-3.5 h-3.5" />}
                                </a>
                            );
                        })}
                    </div>
                );
            case "notes":
                return contact.notes || <span className="text-slate-400">&mdash;</span>;
            default:
                return null;
        }
    }

    return (
        <div className="w-full h-[calc(100vh-64px)] sm:h-full max-w-[1600px] mx-auto px-4 sm:px-6 py-6 bg-slate-50 flex flex-col overflow-hidden">
            <div className="mb-6 shrink-0">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Contacts Directory</h1>
                <p className="text-sm text-slate-500 mt-1">Manage your client contacts, vendors, and associates.</p>
            </div>
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6 shrink-0">
                <div className="flex flex-1 items-center gap-3 w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0">
                    <div className="relative w-[280px] shrink-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        <Input
                            placeholder="Search contacts..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-9 w-full bg-white border-slate-200 hover:border-slate-300 focus-visible:ring-1 focus-visible:ring-slate-400 text-[13px] shadow-sm rounded-lg"
                        />
                    </div>
                    
                    <Select value={selectedCompanyFilter} onValueChange={setSelectedCompanyFilter}>
                        <SelectTrigger className="h-9 w-[220px] bg-white border-slate-200 text-[13px] shadow-sm shrink-0">
                            <SelectValue placeholder="All Companies" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Companies</SelectItem>
                            {uniqueCompanies.map(company => (
                                <SelectItem key={company} value={company}>{company}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                
                <div className="flex items-center gap-2 w-full lg:w-auto shrink-0 justify-end">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="h-9 px-3 gap-2 bg-white text-[13px]">
                                <Columns className="w-4 h-4 text-slate-500" /> Columns
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-64 p-0">
                            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                                <div>
                                    <p className="text-[13px] font-semibold text-slate-900">Manage Columns</p>
                                    <p className="text-[11px] text-slate-500 mt-0.5">Show or reorder columns</p>
                                </div>
                            </div>
                            <div className="max-h-[300px] overflow-y-auto p-1.5 flex flex-col gap-0.5">
                                {columns.map((col, idx) => (
                                    <div key={col.id} className="flex items-center justify-between px-2.5 py-1.5 hover:bg-slate-50 rounded-md group">
                                        <div className="flex items-center gap-3">
                                            <Checkbox checked={col.visible} onCheckedChange={(v) => toggleColumn(col.id, !!v)} />
                                            <span className="text-[13px] text-slate-700">{col.label}</span>
                                        </div>
                                        <div className="flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-slate-900" disabled={idx === 0} onClick={() => moveColumn(idx, -1)}>
                                                <ChevronUp className="h-3 w-3" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-slate-900" disabled={idx === columns.length - 1} onClick={() => moveColumn(idx, 1)}>
                                                <ChevronDown className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>

                    <Button variant="outline" size="sm" onClick={handleExport} className="h-9 px-3 gap-2 bg-white text-[13px]">
                        <Download className="w-4 h-4 text-slate-500" /> Export
                    </Button>

                    <PermissionGate resource="contacts" action="create">
                        {/* Import Button */}
                        <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="h-9 px-3 gap-2 bg-white text-[13px]">
                            <Upload className="w-4 h-4 text-slate-500" /> Import
                        </Button>
                        <Button
                            className="h-9 bg-slate-900 hover:bg-slate-800 text-white shadow-sm rounded-lg px-4 text-[13px]"
                            onClick={() => setAddContactOpen(true)}
                        >
                            <Plus className="w-4 h-4 mr-1.5" /> Add Contact
                        </Button>
                    </PermissionGate>
                </div>
            </div>

            {/* Bulk Action Banner */}
            {selectedIds.size > 0 && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-blue-700 text-[13px] rounded-lg flex items-center justify-between animate-in fade-in slide-in-from-top-4">
                    <span><strong>{selectedIds.size}</strong> contacts selected.</span>
                    <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} className="h-8 hover:bg-blue-100 text-blue-700">Cancel</Button>
                        <PermissionGate resource="contacts" action="delete">
                            <Button variant="destructive" size="sm" onClick={handleBulkDelete} className="h-8">
                                <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Selected
                            </Button>
                        </PermissionGate>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </div>
            ) : contacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 mb-4">
                        <Users className="h-6 w-6 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">No contacts found</h3>
                    <p className="text-sm text-slate-500 mt-1 max-w-sm">
                        Get started by creating a new contact and linking them to a client company.
                    </p>
                    <PermissionGate resource="contacts" action="create">
                        <Button className="mt-6 h-9 bg-slate-900 text-white rounded-lg" onClick={() => setAddContactOpen(true)}>
                            <Plus className="w-4 h-4 mr-2" /> Add First Contact
                        </Button>
                    </PermissionGate>
                </div>
            ) : (
                <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden flex flex-col min-h-0 flex-1 relative z-0">
                    <div className="overflow-auto flex-1">
                        <Table className="w-full">
                            <TableHeader className="bg-slate-50 sticky top-0 z-30 shadow-[0_1px_0_0_#e2e8f0]">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="h-10 px-4 min-w-[40px] max-w-[40px] w-[40px] text-center align-middle sticky left-0 bg-slate-50 z-40 shadow-[1px_0_0_0_#e2e8f0]">
                                        <Checkbox 
                                            checked={paginatedData.length > 0 && selectedIds.size === paginatedData.length}
                                            onCheckedChange={toggleSelectAll}
                                            aria-label="Select all current page"
                                        />
                                    </TableHead>
                                    <TableHead className="h-10 px-2 min-w-[40px] max-w-[40px] w-[40px] text-center align-middle text-[11px] font-semibold text-slate-500 uppercase sticky left-[40px] bg-slate-50 z-40 shadow-[1px_0_0_0_#e2e8f0]">
                                        No.
                                    </TableHead>
                                    {activeCols.map((col, index) => {
                                        const isSticky = index < 2; // freeze first 2
                                        const isLastSticky = index === Math.min(1, activeCols.length - 1);
                                        const leftPos = index === 0 ? 80 : (index === 1 ? 80 + activeCols[0].width : undefined);
                                        const stickyShadow = isLastSticky ? 'inset -1px 0 0 0 #cbd5e1, 5px 0 10px -2px rgba(0,0,0,0.08)' : 'inset -1px 0 0 0 #e2e8f0';
                                        const style = isSticky ? { left: `${leftPos}px`, minWidth: `${col.width}px`, maxWidth: `${col.width}px`, width: `${col.width}px`, boxShadow: stickyShadow } : { minWidth: `${col.width}px`, maxWidth: `${col.width}px`, width: `${col.width}px` };
                                        const className = `h-10 px-4 align-middle text-[11px] font-semibold tracking-wider text-slate-500 uppercase ${isSticky ? 'sticky bg-slate-50 z-40' : ''}`;
                                        const isSortable = ["full_name", "company", "job_title", "email", "phone"].includes(col.id);
                                        const sortKey = col.id === "company" ? "client_company" : col.id;
                                        
                                        return (
                                            <TableHead key={col.id} className={className} style={style}>
                                                {isSortable ? (
                                                    <button onClick={() => handleSort(sortKey)} className="flex items-center gap-1.5 hover:text-slate-900 transition-colors">
                                                        {col.label} <ArrowUpDown className="w-3 h-3 opacity-40 shrink-0" />
                                                    </button>
                                                ) : col.label}
                                            </TableHead>
                                        );
                                    })}
                                    <TableHead className="h-10 px-4 align-middle min-w-[60px] max-w-[60px] w-[60px] sticky right-0 bg-slate-50 z-40 shadow-[-1px_0_0_0_#e2e8f0]" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={activeCols.length + 3} className="text-center py-16">
                                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                                <Search className="h-8 w-8 text-slate-300" />
                                                <p className="text-sm">No contacts match your filters.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedData.map((contact, idx) => (
                                        <TableRow
                                            key={contact.id}
                                            onClick={() => router.push(`/contacts/${contact.id}`)}
                                            className={`${selectedIds.has(contact.id) ? "bg-blue-50/50 hover:bg-blue-50/80" : "hover:bg-slate-50"} border-b border-slate-100 transition-colors cursor-pointer group`}
                                        >
                                            <TableCell className={`px-4 py-2 text-center align-middle sticky left-0 z-20 shadow-[1px_0_0_0_#e2e8f0] transition-colors ${selectedIds.has(contact.id) ? "bg-[#f1f6fd] group-hover:bg-[#e8f1fb]" : "bg-white group-hover:bg-slate-50"}`} onClick={(e) => e.stopPropagation()}>
                                                <Checkbox 
                                                    checked={selectedIds.has(contact.id)}
                                                    onCheckedChange={() => toggleSelect(contact.id)}
                                                    aria-label={`Select ${contact.full_name}`}
                                                />
                                            </TableCell>
                                            <TableCell className={`px-2 py-2 text-center align-middle text-[12px] text-slate-400 font-medium sticky left-[40px] z-20 shadow-[1px_0_0_0_#e2e8f0] transition-colors ${selectedIds.has(contact.id) ? "bg-[#f1f6fd] group-hover:bg-[#e8f1fb]" : "bg-white group-hover:bg-slate-50"}`}>
                                                {(currentPage - 1) * itemsPerPage + idx + 1}
                                            </TableCell>
                                            
                                            {activeCols.map((col, index) => {
                                                const isSticky = index < 2;
                                                const isLastSticky = index === Math.min(1, activeCols.length - 1);
                                                const leftPos = index === 0 ? 80 : (index === 1 ? 80 + activeCols[0].width : undefined);
                                                const isSelected = selectedIds.has(contact.id);
                                                const stickyShadow = isLastSticky ? 'inset -1px 0 0 0 #cbd5e1, 5px 0 10px -2px rgba(0,0,0,0.08)' : 'inset -1px 0 0 0 #e2e8f0';
                                                const style: React.CSSProperties = isSticky ? { left: `${leftPos}px`, minWidth: `${col.width}px`, maxWidth: `${col.width}px`, width: `${col.width}px`, boxShadow: stickyShadow, backgroundColor: isSelected ? '#f1f6fd' : '#ffffff' } : { minWidth: `${col.width}px`, maxWidth: `${col.width}px`, width: `${col.width}px` };
                                                const stickyClass = isSticky ? `sticky z-20 transition-colors` : 'text-slate-500';
                                                const className = `px-4 py-2 align-middle text-[13px] truncate ${stickyClass}`;
                                        
                                                return (
                                                    <TableCell key={col.id} className={className} style={style} title={["notes", "address"].includes(col.id) ? (contact as any)[col.id] || "" : ""}>
                                                        {renderCellContent(col.id, contact)}
                                                    </TableCell>
                                                );
                                            })}

                                            <TableCell className={`px-4 py-2 align-middle text-right sticky right-0 z-20 shadow-[-1px_0_0_0_#e2e8f0] transition-colors ${selectedIds.has(contact.id) ? "bg-[#f1f6fd] group-hover:bg-[#e8f1fb]" : "bg-white group-hover:bg-slate-50"}`} onClick={(e) => e.stopPropagation()}>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-7 w-7 p-0 hover:bg-slate-200">
                                                            <MoreHorizontal className="h-4 w-4 text-slate-500" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-40">
                                                        <PermissionGate resource="contacts" action="update">
                                                            <DropdownMenuItem onClick={() => openEditSheet(contact)}>
                                                                <Pencil className="w-4 h-4 mr-2" /> Edit
                                                            </DropdownMenuItem>
                                                        </PermissionGate>
                                                        <PermissionGate resource="contacts" action="delete">
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(contact)}>
                                                                <Trash2 className="w-4 h-4 mr-2" /> Delete
                                                            </DropdownMenuItem>
                                                        </PermissionGate>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    {/* Pagination Footer */}
                    <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50/50 gap-4 sm:gap-0 mt-auto">
                        <div className="text-[13px] text-slate-500 font-medium">
                            Showing <span className="text-slate-900 font-semibold">{filteredData.length === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1}</span> to <span className="text-slate-900 font-semibold">{Math.min(currentPage * itemsPerPage, filteredData.length)}</span> of <span className="text-slate-900 font-semibold">{filteredData.length}</span> entries
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-[13px] text-slate-500">Rows per page:</span>
                                <Select value={itemsPerPage.toString()} onValueChange={(val) => setItemsPerPage(Number(val))}>
                                    <SelectTrigger className="h-8 w-[70px] text-[13px] bg-white border-slate-200">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="10">10</SelectItem>
                                        <SelectItem value="20">20</SelectItem>
                                        <SelectItem value="50">50</SelectItem>
                                        <SelectItem value="100">100</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))} disabled={currentPage === 1} className="h-8 px-3 text-xs bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900">
                                    Previous
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0} className="h-8 px-3 text-xs bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900">
                                    Next
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <AddContactModal
                isOpen={addContactOpen}
                onOpenChange={(open) => {
                    setAddContactOpen(open)
                    if (!open) setEditingContact(undefined)
                }}
                initialData={editingContact}
                onSuccess={fetchContacts}
            />
            
            <ImportContactsModal 
                open={importOpen}
                onOpenChange={setImportOpen}
                onSuccess={fetchContacts}
            />



            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the <strong className="text-foreground">{selectedIds.size}</strong> selected contacts and remove their data from our servers. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={(e) => { e.preventDefault(); executeBulkDelete(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}