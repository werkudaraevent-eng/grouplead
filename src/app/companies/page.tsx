"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/utils/supabase/client"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Building2, Search, MapPin, Briefcase, Globe, Loader2, Inbox } from "lucide-react"

interface Company {
    company_name: string
    main_company: string | null
    sector: string | null
    line_industry: string | null
    area: string | null
    client_province_country: string | null
    lead_count: number
}

export default function CompaniesPage() {
    const [companies, setCompanies] = useState<Company[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")

    const supabase = createClient()

    const fetchCompanies = useCallback(async () => {
        setLoading(true)
        // Derive unique companies from the leads table
        const { data, error } = await supabase
            .from("leads")
            .select("company_name, main_company, sector, line_industry, area, client_province_country")
            .not("company_name", "is", null)
            .order("company_name", { ascending: true })

        if (error) {
            console.error("Error fetching companies:", error)
            setLoading(false)
            return
        }

        // Group by company_name and count leads
        const map = new Map<string, Company>()
        for (const row of data || []) {
            const name = row.company_name || "Unknown"
            if (map.has(name)) {
                map.get(name)!.lead_count++
            } else {
                map.set(name, {
                    company_name: name,
                    main_company: row.main_company,
                    sector: row.sector,
                    line_industry: row.line_industry,
                    area: row.area,
                    client_province_country: row.client_province_country,
                    lead_count: 1,
                })
            }
        }

        setCompanies(Array.from(map.values()))
        setLoading(false)
    }, [])

    useEffect(() => {
        fetchCompanies()
    }, [fetchCompanies])

    const filtered = companies.filter((c) => {
        const q = search.toLowerCase()
        return (
            !q ||
            c.company_name.toLowerCase().includes(q) ||
            (c.sector || "").toLowerCase().includes(q) ||
            (c.area || "").toLowerCase().includes(q)
        )
    })

    return (
        <div className="p-6 lg:p-8 space-y-6 max-w-6xl">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <Building2 className="h-6 w-6 text-primary" />
                    Companies
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Client companies derived from your lead data. {companies.length} companies found.
                </p>
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search company, sector, or area..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-9"
                />
            </div>

            {/* Table */}
            <div className="border rounded-xl bg-card overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/30">
                            <TableHead className="w-[250px]">Company</TableHead>
                            <TableHead>Group / Parent</TableHead>
                            <TableHead>Sector</TableHead>
                            <TableHead>Industry</TableHead>
                            <TableHead>Area</TableHead>
                            <TableHead className="text-right">Leads</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-16">
                                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                </TableCell>
                            </TableRow>
                        )}
                        {!loading && filtered.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-16">
                                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                        <Inbox className="h-8 w-8" />
                                        <p className="text-sm">No companies found.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                        {filtered.map((company, i) => (
                            <TableRow key={`${company.company_name}-${i}`} className="hover:bg-muted/30 transition-colors">
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                            <Building2 className="h-4 w-4 text-primary" />
                                        </div>
                                        <span className="font-semibold text-sm">{company.company_name}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                    <div className="flex items-center gap-1.5">
                                        {company.main_company ? (
                                            <>
                                                <Globe className="h-3 w-3 shrink-0" />
                                                {company.main_company}
                                            </>
                                        ) : "—"}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {company.sector ? (
                                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                                            {company.sector}
                                        </span>
                                    ) : (
                                        <span className="text-xs text-muted-foreground">—</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                    <div className="flex items-center gap-1.5">
                                        {company.line_industry ? (
                                            <>
                                                <Briefcase className="h-3 w-3 shrink-0" />
                                                {company.line_industry}
                                            </>
                                        ) : "—"}
                                    </div>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                    <div className="flex items-center gap-1.5">
                                        {company.area ? (
                                            <>
                                                <MapPin className="h-3 w-3 shrink-0" />
                                                {company.area}
                                            </>
                                        ) : "—"}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <span className="text-sm font-semibold text-foreground bg-muted px-2 py-0.5 rounded-full">
                                        {company.lead_count}
                                    </span>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
