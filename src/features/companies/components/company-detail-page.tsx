"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import {
    ArrowLeft, Pencil, Building2, Phone, Globe, MapPin,
    Briefcase, FileText, Clock, Folder, Users, Mail,
    Plus, Loader2, Upload, Target, TrendingUp,
    CheckCircle2, XCircle, Search, ChevronLeft, ChevronRight
} from "lucide-react"
import type { ClientCompany, Contact } from "@/types"
import { TimelineTab } from "./timeline-tab"
import { AddCompanyModal } from "./add-company-modal"
// ═══════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════

interface CompanyLead {
    id: number
    project_name: string | null
    estimated_value: number | null
    status: string | null
    target_close_date: string | null
    pipeline_stage: { name: string; color: string } | null
    pic_sales_profile: { full_name: string } | null
}

interface CompanyData extends ClientCompany {
    parent?: { id: string; name: string } | null
    owner?: { id: string; full_name: string; email: string } | null
}

interface CompanyDetailPageProps {
    company: CompanyData
    leads: CompanyLead[]
    contactCount: number
    lastModified?: string
    lastModifiedBy?: string
    nextCompanyId?: string
    prevCompanyId?: string
}

interface CompanyNote {
    id: string
    content: string
    author_name: string | null
    created_at: string
    user_id: string | null
}

