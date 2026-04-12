"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/utils/supabase/client"
import {
    Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import {
    Plus, Mail, Phone, Briefcase, Globe, MapPin, Building2, Users, Loader2,
} from "lucide-react"
import type { ClientCompany, Contact } from "@/types"

interface CompanyDetailSheetProps {
    company: (ClientCompany & { lead_count: number }) | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onAddContact: (companyId: string) => void
}

export function CompanyDetailSheet({
    company, open, onOpenChange, onAddContact,
}: CompanyDetailSheetProps) {
    const supabase = createClient()
    const [contacts, setContacts] = useState<Contact[]>([])
    const [loading, setLoading] = useState(false)

    const fetchContacts = useCallback(async () => {
        if (!company?.id) return
        setLoading(true)
        const { data } = await supabase
            .from("contacts")
            .select("*")
            .eq("client_company_id", company.id)
            .order("full_name")
        setContacts(data ?? [])
        setLoading(false)
    }, [company?.id])

    useEffect(() => {
        if (open && company?.id) fetchContacts()
        if (!open) setContacts([])
    }, [open, company?.id, fetchContacts])

    if (!company) return null

    const initials = (name: string) =>
        name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                className="w-full sm:max-w-2xl overflow-y-auto bg-slate-50 p-0 border-l border-slate-200"
                showCloseButton
            >
                <SheetHeader className="p-6 bg-white border-b border-slate-200 sticky top-0 z-10">
                    <SheetTitle className="text-2xl font-bold">{company.name}</SheetTitle>
                    <SheetDescription>
                        {[company.industry, company.phone].filter(Boolean).join(" • ") || "No details"}
                    </SheetDescription>
                </SheetHeader>

                <div className="p-6 space-y-6">
                    {/* Company Info */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                        <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">Company Details</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            {company.industry && (
                                <div className="flex items-start gap-2">
                                    <Briefcase className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                                    <div><p className="text-slate-500 text-xs">Sector</p><p className="text-slate-900">{company.industry}</p></div>
                                </div>
                            )}
                            {company.line_industry && (
                                <div className="flex items-start gap-2">
                                    <svg className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6.75h1.5m-1.5 3h1.5m-1.5 3h1.5M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                                    </svg>
                                    <div><p className="text-slate-500 text-xs">Line Industry</p><p className="text-slate-900">{company.line_industry}</p></div>
                                </div>
                            )}
                            {company.phone && (
                                <div className="flex items-start gap-2">
                                    <Phone className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                                    <div><p className="text-slate-500 text-xs">Phone</p><p className="text-slate-900">{company.phone}</p></div>
                                </div>
                            )}
                            {company.website && (
                                <div className="flex items-start gap-2">
                                    <Globe className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                                    <div><p className="text-slate-500 text-xs">Website</p><a href={company.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{company.website}</a></div>
                                </div>
                            )}
                            {company.area && (
                                <div className="flex items-start gap-2">
                                    <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                                    <div><p className="text-slate-500 text-xs">Region / Area</p><p className="text-slate-900">{company.area}</p></div>
                                </div>
                            )}
                            {company.address && (
                                <div className="flex items-start gap-2 col-span-2">
                                    <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                                    <div><p className="text-slate-500 text-xs">Address</p><p className="text-slate-900">{company.address}</p></div>
                                </div>
                            )}
                            {company.parent?.name && (
                                <div className="flex items-start gap-2">
                                    <Building2 className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                                    <div><p className="text-slate-500 text-xs">Parent Company</p><p className="text-slate-900">{company.parent.name}</p></div>
                                </div>
                            )}
                            <div className="flex items-start gap-2">
                                <Briefcase className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                                <div><p className="text-slate-500 text-xs">Active Leads</p><p className="text-slate-900 font-semibold">{company.lead_count}</p></div>
                            </div>
                        </div>
                    </div>

                    {/* Associated Contacts */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Associated Contacts</h4>
                            <Button size="sm" variant="outline" onClick={() => onAddContact(company.id)}>
                                <Plus className="w-4 h-4 mr-2" /> Add Contact
                            </Button>
                        </div>
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                            </div>
                        ) : contacts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                <Users className="h-8 w-8 text-slate-300 mb-2" />
                                <p className="text-sm text-slate-500">No contacts linked yet.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {contacts.map(contact => (
                                    <div key={contact.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                                        <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                                            {initials(contact.full_name)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-900 truncate">
                                                {contact.salutation ? `${contact.salutation} ` : ""}{contact.full_name}
                                            </p>
                                            <div className="flex items-center gap-3 mt-0.5">
                                                {contact.job_title && <span className="text-xs text-slate-500 truncate">{contact.job_title}</span>}
                                                {contact.email && (
                                                    <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                                                        <Mail className="h-3 w-3" />{contact.email}
                                                    </a>
                                                )}
                                                {contact.phone && (
                                                    <span className="flex items-center gap-1 text-xs text-slate-500"><Phone className="h-3 w-3" />{contact.phone}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}
