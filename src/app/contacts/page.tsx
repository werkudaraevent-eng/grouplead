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
import { Users, Search, Mail, Phone, Building2, Briefcase, Loader2, Inbox } from "lucide-react"

interface Contact {
    contact_full_name: string
    salutation: string | null
    job_title: string | null
    contact_email: string | null
    contact_mobile: string | null
    company_name: string | null
    project_name: string | null
}

export default function ContactsPage() {
    const [contacts, setContacts] = useState<Contact[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")

    const supabase = createClient()

    const fetchContacts = useCallback(async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from("leads")
            .select("contact_full_name, salutation, job_title, contact_email, contact_mobile, company_name, project_name")
            .not("contact_full_name", "is", null)
            .order("contact_full_name", { ascending: true })

        if (error) {
            console.error("Error fetching contacts:", error)
            setLoading(false)
            return
        }

        // Deduplicate by contact name + company
        const seen = new Set<string>()
        const unique: Contact[] = []
        for (const row of data || []) {
            const key = `${row.contact_full_name}|${row.company_name}`
            if (!seen.has(key)) {
                seen.add(key)
                unique.push(row as Contact)
            }
        }

        setContacts(unique)
        setLoading(false)
    }, [])

    useEffect(() => {
        fetchContacts()
    }, [fetchContacts])

    const filtered = contacts.filter((c) => {
        const q = search.toLowerCase()
        return (
            !q ||
            c.contact_full_name.toLowerCase().includes(q) ||
            (c.company_name || "").toLowerCase().includes(q) ||
            (c.contact_email || "").toLowerCase().includes(q) ||
            (c.job_title || "").toLowerCase().includes(q)
        )
    })

    const getInitials = (name: string | null, salutation: string | null) => {
        const clean = (name || "").replace(salutation || "", "").trim()
        if (!clean) return "?"
        return clean
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2)
    }

    return (
        <div className="p-6 lg:p-8 space-y-6 max-w-6xl">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <Users className="h-6 w-6 text-primary" />
                    Contacts
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Client contact persons extracted from lead data. {contacts.length} contacts found.
                </p>
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search name, company, or email..."
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
                            <TableHead className="w-[250px]">Contact</TableHead>
                            <TableHead>Company</TableHead>
                            <TableHead>Title</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Phone</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-16">
                                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                </TableCell>
                            </TableRow>
                        )}
                        {!loading && filtered.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-16">
                                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                        <Inbox className="h-8 w-8" />
                                        <p className="text-sm">No contacts found.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                        {filtered.map((contact, i) => (
                            <TableRow key={`${contact.contact_full_name}-${i}`} className="hover:bg-muted/30 transition-colors">
                                {/* Contact */}
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                            {getInitials(contact.contact_full_name, contact.salutation)}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-semibold text-sm truncate">
                                                {[contact.salutation, contact.contact_full_name].filter(Boolean).join(" ")}
                                            </p>
                                        </div>
                                    </div>
                                </TableCell>

                                {/* Company */}
                                <TableCell>
                                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                        <Building2 className="h-3 w-3 shrink-0" />
                                        <span className="truncate">{contact.company_name || "—"}</span>
                                    </div>
                                </TableCell>

                                {/* Title */}
                                <TableCell>
                                    {contact.job_title ? (
                                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                            <Briefcase className="h-3 w-3 shrink-0" />
                                            <span className="truncate">{contact.job_title}</span>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-muted-foreground">—</span>
                                    )}
                                </TableCell>

                                {/* Email */}
                                <TableCell>
                                    {contact.contact_email ? (
                                        <a href={`mailto:${contact.contact_email}`} className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                                            <Mail className="h-3 w-3 shrink-0" />
                                            <span className="truncate">{contact.contact_email}</span>
                                        </a>
                                    ) : (
                                        <span className="text-xs text-muted-foreground">—</span>
                                    )}
                                </TableCell>

                                {/* Phone */}
                                <TableCell>
                                    {contact.contact_mobile ? (
                                        <a href={`tel:${contact.contact_mobile}`} className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                                            <Phone className="h-3 w-3 shrink-0" />
                                            {contact.contact_mobile}
                                        </a>
                                    ) : (
                                        <span className="text-xs text-muted-foreground">—</span>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