// ═══════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export function CompanyDetailPage({ company, leads, contactCount, lastModified, lastModifiedBy, nextCompanyId, prevCompanyId }: CompanyDetailPageProps) {
    const router = useRouter()
    const supabase = createClient()

    // ─── Contacts State ──────────────────────────────────
    const [contacts, setContacts] = useState<Contact[]>([])
    const [contactsLoading, setContactsLoading] = useState(true)

    // ─── Notes State ─────────────────────────────────────
    const [notes, setNotes] = useState<CompanyNote[]>([])
    const [notesLoading, setNotesLoading] = useState(true)
    const [noteText, setNoteText] = useState("")
    const [savingNote, setSavingNote] = useState(false)

    // ─── New: users for owner selection ──────────────────
    const [allUsers, setAllUsers] = useState<{id: string, full_name: string}[]>([])

    // ─── Computed Stats ──────────────────────────────────
    const activeLeads = leads.filter(l => {
        const stage = l.pipeline_stage?.name?.toLowerCase() ?? ""
        return !stage.includes("won") && !stage.includes("lost") && !stage.includes("cancel")
    })
    const wonLeads = leads.filter(l => l.pipeline_stage?.name?.toLowerCase().includes("won"))
    const totalValue = leads.reduce((sum, l) => sum + (l.estimated_value || 0), 0)
    const wonValue = wonLeads.reduce((sum, l) => sum + (l.estimated_value || 0), 0)

    // ─── Fetch Users ─────────────────────────────────────
    const fetchUsers = useCallback(async () => {
        const { data } = await supabase.from('profiles').select('id, full_name').eq('is_active', true).order('full_name')
        if (data) setAllUsers(data)
    }, [supabase])

    // ─── Fetch Contacts ──────────────────────────────────
    const fetchContacts = useCallback(async () => {
        setContactsLoading(true)
        const { data, error } = await supabase
            .from("contacts")
            .select("*")
            .eq("client_company_id", company.id)
            .order("full_name")
        setContacts(data ?? [])
        setContactsLoading(false)
    }, [company.id])

    // ─── Fetch Notes ─────────────────────────────────────
    const fetchNotes = useCallback(async () => {
        setNotesLoading(true)
        const { data } = await supabase
            .from("company_notes")
            .select("*")
            .eq("client_company_id", company.id)
            .order("created_at", { ascending: false })
        setNotes(data ?? [])
        setNotesLoading(false)
    }, [company.id])

    useEffect(() => { fetchContacts(); fetchNotes(); fetchUsers() }, [fetchContacts, fetchNotes, fetchUsers])

    // ─── Save Note ───────────────────────────────────────
    const handleSaveNote = async () => {
        if (!noteText.trim()) return
        setSavingNote(true)
        const { data: { user } } = await supabase.auth.getUser()
        const { data: profile } = await supabase
            .from("profiles").select("full_name").eq("id", user?.id ?? "").single()

        const { error } = await supabase.from("company_notes").insert({
            client_company_id: company.id,
            user_id: user?.id ?? null,
            author_name: profile?.full_name ?? "Unknown",
            content: noteText.trim(),
        })
        if (error) { toast.error("Failed to save note"); setSavingNote(false); return }
        setNoteText("")
        setSavingNote(false)
        fetchNotes()
        toast.success("Note saved")
    }

    // ─── Delete Note ─────────────────────────────────────
    const handleDeleteNote = async (noteId: string) => {
        const { error } = await supabase.from("company_notes").delete().eq("id", noteId)
        if (error) { toast.error("Failed to delete note"); return }
        fetchNotes()
    }

    // ─── Formatters ──────────────────────────────────────
    const fmtCurrency = (v: number | null | undefined) =>
        v ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v) : "—"
    const fmtDate = (d: string | null | undefined) =>
        d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"
    const fmtDateTime = (d: string | null | undefined) =>
        d ? new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"
    const initials = (name: string) =>
        name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)

    // ─── Table Search & Pagination State ─────────────────
    const ITEMS_PER_PAGE = 5
    
    // Leads
    const [leadsSearch, setLeadsSearch] = useState("")
    const [leadsPage, setLeadsPage] = useState(1)
    const filteredLeads = useMemo(() => {
        let res = leads
        if (leadsSearch) {
            const q = leadsSearch.toLowerCase()
            res = res.filter(l => l.project_name?.toLowerCase().includes(q) || l.pic_sales_profile?.full_name?.toLowerCase().includes(q))
        }
        return res
    }, [leads, leadsSearch])
    const paginatedLeads = useMemo(() => filteredLeads.slice((leadsPage - 1) * ITEMS_PER_PAGE, leadsPage * ITEMS_PER_PAGE), [filteredLeads, leadsPage])
    const leadsTotalPages = Math.ceil(filteredLeads.length / ITEMS_PER_PAGE)

    // Contacts
    const [contactsSearch, setContactsSearch] = useState("")
    const [contactsPage, setContactsPage] = useState(1)
    const filteredContacts = useMemo(() => {
        let res = contacts
        if (contactsSearch) {
            const q = contactsSearch.toLowerCase()
            res = res.filter(c => c.full_name?.toLowerCase().includes(q) || c.job_title?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q))
        }
        return res
    }, [contacts, contactsSearch])
    const paginatedContacts = useMemo(() => filteredContacts.slice((contactsPage - 1) * ITEMS_PER_PAGE, contactsPage * ITEMS_PER_PAGE), [filteredContacts, contactsPage])
    const contactsTotalPages = Math.ceil(filteredContacts.length / ITEMS_PER_PAGE)

    // Reset pagination on search
    useEffect(() => { setLeadsPage(1) }, [leadsSearch])
    useEffect(() => { setContactsPage(1) }, [contactsSearch])

    // ─── Editable Details Setup ────────────────────────────
    const [isEditingName, setIsEditingName] = useState(false)
    const [nameEdit, setNameEdit] = useState(company.name)
    const [savingName, setSavingName] = useState(false)
    const [editModalOpen, setEditModalOpen] = useState(false)

    const handleSaveName = async () => {
        if (!nameEdit.trim() || nameEdit === company.name) {
            setIsEditingName(false)
            setNameEdit(company.name)
            return
        }
        setSavingName(true)
        const { error } = await supabase.from('client_companies').update({ name: nameEdit.trim() }).eq('id', company.id)
        if (error) {
            toast.error("Failed to update company name")
        } else {
            toast.success("Name updated")
            router.refresh()
        }
        setSavingName(false)
        setIsEditingName(false)
    }

    const handleSaveOwner = async (newOwnerId: string) => {
        const val = newOwnerId === "unassigned" ? null : newOwnerId
        if (val === company.owner_id) return
        
        const { error } = await supabase.from('client_companies').update({ owner_id: val }).eq('id', company.id)
        if (error) {
            toast.error("Failed to update record owner")
        } else {
            toast.success("Record owner updated")
            router.refresh()
        }
    }

    // ═══════════════════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════════════════
    return (
        <div className="flex flex-col h-full overflow-hidden bg-[#f8fafc]">

            {/* ═══ TOP HEADER ══════════════════════════════════════ */}
            <header className="flex-none bg-white border-b border-slate-200">
                <div className="px-8 py-5 flex items-start justify-between">
                    <div className="flex items-start gap-3 w-full max-w-3xl">
                        <button
                            onClick={() => router.push('/companies')}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors mt-0.5"
                            title="Back to companies"
                        >
                            <ArrowLeft className="h-[18px] w-[18px]" />
                        </button>
                        <div className="flex-1 w-full relative group">
                            {isEditingName ? (
                                <div className="flex items-center gap-2 max-w-lg mb-1 relative">
                                    <input 
                                        type="text" 
                                        autoFocus
                                        value={nameEdit}
                                        onChange={(e) => setNameEdit(e.target.value)}
                                        onKeyDown={(e) => { 
                                            if (e.key === "Enter") handleSaveName()
                                            if (e.key === "Escape") { setIsEditingName(false); setNameEdit(company.name) } 
                                        }}
                                        className="text-xl font-semibold text-slate-900 border border-blue-400 rounded-md px-2 py-0.5 outline-none focus:ring-2 focus:ring-blue-100 w-full"
                                        disabled={savingName}
                                    />
                                    {savingName && <Loader2 className="w-4 h-4 text-blue-500 animate-spin absolute right-2" />}
                                </div>
                            ) : (
                                <div className="flex items-center gap-3">
                                    <h1 
                                        className="text-xl font-semibold text-slate-900 hover:bg-slate-50 px-1 -ml-1 rounded cursor-pointer border border-transparent hover:border-slate-200 transition-colors inline-block"
                                        style={{ height: '32px', lineHeight: '30px' }}
                                        onClick={() => setIsEditingName(true)}
                                        title="Click to edit"
                                    >
                                        {company.name}
                                    </h1>
                                    <button 
                                        onClick={() => setIsEditingName(true)}
                                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-600 transition-opacity"
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            )}

                            {/* RECORD OWNER - EDITABLE DROPDOWN */}
                            <div className="flex flex-wrap items-center gap-4 mt-1.5 text-[13px] text-slate-500">
                                <Select value={company.owner_id || "unassigned"} onValueChange={handleSaveOwner}>
                                    <SelectTrigger className="h-6 gap-1.5 font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-0.5 rounded-full border border-slate-200 text-[13px] shadow-none focus:ring-0 w-auto hover:text-blue-600 transition-colors">
                                        <Users className="w-3.5 h-3.5" /> 
                                        {company.owner?.full_name ? `Owner: ${company.owner.full_name}` : <span className="italic text-slate-500">Unassigned</span>}
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="unassigned" className="italic text-slate-400">Unassigned</SelectItem>
                                        {allUsers.map((u, i) => (
                                            <SelectItem key={u.id || i} value={u.id}>{u.full_name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                {/* Removed Industry Tag */}
                                
                                {company.area && (
                                    <span className="flex items-center gap-1.5">
                                        <MapPin className="w-3.5 h-3.5" /> {company.area}
                                    </span>
                                )}
                                {company.phone && (
                                    <span className="flex items-center gap-1.5">
                                        <Phone className="w-3.5 h-3.5" /> {company.phone}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 ml-4 shrink-0 mt-0.5">
                        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden shadow-sm bg-white">
                            <Link
                                href={prevCompanyId ? `/companies/${prevCompanyId}` : '#'}
                                prefetch={false}
                                className={`w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors border-r border-slate-200 ${!prevCompanyId ? 'opacity-30 pointer-events-none bg-slate-50/50' : ''}`}
                                title="Previous Company"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </Link>
                            <Link
                                href={nextCompanyId ? `/companies/${nextCompanyId}` : '#'}
                                prefetch={false}
                                className={`w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors ${!nextCompanyId ? 'opacity-30 pointer-events-none bg-slate-50/50' : ''}`}
                                title="Next Company"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </Link>
                        </div>
                        <Button variant="outline" className="gap-2 text-[13px] h-9"
                            onClick={() => setEditModalOpen(true)}
                        >
                            <Pencil className="w-3.5 h-3.5" /> Edit Details
                        </Button>
                    </div>
                </div>
            </header>

            {/* ═══ STATS BAR ══════════════════════════════════════ */}
            <div className="flex-none bg-white border-b border-slate-200 px-8 py-3">
                <div className="flex items-center gap-8">
                    <StatBadge icon={Target} label="Active Leads" value={activeLeads.length.toString()} color="blue" />
                    <StatBadge icon={TrendingUp} label="Total Value" value={fmtCurrency(totalValue)} color="slate" />
                    <StatBadge icon={CheckCircle2} label="Won Deals" value={wonLeads.length.toString()} color="emerald" />
                    <StatBadge icon={Users} label="Contacts" value={contactCount.toString()} color="violet" />
                </div>
            </div>

            {/* ═══ MAIN CONTENT ════════════════════════════════════ */}
            <div className="flex-1 flex gap-6 px-8 py-6 overflow-hidden min-h-0">

                {/* ─── LEFT PANEL ─────────────────────────────────── */}
                <div className="w-[340px] shrink-0 h-full overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-5">

                    {/* Company Information Card */}
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden shrink-0">
                        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="font-semibold text-[14px] text-slate-900 flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-slate-400" /> Company Information
                            </h3>
                        </div>
                        <div className="px-5 py-4 space-y-3">
                            <InfoRow icon={Briefcase} label="Sector" value={company.industry} />
                            <InfoRow icon={Building2} label="Line Industry" value={company.line_industry} />
                            <InfoRow icon={Phone} label="Phone" value={company.phone} />
                            <InfoRow icon={Globe} label="Website" value={company.website || "—"} isLink={!!company.website} />
                            <InfoRow icon={MapPin} label="Area" value={company.area} />
                            <InfoRow icon={MapPin} label="Address" value={[company.street_address, company.city, company.postal_code, company.country].filter(Boolean).join(", ") || company.address} />
                            {company.parent?.name && (
                                <InfoRow icon={Building2} label="Parent Company" value={company.parent.name} />
                            )}
                        </div>
                    </div>

                    {/* Meta Footer */}
                    <div className="text-[11px] text-slate-400 px-1 pb-2 shrink-0 flex flex-col gap-0.5 mt-auto">
                        <p suppressHydrationWarning>Created: {company.created_at ? fmtDateTime(company.created_at) : "—"}</p>
                        <p suppressHydrationWarning>Last Modified: <span className="font-medium text-slate-500">{fmtDateTime(lastModified || company.created_at)}</span></p>
                        <p suppressHydrationWarning>By: <span className="font-medium text-slate-500">{lastModifiedBy || "System"}</span></p>
                    </div>
                </div>

                {/* ─── RIGHT PANEL (Tabs) ─────────────────────────── */}
                <div className="flex-1 min-w-0 h-full flex flex-col overflow-y-auto custom-scrollbar relative">
                    <Tabs defaultValue="notes" className="flex flex-col h-fit pb-12 pr-2">
                        {/* Tab Bar */}
                        <TabsList className="w-full justify-start rounded-none! bg-white! gap-0! p-0! h-auto! shrink-0 shadow-none! sticky top-0 z-30 border-b border-slate-200">
                            <TabBtn value="notes" icon={FileText} label="Notes" />
                            <TabBtn value="timeline" icon={Clock} label="Timeline" />
                            <TabBtn value="leads" icon={Target} label={`Leads (${leads.length})`} />
                            <TabBtn value="contacts" icon={Users} label={`Contacts (${contactCount})`} />
                            <TabBtn value="files" icon={Folder} label="Files" />
                        </TabsList>

                        {/* ── NOTES TAB ── */}
                        <TabsContent value="notes" className="m-0 pt-6">
                            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                                <div className="px-5 py-3.5 border-b border-slate-100">
                                    <h3 className="font-semibold text-[13px] text-slate-800 tracking-tight flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-slate-400" /> Company Notes
                                    </h3>
                                </div>
                                {/* Note Input */}
                                <div className="p-4 border-b border-slate-100">
                                    <textarea
                                        value={noteText}
                                        onChange={e => setNoteText(e.target.value)}
                                        placeholder="Add a note — meeting summary, call log, follow-up action..."
                                        className="w-full min-h-[80px] text-[13px] text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 placeholder:text-slate-400"
                                        onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSaveNote() }}
                                    />
                                    <div className="flex items-center justify-between mt-2">
                                        <span className="text-[11px] text-slate-400">Ctrl+Enter to save</span>
                                        <Button size="sm" disabled={!noteText.trim() || savingNote} onClick={handleSaveNote}
                                            className="h-8 text-[12px] gap-1.5 bg-slate-900 hover:bg-slate-800"
                                        >
                                            {savingNote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                                            Save Note
                                        </Button>
                                    </div>
                                </div>
                                {/* Notes List */}
                                {notesLoading ? (
                                    <div className="flex items-center justify-center py-10">
                                        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                                    </div>
                                ) : notes.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                                            <FileText className="h-5 w-5 text-slate-300" />
                                        </div>
                                        <p className="text-[13px] text-slate-500 font-medium">No notes yet</p>
                                        <p className="text-[12px] text-slate-400">Add your first note above.</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-100">
                                        {notes.map(note => (
                                            <div key={note.id} className="px-5 py-4 group hover:bg-slate-50/50 transition-colors">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[9px] font-bold text-blue-700">
                                                            {note.author_name ? initials(note.author_name) : "?"}
                                                        </div>
                                                        <span className="text-[12px] font-medium text-slate-700">{note.author_name ?? "Unknown"}</span>
                                                        <span className="text-[11px] text-slate-400">• {fmtDateTime(note.created_at)}</span>
                                                    </div>
                                                    <button
                                                        onClick={() => handleDeleteNote(note.id)}
                                                        className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                                        title="Delete note"
                                                    >
                                                        <XCircle className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <p className="text-[13px] text-slate-700 whitespace-pre-wrap leading-relaxed pl-8">
                                                    {note.content}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        {/* ── TIMELINE TAB ── */}
                        <TabsContent value="timeline" className="m-0 pt-6">
                            <TimelineTab companyId={company.id} />
                        </TabsContent>

                        {/* ── LEADS TAB ── */}
                        <TabsContent value="leads" className="m-0 pt-6">
                            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                                    <h3 className="font-semibold text-[13px] text-slate-800 tracking-tight flex items-center gap-2">
                                        <Target className="w-4 h-4 text-slate-400" /> Associated Leads
                                    </h3>
                                    <div className="flex items-center gap-3">
                                        {leads.length > 0 && (
                                            <div className="relative">
                                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                                <input 
                                                    type="text" 
                                                    placeholder="Search leads..." 
                                                    value={leadsSearch}
                                                    onChange={e => setLeadsSearch(e.target.value)}
                                                    className="pl-8 pr-3 py-1.5 text-[12px] bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 w-[180px] transition-all"
                                                />
                                            </div>
                                        )}
                                        <span className="text-[12px] text-slate-400">{filteredLeads.length} total</span>
                                    </div>
                                </div>
                                {leads.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-14 text-center">
                                        <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                                            <Target className="h-5 w-5 text-slate-300" />
                                        </div>
                                        <p className="text-[13px] text-slate-500 font-medium">No leads linked</p>
                                        <p className="text-[12px] text-slate-400">Create a lead and associate it with this company.</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse" style={{ tableLayout: 'fixed' }}>
                                            <colgroup>
                                                <col style={{ width: '40%' }} />
                                                <col style={{ width: '18%' }} />
                                                <col style={{ width: '22%' }} />
                                                <col style={{ width: '20%' }} />
                                            </colgroup>
                                            <thead>
                                                <tr className="border-b border-slate-200 bg-slate-50/50">
                                                    <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Project Name</th>
                                                    <th className="px-3 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">PIC & Date</th>
                                                    <th className="px-3 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Stage</th>
                                                    <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">Estimated Value</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {paginatedLeads.length === 0 && leads.length > 0 && (
                                                    <tr>
                                                        <td colSpan={4} className="px-5 py-8 text-center text-[12px] text-slate-400">
                                                            No leads match your search.
                                                        </td>
                                                    </tr>
                                                )}
                                                {paginatedLeads.map(lead => (
                                                    <tr key={lead.id} onClick={() => router.push(`/leads/${lead.id}`)} className="group hover:bg-slate-50 transition-colors cursor-pointer">
                                                        <td className="px-5 py-3 align-middle">
                                                            <p className="text-[13px] font-medium text-slate-900 group-hover:text-blue-600 transition-colors truncate" title={lead.project_name || "Untitled Lead"}>
                                                                {lead.project_name || "Untitled Lead"}
                                                            </p>
                                                        </td>
                                                        <td className="px-3 py-3 align-middle">
                                                            <div className="flex flex-col gap-0.5 min-w-0">
                                                                <span className="text-[12px] text-slate-700 truncate">{lead.pic_sales_profile?.full_name || "—"}</span>
                                                                {lead.target_close_date && <span className="text-[11px] text-slate-400 truncate">Close: {fmtDate(lead.target_close_date)}</span>}
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-3 align-middle">
                                                            {lead.pipeline_stage && (
                                                                <span className={`inline-flex text-[11px] font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap truncate max-w-full ${
                                                                    lead.pipeline_stage.name.toLowerCase().includes("won")
                                                                        ? "bg-emerald-100 text-emerald-700"
                                                                        : lead.pipeline_stage.name.toLowerCase().includes("lost") || lead.pipeline_stage.name.toLowerCase().includes("cancel")
                                                                            ? "bg-red-100 text-red-600"
                                                                            : "bg-blue-50 text-blue-600"
                                                                }`}>
                                                                    {lead.pipeline_stage.name}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-5 py-3 align-middle text-right">
                                                            <span className="text-[13px] font-semibold text-slate-700 whitespace-nowrap">
                                                                {fmtCurrency(lead.estimated_value)}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        </div>
                                        {leadsTotalPages > 1 && (
                                            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between bg-white text-[12px]">
                                                <span className="text-slate-500">
                                                    Showing <span className="font-medium text-slate-700">{((leadsPage - 1) * ITEMS_PER_PAGE) + 1}</span> to <span className="font-medium text-slate-700">{Math.min(leadsPage * ITEMS_PER_PAGE, filteredLeads.length)}</span> of <span className="font-medium text-slate-700">{filteredLeads.length}</span>
                                                </span>
                                                <div className="flex items-center gap-1.5">
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        className="h-7 w-7 p-0 rounded shadow-sm hover:bg-slate-50" 
                                                        disabled={leadsPage === 1}
                                                        onClick={() => setLeadsPage(p => Math.max(1, p - 1))}
                                                    >
                                                        <ChevronLeft className="w-3.5 h-3.5" />
                                                    </Button>
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        className="h-7 w-7 p-0 rounded shadow-sm hover:bg-slate-50" 
                                                        disabled={leadsPage === leadsTotalPages}
                                                        onClick={() => setLeadsPage(p => Math.min(leadsTotalPages, p + 1))}
                                                    >
                                                        <ChevronRight className="w-3.5 h-3.5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </TabsContent>

                        {/* ── CONTACTS TAB ── */}
                        <TabsContent value="contacts" className="m-0 pt-6">
                            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                                    <h3 className="font-semibold text-[13px] text-slate-800 tracking-tight flex items-center gap-2">
                                        <Users className="w-4 h-4 text-slate-400" /> Contacts
                                    </h3>
                                    <div className="flex items-center gap-3">
                                        {contacts.length > 0 && (
                                            <div className="relative">
                                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                                <input 
                                                    type="text" 
                                                    placeholder="Search contacts..." 
                                                    value={contactsSearch}
                                                    onChange={e => setContactsSearch(e.target.value)}
                                                    className="pl-8 pr-3 py-1.5 text-[12px] bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 w-[180px] transition-all"
                                                />
                                            </div>
                                        )}
                                        <span className="text-[12px] text-slate-400">{filteredContacts.length} total</span>
                                    </div>
                                </div>
                                {contactsLoading ? (
                                    <div className="flex items-center justify-center py-10">
                                        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                                    </div>
                                ) : contacts.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-14 text-center">
                                        <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                                            <Users className="h-5 w-5 text-slate-300" />
                                        </div>
                                        <p className="text-[13px] text-slate-500 font-medium">No contacts linked</p>
                                        <p className="text-[12px] text-slate-400">Add contacts associated with this company.</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse" style={{ tableLayout: 'fixed' }}>
                                            <colgroup>
                                                <col style={{ width: '48px' }} />
                                                <col style={{ width: '28%' }} />
                                                <col style={{ width: '22%' }} />
                                                <col style={{ width: '28%' }} />
                                                <col style={{ width: '18%' }} />
                                            </colgroup>
                                            <thead>
                                                <tr className="border-b border-slate-200 bg-slate-50/50">
                                                    <th className="px-3 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-[48px]"></th>
                                                    <th className="px-1 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Contact Name</th>
                                                    <th className="px-3 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Job Title</th>
                                                    <th className="px-3 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                                                    <th className="px-3 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Phone</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {paginatedContacts.length === 0 && contacts.length > 0 && (
                                                    <tr>
                                                        <td colSpan={5} className="px-5 py-8 text-center text-[12px] text-slate-400">
                                                            No contacts match your search.
                                                        </td>
                                                    </tr>
                                                )}
                                                {paginatedContacts.map(contact => (
                                                    <tr key={contact.id} onClick={() => router.push(`/contacts/${contact.id}`)} className="group hover:bg-slate-50 transition-colors cursor-pointer">
                                                        <td className="px-3 py-3 align-middle w-[48px]">
                                                            <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-[10px] font-bold text-violet-700">
                                                                {initials(contact.full_name)}
                                                            </div>
                                                        </td>
                                                        <td className="px-1 py-3 align-middle">
                                                            <p className="text-[13px] font-medium text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                                                                {contact.salutation ? `${contact.salutation} ` : ""}{contact.full_name}
                                                            </p>
                                                        </td>
                                                        <td className="px-3 py-3 align-middle">
                                                            <span className="text-[13px] text-slate-600 truncate block">{contact.job_title || "—"}</span>
                                                        </td>
                                                        <td className="px-3 py-3 align-middle">
                                                            {contact.email ? (
                                                                <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 text-[12px] text-blue-600 hover:underline w-fit max-w-full truncate" onClick={e => e.stopPropagation()} title={contact.email}>
                                                                    <Mail className="w-3 h-3 shrink-0" /> <span className="truncate">{contact.email}</span>
                                                                </a>
                                                            ) : (
                                                                <span className="text-slate-400 text-[12px] italic">—</span>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-3 align-middle">
                                                            {contact.phone ? (
                                                                <span className="flex items-center gap-1.5 text-[12px] text-slate-600 truncate">
                                                                    <Phone className="w-3 h-3 shrink-0 text-slate-400" /> <span className="truncate">{contact.phone}</span>
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-400 text-[12px] italic">—</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        </div>
                                        {contactsTotalPages > 1 && (
                                            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between bg-white text-[12px]">
                                                <span className="text-slate-500">
                                                    Showing <span className="font-medium text-slate-700">{((contactsPage - 1) * ITEMS_PER_PAGE) + 1}</span> to <span className="font-medium text-slate-700">{Math.min(contactsPage * ITEMS_PER_PAGE, filteredContacts.length)}</span> of <span className="font-medium text-slate-700">{filteredContacts.length}</span>
                                                </span>
                                                <div className="flex items-center gap-1.5">
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        className="h-7 w-7 p-0 rounded shadow-sm hover:bg-slate-50" 
                                                        disabled={contactsPage === 1}
                                                        onClick={() => setContactsPage(p => Math.max(1, p - 1))}
                                                    >
                                                        <ChevronLeft className="w-3.5 h-3.5" />
                                                    </Button>
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        className="h-7 w-7 p-0 rounded shadow-sm hover:bg-slate-50" 
                                                        disabled={contactsPage === contactsTotalPages}
                                                        onClick={() => setContactsPage(p => Math.min(contactsTotalPages, p + 1))}
                                                    >
                                                        <ChevronRight className="w-3.5 h-3.5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </TabsContent>

                        {/* ── FILES TAB ── */}
                        <TabsContent value="files" className="m-0 pt-6">
                            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                                <div className="px-5 py-3.5 border-b border-slate-100">
                                    <h3 className="font-semibold text-[13px] text-slate-800 tracking-tight flex items-center gap-2">
                                        <Folder className="w-4 h-4 text-slate-400" /> Files & Documents
                                    </h3>
                                </div>
                                <div className="flex flex-col items-center justify-center py-14 text-center">
                                    <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                                        <Upload className="h-5 w-5 text-slate-300" />
                                    </div>
                                    <p className="text-[13px] text-slate-500 font-medium mb-0.5">No files attached</p>
                                    <p className="text-[12px] text-slate-400 max-w-xs">
                                        Upload contracts, proposals and supporting documents for this company.
                                    </p>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            {/* ═══ OVERLAYS ════════════════════════════════════ */}
            <AddCompanyModal
                open={editModalOpen}
                onOpenChange={setEditModalOpen}
                initialData={company}
            />
        </div>
    )
}


// ═══════════════════════════════════════════════════════════════
//  SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

/** Stat badge for the summary bar */
function StatBadge({ icon: Icon, label, value, color }: {
    icon: typeof Target; label: string; value: string; color: string
}) {
    const colorMap: Record<string, string> = {
        blue: "bg-blue-50 text-blue-700",
        slate: "bg-slate-100 text-slate-700",
        emerald: "bg-emerald-50 text-emerald-700",
        violet: "bg-violet-50 text-violet-700",
    }
    return (
        <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorMap[color] || colorMap.slate}`}>
                <Icon className="w-4 h-4" />
            </div>
            <div>
                <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">{label}</p>
                <p className="text-[14px] font-semibold text-slate-900">{value}</p>
            </div>
        </div>
    )
}

/** Tab button — fully custom underline, solid bg, zero leak */
function TabBtn({ value, icon: Icon, label }: { value: string; icon: typeof Clock; label: string }) {
    return (
        <TabsTrigger
            value={value}
            className={
                "flex-none! rounded-none! border-none! h-auto! px-4 pb-2.5 pt-2.5 text-[13px]" +
                " text-slate-400 hover:text-slate-600 data-[state=active]:text-blue-600" +
                " shadow-none! ring-0! outline-none!" +
                " bg-white! data-[state=active]:bg-white!" +
                " focus:ring-0! focus-visible:ring-0! focus-visible:ring-offset-0! focus-visible:outline-none!" +
                " after:bg-blue-600! after:h-[2.5px]! after:bottom-0! after:rounded-full!" +
                " data-[state=active]:after:opacity-100!"
            }
        >
            <Icon className="h-3.5 w-3.5 mr-1.5 shrink-0" />
            {label}
        </TabsTrigger>
    )
}

/** Key-Value row for info cards */
function InfoRow({ icon: Icon, label, value, isLink }: {
    icon: typeof Building2; label: string; value?: string | null; isLink?: boolean
}) {
    if (!value) return null
    return (
        <div className="flex items-start gap-3 py-1.5">
            <Icon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
                <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">{label}</p>
                {isLink && value !== "—" ? (
                    <a
                        href={value.startsWith("http") ? value : `https://${value}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[13px] text-blue-600 hover:underline break-all"
                    >{value}</a>
                ) : (
                    <p className="text-[13px] text-slate-800">{value}</p>
                )}
            </div>
        </div>
    )
}
