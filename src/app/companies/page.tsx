"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/utils/supabase/client"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
    Building2, Search, Globe, Phone, Briefcase, Loader2, Plus, ArrowUpDown,
} from "lucide-react"
import { AddCompanyModal } from "@/features/companies/components/add-company-modal"
import { CompanyDetailSheet } from "@/features/companies/components/company-detail-sheet"
import { AddContactModal } from "@/features/contacts/components/add-contact-modal"
import { toast } from "sonner"
import type { ClientCompany } from "@/types"

type CompanyRow = ClientCompany & { lead_count: number }

export default function CompaniesPage() {
    const [companies, setCompanies] = useState<CompanyRow[]>([])
    const [loading, setLoading] = useState(true)
    const [addOpen, setAddOpen] = useState(false)
    const [selectedCompany, setSelectedCompany] = useState<CompanyRow | null>(null)
    const [sheetOpen, setSheetOpen] = useState(false)
    const [addContactOpen, setAddContactOpen] = useState(false)
    const [addContactCompanyId, setAddContactCompanyId] = useState<string | null>(null)

    // Data pipeline states
    const [searchQuery, setSearchQuery] = useState("")
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null)
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 20

    const supabase = createClient()

    const fetchCompanies = useCallback(async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from("client_companies")
            .select("id, name, industry, website, phone, address, parent_id, created_at, parent:parent_id ( id, name )")
            .order("name", { ascending: true })
        if (error) {
            console.warn("[Companies Fetch]:", error.message || error)
            toast.error("Failed to load company data")
            setLoading(false)
            return
        }
        setCompanies(
            ((data as unknown as ClientCompany[]) || []).map((c) => ({ ...c, lead_count: 0 })),
        )
        setLoading(false)
    }, [])

    useEffect(() => { fetchCompanies() }, [fetchCompanies])

    // 1. Global Filter
    const filteredData = companies.filter((item) =>
        Object.values(item).some((val) =>
            String(val).toLowerCase().includes(searchQuery.toLowerCase())
        )
    )

    // 2. Sorter
    const sortedData = [...filteredData].sort((a: any, b: any) => {
        if (!sortConfig) return 0
        const { key, direction } = sortConfig
        if (a[key] < b[key]) return direction === "asc" ? -1 : 1
        if (a[key] > b[key]) return direction === "asc" ? 1 : -1
        return 0
    })

    // 3. Paginator
    const totalPages = Math.ceil(sortedData.length / itemsPerPage)
    const paginatedData = sortedData.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    )

    // 4. Sort Trigger Handler
    const handleSort = (key: string) => {
        let direction: "asc" | "desc" = "asc"
        if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
            direction = "desc"
        }
        setSortConfig({ key, direction })
    }

    const handleRowClick = (company: CompanyRow) => { setSelectedCompany(company); setSheetOpen(true) }
    const handleAddContact = (companyId: string) => { setAddContactCompanyId(companyId); setAddContactOpen(true) }

    return (
        <div className="w-full max-w-[1400px] mx-auto px-6 py-8 md:px-10 md:py-10 bg-slate-50 min-h-screen">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div className="w-full md:w-80">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search companies..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value)
                                setCurrentPage(1)
                            }}
                            className="pl-9 bg-white shadow-sm"
                        />
                    </div>
                </div>
                <Button className="bg-slate-900 hover:bg-slate-800 text-white shadow-sm shrink-0" onClick={() => setAddOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" /> Add Company
                </Button>
            </div>
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
                    <Button className="mt-6 bg-slate-900 text-white" onClick={() => setAddOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" /> Add First Company
                    </Button>
                </div>
            ) : (
                <>
                    <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden mt-6">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="bg-slate-50/80 border-b border-slate-200 px-4 py-3 w-[280px]">
                                        <button onClick={() => handleSort("name")} className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-slate-500 font-semibold hover:text-slate-900 transition-colors">
                                            Company <ArrowUpDown className="w-3 h-3 opacity-50" />
                                        </button>
                                    </TableHead>
                                    <TableHead className="bg-slate-50/80 border-b border-slate-200 px-4 py-3">
                                        <button onClick={() => handleSort("industry")} className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-slate-500 font-semibold hover:text-slate-900 transition-colors">
                                            Industry <ArrowUpDown className="w-3 h-3 opacity-50" />
                                        </button>
                                    </TableHead>
                                    <TableHead className="bg-slate-50/80 border-b border-slate-200 px-4 py-3">
                                        <button onClick={() => handleSort("phone")} className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-slate-500 font-semibold hover:text-slate-900 transition-colors">
                                            Phone <ArrowUpDown className="w-3 h-3 opacity-50" />
                                        </button>
                                    </TableHead>
                                    <TableHead className="bg-slate-50/80 border-b border-slate-200 px-4 py-3">
                                        <button onClick={() => handleSort("website")} className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-slate-500 font-semibold hover:text-slate-900 transition-colors">
                                            Website <ArrowUpDown className="w-3 h-3 opacity-50" />
                                        </button>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-16">
                                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                                <Building2 className="h-8 w-8" />
                                                <p className="text-sm">No companies match your search.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedData.map((company) => (
                                        <TableRow key={company.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => handleRowClick(company)}>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                                        {company.name?.slice(0, 2).toUpperCase() || "?"}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-sm truncate">{company.name}</p>
                                                        {company.parent?.name && <p className="text-xs text-muted-foreground truncate">{company.parent.name}</p>}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {company.industry ? (
                                                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground"><Briefcase className="h-3 w-3 shrink-0" /><span className="truncate">{company.industry}</span></div>
                                                ) : <span className="text-xs text-muted-foreground">&mdash;</span>}
                                            </TableCell>
                                            <TableCell>
                                                {company.phone ? (
                                                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground"><Phone className="h-3 w-3 shrink-0" />{company.phone}</div>
                                                ) : <span className="text-xs text-muted-foreground">&mdash;</span>}
                                            </TableCell>
                                            <TableCell>
                                                {company.website ? (
                                                    <a href={company.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline" onClick={(e) => e.stopPropagation()}>
                                                        <Globe className="h-3 w-3 shrink-0" /><span className="truncate">{company.website}</span>
                                                    </a>
                                                ) : <span className="text-xs text-muted-foreground">&mdash;</span>}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="flex items-center justify-between px-2 py-4 border-t border-slate-200 mt-4">
                        <div className="text-sm text-slate-500">
                            Showing {filteredData.length === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} entries
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="bg-white">
                                Previous
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0} className="bg-white">
                                Next
                            </Button>
                        </div>
                    </div>
                </>
            )}

            <AddCompanyModal open={addOpen} onOpenChange={setAddOpen} onCreated={fetchCompanies} />
            <CompanyDetailSheet company={selectedCompany} open={sheetOpen} onOpenChange={setSheetOpen} onAddContact={handleAddContact} />
            <AddContactModal isOpen={addContactOpen} onOpenChange={setAddContactOpen} preselectedCompanyId={addContactCompanyId} onSuccess={fetchCompanies} />
        </div>
    )
}
