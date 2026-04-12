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
import { AddCompanyModal } from "@/features/companies/components/add-company-modal"
import { CompanyDetailSheet } from "@/features/companies/components/company-detail-sheet"
import { AddContactModal } from "@/features/contacts/components/add-contact-modal"
import { ImportCompaniesModal } from "@/features/companies/components/import-companies-modal"
import { PermissionGate } from "@/features/users/components/permission-gate"
import { toast } from "sonner"
import type { ClientCompany } from "@/types"
import * as XLSX from "xlsx"

type CompanyRow = ClientCompany & { lead_count: number; owner?: { full_name: string } | null }

type ColId = "name" | "industry" | "line_industry" | "phone" | "website" | "owner" | "parent" | "address" | "city" | "postal_code" | "country" | "created_at";

interface ColumnDef {
    id: ColId;
    label: string;
    visible: boolean;
    width: number;
}

const DEFAULT_COLUMNS: ColumnDef[] = [
    { id: "owner", label: "Owner", visible: true, width: 140 },
    { id: "name", label: "Company Name", visible: true, width: 250 },
    { id: "industry", label: "Sector", visible: true, width: 160 },
    { id: "line_industry", label: "Line Industry", visible: true, width: 160 },
    { id: "phone", label: "Phone", visible: true, width: 140 },
    { id: "website", label: "Website", visible: true, width: 180 },
    { id: "parent", label: "Parent Company", visible: false, width: 200 },
    { id: "address", label: "Address", visible: false, width: 250 },
    { id: "city", label: "City", visible: false, width: 130 },
    { id: "postal_code", label: "Postal Code", visible: false, width: 120 },
    { id: "country", label: "Country", visible: false, width: 130 },
    { id: "created_at", label: "Date Added", visible: false, width: 120 },
];

export default function CompaniesPage() {
    const router = useRouter()
    const [isMounted, setIsMounted] = useState(false)
    const [companies, setCompanies] = useState<CompanyRow[]>([])
    const [loading, setLoading] = useState(true)
    const [addOpen, setAddOpen] = useState(false)
    const [selectedCompany, setSelectedCompany] = useState<CompanyRow | null>(null)
    const [sheetOpen, setSheetOpen] = useState(false)
    const [addContactOpen, setAddContactOpen] = useState(false)
    const [addContactCompanyId, setAddContactCompanyId] = useState<string | null>(null)
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
    const [importOpen, setImportOpen] = useState(false)

    useEffect(() => {
        setIsMounted(true)
    }, [])

    // Data Table State
    const [searchQuery, setSearchQuery] = useState("")
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null)
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(20)

    // Selection State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

    // Column Ordering State
    const [columns, setColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS)

    useEffect(() => {
        const stored = localStorage.getItem("companies_cols_order")
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
        localStorage.setItem("companies_cols_order", JSON.stringify(next))
    }

    const moveColumn = (index: number, direction: -1 | 1) => {
        if (index + direction < 0 || index + direction >= columns.length) return
        const next = [...columns]
        const temp = next[index]
        next[index] = next[index + direction]
        next[index + direction] = temp
        setColumns(next)
        localStorage.setItem("companies_cols_order", JSON.stringify(next))
    }

    const supabase = createClient()

    const fetchCompanies = useCallback(async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from("client_companies")
            .select("id, name, industry, line_industry, website, phone, address, area, street_address, city, postal_code, country, parent_id, owner_id, created_at, parent:parent_id(id, name), owner:profiles!client_companies_owner_id_fkey(full_name)")
            .order("name", { ascending: true })
        if (error) {
            console.warn("[Companies Fetch]:", error.message || error)
            toast.error("Failed to load company data")
            setLoading(false)
            return
        }
        setCompanies(
            ((data as unknown as CompanyRow[]) || []).map((c) => ({ ...c, lead_count: 0 })),
        )
        setLoading(false)
    }, [])

    useEffect(() => { fetchCompanies() }, [fetchCompanies])

    const filteredData = useMemo(() => {
        return companies.filter((item) => {
            const q = searchQuery.toLowerCase()
            return (
                (item.name || "").toLowerCase().includes(q) ||
                (item.industry || "").toLowerCase().includes(q) ||
                (item.line_industry || "").toLowerCase().includes(q) ||
                (item.phone || "").toLowerCase().includes(q) ||
                (item.website || "").toLowerCase().includes(q) ||
                (item.owner?.full_name || "").toLowerCase().includes(q)
            )
        })
    }, [companies, searchQuery])

    const sortedData = useMemo(() => {
        return [...filteredData].sort((a: any, b: any) => {
            if (!sortConfig) return 0
            const { key, direction } = sortConfig
            
            const valA = key === "owner" ? a.owner?.full_name || "" : (key === "parent" ? a.parent?.name || "" : a[key] || "")
            const valB = key === "owner" ? b.owner?.full_name || "" : (key === "parent" ? b.parent?.name || "" : b[key] || "")
            
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
    useEffect(() => { setCurrentPage(1) }, [searchQuery, itemsPerPage])

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
        const { error } = await supabase.from("client_companies").delete().in("id", ids)
        if (error) { toast.error(error.message || "Failed to delete companies"); return }
        
        toast.success(`${ids.length} companies deleted`)
        setSelectedIds(new Set())
        setDeleteConfirmOpen(false)
        fetchCompanies()
    }

    const handleExport = () => {
        const headers = ["ID", "Name", "Parent Company", "Sector", "Line Industry", "Phone", "Website", "Owner", "Address", "City", "Postal Code", "Country", "Created At"]
        const rows = sortedData.map(c => [
            c.id,
            c.name || "",
            (c as any).parent?.name || "",
            c.industry || "",
            c.line_industry || "",
            c.phone || "",
            c.website || "",
            c.owner?.full_name || "",
            c.address || "",
            c.city || "",
            c.postal_code || "",
            c.country || "",
            c.created_at ? new Date(c.created_at).toLocaleDateString() : ""
        ])
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Companies")
        XLSX.writeFile(wb, `companies_export_${new Date().toISOString().split("T")[0]}.xlsx`)
    }

    const getInitials = (name: string) => {
        if (!name) return "?"
        return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    }

    const handleRowClick = (company: CompanyRow) => { router.push(`/companies/${company.id}`) }
    const handleAddContact = (companyId: string) => { setAddContactCompanyId(companyId); setAddContactOpen(true) }

    const handleDelete = async (company: CompanyRow) => {
        if (!confirm(`Are you sure you want to delete ${company.name}?`)) return
        const { error } = await supabase.from("client_companies").delete().eq("id", company.id)
        if (error) { toast.error("Failed to delete company"); return }
        toast.success("Company deleted")
        fetchCompanies()
        if (selectedCompany?.id === company.id) setSheetOpen(false)
    }

    const activeCols = columns.filter(c => c.visible)

    const renderCellContent = (colId: ColId, company: CompanyRow) => {
        switch (colId) {
            case "name":
                return (
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-semibold text-slate-600 shrink-0">
                            {getInitials(company.name)}
                        </div>
                        <div>
                            <span className="font-medium text-[13px] text-slate-900 group-hover:text-blue-600 transition-colors truncate block">{company.name}</span>
                            {company.parent?.name && <p className="text-[11px] text-muted-foreground truncate">{company.parent.name}</p>}
                        </div>
                    </div>
                );
            case "industry":
                return company.industry ? (
                    <div className="flex items-center gap-2"><Briefcase className="w-3 h-3 text-slate-400 shrink-0" /><span className="truncate">{company.industry}</span></div>
                ) : <span className="text-slate-400">&mdash;</span>;
            case "line_industry":
                return company.line_industry ? (
                    <span className="truncate text-slate-700">{company.line_industry}</span>
                ) : <span className="text-slate-400">&mdash;</span>;
            case "phone":
                return company.phone ? (
                    <div className="flex items-center gap-2"><Phone className="w-3 h-3 text-slate-400 shrink-0" /><span className="truncate">{company.phone}</span></div>
                ) : <span className="text-slate-400">&mdash;</span>;
            case "website":
                return company.website ? (
                    <a href={company.website.startsWith("http") ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-600 hover:underline" onClick={(e) => e.stopPropagation()}>
                        <Globe className="w-3 h-3 shrink-0" /><span className="truncate">{company.website}</span>
                    </a>
                ) : <span className="text-slate-400">&mdash;</span>;
            case "owner":
                return company.owner?.full_name ? (
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-600 shrink-0">
                            {getInitials(company.owner.full_name)}
                        </div>
                        <span className="truncate">{company.owner.full_name}</span>
                    </div>
                ) : <span className="text-slate-400">&mdash;</span>;
            case "parent":
                return company.parent?.name ? <span className="truncate">{company.parent.name}</span> : <span className="text-slate-400">&mdash;</span>;
            case "address":
                return company.address ? <span className="truncate">{company.address}</span> : <span className="text-slate-400">&mdash;</span>;
            case "city":
                return company.city ? <span className="truncate">{company.city}</span> : <span className="text-slate-400">&mdash;</span>;
            case "postal_code":
                return company.postal_code ? <span className="truncate">{company.postal_code}</span> : <span className="text-slate-400">&mdash;</span>;
            case "country":
                return company.country ? <span className="truncate">{company.country}</span> : <span className="text-slate-400">&mdash;</span>;
            case "created_at":
                return company.created_at ? new Date(company.created_at).toLocaleDateString() : <span className="text-slate-400">&mdash;</span>;
            default:
                return null;
        }
    }

    if (!isMounted) {
        return null; // Bypass SSR/Hydration discrepancies 
    }

    return (
        <div className="w-full h-[calc(100vh-64px)] sm:h-full max-w-[1600px] mx-auto px-4 sm:px-6 py-6 bg-slate-50 flex flex-col overflow-hidden">
            <div className="mb-6 shrink-0">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Companies</h1>
                <p className="text-sm text-slate-500 mt-1">Manage your client organizations and their details.</p>
            </div>
            
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6 shrink-0">
                <div className="flex flex-1 items-center gap-3 w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0">
                    <div className="relative w-[280px] shrink-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        <Input
                            placeholder="Search companies..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-9 w-full bg-white border-slate-200 hover:border-slate-300 focus-visible:ring-1 focus-visible:ring-slate-400 text-[13px] shadow-sm rounded-lg"
                        />
                    </div>
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

                    <PermissionGate resource="companies" action="create">
                        <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="h-9 px-3 gap-2 bg-white text-[13px]">
                            <Upload className="w-4 h-4 text-slate-500" /> Import
                        </Button>
                        <Button
                            className="h-9 bg-slate-900 hover:bg-slate-800 text-white shadow-sm rounded-lg px-4 text-[13px]"
                            onClick={() => { setSelectedCompany(null); setAddOpen(true); }}
                        >
                            <Plus className="w-4 h-4 mr-1.5" /> Add Company
                        </Button>
                    </PermissionGate>
                </div>
            </div>

            {/* Bulk Action Banner */}
            {selectedIds.size > 0 && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-blue-700 text-[13px] rounded-lg flex items-center justify-between animate-in fade-in slide-in-from-top-4">
                    <span><strong>{selectedIds.size}</strong> companies selected.</span>
                    <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} className="h-8 hover:bg-blue-100 text-blue-700">Cancel</Button>

                        <PermissionGate resource="companies" action="delete">
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
            ) : companies.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 mb-4">
                        <Building2 className="h-6 w-6 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">No companies found</h3>
                    <p className="text-sm text-slate-500 mt-1 max-w-sm">Get started by adding a client company to associate with your leads.</p>
                    <PermissionGate resource="companies" action="create">
                        <Button className="mt-6 h-9 bg-slate-900 text-white rounded-lg" onClick={() => { setSelectedCompany(null); setAddOpen(true); }}>
                            <Plus className="w-4 h-4 mr-2" /> Add First Company
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
                                        const style: React.CSSProperties = isSticky ? { left: `${leftPos}px`, minWidth: `${col.width}px`, maxWidth: `${col.width}px`, width: `${col.width}px`, boxShadow: stickyShadow } : { minWidth: `${col.width}px`, maxWidth: `${col.width}px`, width: `${col.width}px` };
                                        const className = `h-10 px-4 align-middle text-[11px] font-semibold tracking-wider text-slate-500 uppercase ${isSticky ? 'sticky bg-slate-50 z-40' : ''}`;
                                        const isSortable = ["name", "industry", "owner", "phone", "website", "city", "country"].includes(col.id);
                                        
                                        return (
                                            <TableHead key={col.id} className={className} style={style}>
                                                <div className="truncate w-full">
                                                    {isSortable ? (
                                                        <button onClick={() => handleSort(col.id)} className="flex items-center gap-1.5 hover:text-slate-900 transition-colors w-full">
                                                            <span className="truncate">{col.label}</span> <ArrowUpDown className="w-3 h-3 opacity-40 shrink-0" />
                                                        </button>
                                                    ) : col.label}
                                                </div>
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
                                                <Building2 className="h-8 w-8 text-slate-300" />
                                                <p className="text-sm">No companies match your filters.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedData.map((company, idx) => (
                                        <TableRow
                                            key={company.id}
                                            onClick={() => handleRowClick(company)}
                                            className={`${selectedIds.has(company.id) ? "bg-blue-50/50 hover:bg-blue-50/80" : "hover:bg-slate-50"} border-b border-slate-100 transition-colors cursor-pointer group`}
                                        >
                                            <TableCell className={`px-4 py-2 text-center align-middle sticky left-0 z-20 shadow-[1px_0_0_0_#e2e8f0] transition-colors ${selectedIds.has(company.id) ? "bg-[#f1f6fd] group-hover:bg-[#e8f1fb]" : "bg-white group-hover:bg-slate-50"}`} onClick={(e) => e.stopPropagation()}>
                                                <Checkbox 
                                                    checked={selectedIds.has(company.id)}
                                                    onCheckedChange={() => toggleSelect(company.id)}
                                                    aria-label={`Select ${company.name}`}
                                                />
                                            </TableCell>
                                            <TableCell className={`px-2 py-2 text-center align-middle text-[12px] text-slate-400 font-medium sticky left-[40px] z-20 shadow-[1px_0_0_0_#e2e8f0] transition-colors ${selectedIds.has(company.id) ? "bg-[#f1f6fd] group-hover:bg-[#e8f1fb]" : "bg-white group-hover:bg-slate-50"}`}>
                                                {(currentPage - 1) * itemsPerPage + idx + 1}
                                            </TableCell>
                                            
                                            {activeCols.map((col, index) => {
                                                const isSticky = index < 2;
                                                const isLastSticky = index === Math.min(1, activeCols.length - 1);
                                                const leftPos = index === 0 ? 80 : (index === 1 ? 80 + activeCols[0].width : undefined);
                                                const isSelected = selectedIds.has(company.id);
                                                const stickyShadow = isLastSticky ? 'inset -1px 0 0 0 #cbd5e1, 5px 0 10px -2px rgba(0,0,0,0.08)' : 'inset -1px 0 0 0 #e2e8f0';
                                                const style: React.CSSProperties = isSticky ? { left: `${leftPos}px`, minWidth: `${col.width}px`, maxWidth: `${col.width}px`, width: `${col.width}px`, boxShadow: stickyShadow, backgroundColor: isSelected ? '#f1f6fd' : '#ffffff' } : { minWidth: `${col.width}px`, maxWidth: `${col.width}px`, width: `${col.width}px` };
                                                const stickyClass = isSticky ? `sticky z-20 transition-colors` : 'text-slate-500';
                                                const className = `px-4 py-2 align-middle text-[13px] ${stickyClass}`;
                                        
                                                return (
                                                    <TableCell key={col.id} className={className} style={style} title={["address", "industry"].includes(col.id) ? (company as any)[col.id] || "" : ""}>
                                                        <div className="truncate w-full">
                                                            {renderCellContent(col.id, company)}
                                                        </div>
                                                    </TableCell>
                                                );
                                            })}

                                            <TableCell className={`px-4 py-2 align-middle text-right sticky right-0 z-20 shadow-[-1px_0_0_0_#e2e8f0] transition-colors ${selectedIds.has(company.id) ? "bg-[#f1f6fd] group-hover:bg-[#e8f1fb]" : "bg-white group-hover:bg-slate-50"}`} onClick={(e) => e.stopPropagation()}>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-7 w-7 p-0 hover:bg-slate-200">
                                                            <MoreHorizontal className="h-4 w-4 text-slate-500" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-40">
                                                        <PermissionGate resource="companies" action="update">
                                                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedCompany(company); setAddOpen(true); }}>
                                                                <Pencil className="w-4 h-4 mr-2" /> Edit
                                                            </DropdownMenuItem>
                                                        </PermissionGate>
                                                        <PermissionGate resource="companies" action="delete">
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(company)}>
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

            <AddCompanyModal open={addOpen} onOpenChange={setAddOpen} onCreated={fetchCompanies} initialData={selectedCompany} />
            <CompanyDetailSheet company={selectedCompany} open={sheetOpen} onOpenChange={setSheetOpen} onAddContact={handleAddContact} />
            <AddContactModal isOpen={addContactOpen} onOpenChange={setAddContactOpen} preselectedCompanyId={addContactCompanyId} onSuccess={fetchCompanies} />
            <ImportCompaniesModal open={importOpen} onOpenChange={setImportOpen} onSuccess={fetchCompanies} />

            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the <strong className="text-foreground">{selectedIds.size}</strong> selected companies and remove their data from our servers. This action cannot be undone.
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
