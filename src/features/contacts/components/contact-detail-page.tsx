"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import {
    ArrowLeft, Pencil, Building2, Phone, Globe, MapPin,
    Briefcase, FileText, Clock, Folder, Users, Mail,
    Target, TrendingUp, CheckCircle2, XCircle, Loader2, Linkedin,
    CalendarDays, Link2, Upload, Search, ChevronLeft, ChevronRight, ArrowUpRight
} from "lucide-react"

import { ContactTimelineTab } from "./contact-timeline-tab"
import { AddContactModal } from "./add-contact-modal"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"

// ═══════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════

interface ContactLead {
    id: number
    project_name: string | null
    estimated_value: number | null
    status: string | null
    target_close_date: string | null
    pipeline_stage: { name: string; color: string } | null
    pic_sales_profile: { full_name: string } | null
}

interface SocialUrl {
    platform: string
    url: string
}

interface ContactData {
    id: string
    salutation: string | null
    full_name: string
    email: string | null
    phone: string | null
    job_title: string | null
    secondary_email: string | null
    secondary_phone: string | null
    secondary_emails: string[] | null
    secondary_phones: string[] | null
    linkedin_url: string | null
    notes: string | null
    date_of_birth: string | null
    address: string | null
    social_urls: SocialUrl[] | null
    client_company?: { id: string; name: string } | null
    owner?: { id: string; full_name: string; email: string } | null
}

interface ContactDetailPageProps {
    contact: ContactData
    leads: ContactLead[]
    lastModified?: string
    lastModifiedBy?: string
    nextContactId?: string
    prevContactId?: string
}

interface ContactNote {
    id: string
    content: string
    author_name: string | null
    created_at: string
    user_id: string | null
}

// ═══════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export function ContactDetailPage({ contact, leads, lastModified, lastModifiedBy, nextContactId, prevContactId }: ContactDetailPageProps) {
    const router = useRouter()
    const supabase = createClient()

    // ─── Editable Details Setup ────────────────────────────
    const [isEditingName, setIsEditingName] = useState(false)
    const [nameEdit, setNameEdit] = useState(contact.full_name)
    const [savingName, setSavingName] = useState(false)
    const [editModalOpen, setEditModalOpen] = useState(false)
    const [allUsers, setAllUsers] = useState<{id: string, full_name: string}[]>([])
    const [allCompanies, setAllCompanies] = useState<{id: string, name: string}[]>([])

    const fetchUsers = useCallback(async () => {
        const { data } = await supabase.from('profiles').select('id, full_name').eq('is_active', true).order('full_name')
        if (data) setAllUsers(data)
    }, [supabase])

    const fetchCompanies = useCallback(async () => {
        const { data } = await supabase.from('client_companies').select('id, name').order('name')
        if (data) setAllCompanies(data)
    }, [supabase])

    useEffect(() => { fetchUsers(); fetchCompanies(); }, [fetchUsers, fetchCompanies])

    const handleSaveName = async () => {
        if (!nameEdit.trim() || nameEdit === contact.full_name) {
            setIsEditingName(false)
            setNameEdit(contact.full_name)
            return
        }
        setSavingName(true)
        const { error } = await supabase.from('contacts').update({ full_name: nameEdit.trim() }).eq('id', contact.id)
        if (error) { toast.error("Failed to update contact name") }
        else { toast.success("Name updated"); router.refresh() }
        setSavingName(false)
        setIsEditingName(false)
    }

    const handleSaveOwner = async (newOwnerId: string) => {
        const val = newOwnerId === "unassigned" ? null : newOwnerId
        if (val === contact.owner?.id) return
        
        const { error } = await supabase.from('contacts').update({ owner_id: val }).eq('id', contact.id)
        if (error) { toast.error("Failed to update record owner") }
        else { toast.success("Record owner updated"); router.refresh() }
    }

    const handleSaveCompany = async (newCompanyId: string) => {
        const val = newCompanyId === "unassigned" ? null : newCompanyId
        if (val === contact.client_company?.id) return
        
        const { error } = await supabase.from('contacts').update({ client_company_id: val }).eq('id', contact.id)
        if (error) { toast.error("Failed to update company") }
        else { toast.success("Company updated"); router.refresh() }
    }

    // ─── Leads Pagination & Search ───────────────────────
    const ITEMS_PER_PAGE = 5
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
    const paginatedLeads = useMemo(() => {
        return filteredLeads.slice((leadsPage - 1) * ITEMS_PER_PAGE, leadsPage * ITEMS_PER_PAGE)
    }, [filteredLeads, leadsPage])
    const leadsTotalPages = Math.ceil(filteredLeads.length / ITEMS_PER_PAGE)
    useEffect(() => { setLeadsPage(1) }, [leadsSearch])


    // ─── Notes State ─────────────────────────────────────
    const [notes, setNotes] = useState<ContactNote[]>([])
    const [notesLoading, setNotesLoading] = useState(false)
    const [noteText, setNoteText] = useState("")
    const [savingNote, setSavingNote] = useState(false)

    // ─── Computed Stats ──────────────────────────────────
    const activeLeads = leads.filter(l => {
        const stage = l.pipeline_stage?.name?.toLowerCase() ?? ""
        return !stage.includes("won") && !stage.includes("lost") && !stage.includes("cancel")
    })
    const wonLeads = leads.filter(l => l.pipeline_stage?.name?.toLowerCase().includes("won"))
    const totalValue = leads.reduce((sum, l) => sum + (l.estimated_value || 0), 0)
    const nameDisplay = contact.salutation ? `${contact.salutation} ${contact.full_name}` : contact.full_name

    // ─── Social Formatting ───────────────────────────────
    const allSocialUrls: SocialUrl[] = []
    if (contact.linkedin_url) {
        allSocialUrls.push({ platform: "LinkedIn", url: contact.linkedin_url })
    }
    if (contact.social_urls && Array.isArray(contact.social_urls)) {
        contact.social_urls.forEach(s => {
            if (s.url && s.url !== contact.linkedin_url) allSocialUrls.push(s)
        })
    }

    // ─── Fetch Notes ─────────────────────────────────────
    const fetchNotes = useCallback(async () => {
        setNotesLoading(true)
        const { data } = await supabase
            .from("contact_notes")
            .select("*")
            .eq("contact_id", contact.id)
            .order("created_at", { ascending: false })
        setNotes(data ?? [])
        setNotesLoading(false)
    }, [contact.id])

    useEffect(() => { fetchNotes() }, [fetchNotes])

    // ─── Save Note ───────────────────────────────────────
    const handleSaveNote = async () => {
        if (!noteText.trim()) return
        setSavingNote(true)
        const { data: { user } } = await supabase.auth.getUser()
        const { data: profile } = await supabase
            .from("profiles").select("full_name").eq("id", user?.id ?? "").single()

        const { error } = await supabase.from("contact_notes").insert({
            contact_id: contact.id,
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
        const { error } = await supabase.from("contact_notes").delete().eq("id", noteId)
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

    // ═══════════════════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════════════════
    return (
        <div className="flex flex-col h-full overflow-hidden bg-[#f8fafc]">

            {/* ═══ TOP HEADER ══════════════════════════════════════ */}
            <header className="flex-none bg-white border-b border-slate-200">
                <div className="px-8 py-5 flex items-start justify-between">
                    <div className="flex items-start gap-3">
                        <button
                            onClick={() => router.push('/contacts')}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors mt-0.5"
                            title="Back to contacts"
                        >
                            <ArrowLeft className="h-[18px] w-[18px]" />
                        </button>
                        <div className="flex-1 w-full relative group">
                            {isEditingName ? (
                                <div className="flex items-center gap-2 max-w-lg mb-1 relative">
                                    {contact.salutation && <span className="text-xl font-semibold text-slate-500 mr-1">{contact.salutation}</span>}
                                    <input 
                                        type="text" 
                                        autoFocus
                                        value={nameEdit}
                                        onChange={(e) => setNameEdit(e.target.value)}
                                        onKeyDown={(e) => { 
                                            if (e.key === "Enter") handleSaveName()
                                            if (e.key === "Escape") { setIsEditingName(false); setNameEdit(contact.full_name) } 
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
                                        {nameDisplay}
                                    </h1>
                                    <button 
                                        onClick={() => setIsEditingName(true)}
                                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-600 transition-opacity"
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            )}
                            
                            <div className="flex flex-wrap items-center gap-4 mt-1.5 text-[13px] text-slate-500">
                                <Select value={(contact as any).owner_id || "unassigned"} onValueChange={handleSaveOwner}>
                                    <SelectTrigger className="h-6 gap-1.5 font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-0.5 rounded-full border border-slate-200 text-[13px] shadow-none focus:ring-0 w-auto hover:text-blue-600 transition-colors">
                                        <Users className="w-3.5 h-3.5" /> 
                                        {contact.owner?.full_name ? `Owner: ${contact.owner.full_name}` : <span className="italic text-slate-500">Unassigned</span>}
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="unassigned" className="italic text-slate-400">Unassigned</SelectItem>
                                        {allUsers.map((u, i) => (
                                            <SelectItem key={u.id || i} value={u.id}>{u.full_name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>


                                <Select value={(contact as any).client_company?.id || "unassigned"} onValueChange={handleSaveCompany}>
                                    <SelectTrigger className="h-6 gap-1.5 font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-0.5 rounded-full border border-slate-200 text-[13px] shadow-none focus:ring-0 w-auto hover:text-blue-600 transition-colors">
                                        <Building2 className="w-3.5 h-3.5" /> 
                                        {contact.client_company?.name ? contact.client_company.name : <span className="italic text-slate-500">Unassigned Company</span>}
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="unassigned" className="italic text-slate-400">Unassigned Company</SelectItem>
                                        {allCompanies.map((c, i) => (
                                            <SelectItem key={c.id || i} value={c.id}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {contact.client_company?.id && (
                                    <Link href={`/companies/${contact.client_company.id}`} className="text-slate-400 hover:text-blue-600 transition-colors" title="View Company">
                                        <ArrowUpRight className="w-4 h-4" />
                                    </Link>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 mt-0.5">
                        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden shadow-sm bg-white">
                            <Link
                                href={prevContactId ? `/contacts/${prevContactId}` : '#'}
                                prefetch={false}
                                className={`w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors border-r border-slate-200 ${!prevContactId ? 'opacity-30 pointer-events-none bg-slate-50/50' : ''}`}
                                title="Previous Contact"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </Link>
                            <Link
                                href={nextContactId ? `/contacts/${nextContactId}` : '#'}
                                prefetch={false}
                                className={`w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors ${!nextContactId ? 'opacity-30 pointer-events-none bg-slate-50/50' : ''}`}
                                title="Next Contact"
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
                </div>
            </div>

            {/* ═══ MAIN CONTENT ════════════════════════════════════ */}
            <div className="flex-1 flex gap-6 px-8 py-6 overflow-hidden min-h-0">

                {/* ─── LEFT PANEL ─────────────────────────────────── */}
                <div className="w-[340px] shrink-0 h-full overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-5">

                    {/* Contact Detail Card */}
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden shrink-0">
                        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="font-semibold text-[14px] text-slate-900 flex items-center gap-2">
                                <Users className="w-4 h-4 text-slate-400" /> Contact Information
                            </h3>
                        </div>
                        <div className="px-5 py-4 space-y-3">
                            <InfoRow icon={Briefcase} label="Job Title" value={contact.job_title} />

                            <InfoRow icon={Mail} label="Email" value={contact.email} isEmail />
                            <InfoRow icon={Mail} label="Secondary Email(s)" value={[contact.secondary_email, ...(contact.secondary_emails || [])].filter(Boolean).join("\n")} isEmail />
                            
                            <InfoRow icon={Phone} label="Phone" value={contact.phone} isPhone />
                            <InfoRow icon={Phone} label="Secondary Phone(s)" value={[contact.secondary_phone, ...(contact.secondary_phones || [])].filter(Boolean).join("\n")} isPhone />
                            
                            <InfoRow icon={CalendarDays} label="Date of Birth" value={fmtDate(contact.date_of_birth)} />
                            <InfoRow icon={MapPin} label="Address" value={contact.address} />
                            
                            {allSocialUrls.length > 0 && (
                                <div className="flex items-start gap-3 py-1.5">
                                    <Link2 className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider mb-1">Social Links</p>
                                        <div className="space-y-1">
                                            {allSocialUrls.map((s, idx) => (
                                                <a key={idx} href={s.url.startsWith("http") ? s.url : `https://${s.url}`} target="_blank" rel="noopener noreferrer" className="text-[13px] text-blue-600 hover:underline break-all block">
                                                    {s.platform}: {s.url}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {contact.notes && (
                                <div className="flex items-start gap-3 py-1.5">
                                    <FileText className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider mb-1">Legacy Notes</p>
                                        <p className="text-[13px] text-slate-800 whitespace-pre-wrap">{contact.notes}</p>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>

                    {/* Meta Footer */}
                    <div className="text-[11px] text-slate-400 px-1 pb-2 shrink-0 flex flex-col gap-0.5 mt-auto">
                        <p suppressHydrationWarning>Last Modified: <span className="font-medium text-slate-500">{fmtDateTime(lastModified || (contact as any).created_at)}</span></p>
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
                            <TabBtn value="files" icon={Folder} label="Files" />
                        </TabsList>

                        {/* ── TIMELINE TAB ── */}
                        <TabsContent value="timeline" className="m-0 pt-6">
                            <ContactTimelineTab contactId={contact.id} />
                        </TabsContent>

                        {/* ── NOTES TAB ── */}
                        <TabsContent value="notes" className="m-0 pt-6">
                            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                                <div className="px-5 py-3.5 border-b border-slate-100">
                                    <h3 className="font-semibold text-[13px] text-slate-800 tracking-tight flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-slate-400" /> Contact Notes
                                    </h3>
                                </div>
                                {/* Note Input */}
                                <div className="p-4 border-b border-slate-100">
                                    <textarea
                                        value={noteText}
                                        onChange={e => setNoteText(e.target.value)}
                                        placeholder="Add a note — meeting summary, call log, preferences..."
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

                        {/* ── LEADS TAB ── */}
                        <TabsContent value="leads" className="m-0 pt-6">
                            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
                                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <h3 className="font-semibold text-[13px] text-slate-800 tracking-tight flex items-center gap-2">
                                            <Target className="w-4 h-4 text-slate-400" /> Associated Leads
                                        </h3>
                                        <span className="text-[12px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{filteredLeads.length} total</span>
                                    </div>
                                    <div className="relative">
                                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="text"
                                            placeholder="Search leads..."
                                            value={leadsSearch}
                                            onChange={(e) => setLeadsSearch(e.target.value)}
                                            className="w-48 text-[12px] pl-8 pr-3 py-1.5 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium text-slate-700 bg-slate-50 placeholder:text-slate-400"
                                        />
                                    </div>
                                </div>
                                {paginatedLeads.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-14 text-center">
                                        <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                                            <Target className="h-5 w-5 text-slate-300" />
                                        </div>
                                        <p className="text-[13px] text-slate-500 font-medium">No leads found</p>
                                        <p className="text-[12px] text-slate-400">Try adjusting your search criteria.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse" style={{ tableLayout: 'fixed' }}>
                                            <colgroup>
                                                <col style={{ width: '35%' }} />
                                                <col style={{ width: '18%' }} />
                                                <col style={{ width: '22%' }} />
                                                <col style={{ width: '13%' }} />
                                                <col style={{ width: '12%' }} />
                                            </colgroup>
                                            <thead>
                                                <tr className="border-b border-slate-200 bg-slate-50/50">
                                                    <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Project Name</th>
                                                    <th className="px-3 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">Value</th>
                                                    <th className="px-3 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Stage</th>
                                                    <th className="px-3 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">PIC</th>
                                                    <th className="px-3 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Close</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {paginatedLeads.map(lead => (
                                                    <tr key={lead.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => router.push(`/leads/${lead.id}`)}>
                                                        <td className="px-5 py-3 align-middle">
                                                            <p className="text-[13px] font-semibold text-slate-900 group-hover:text-blue-600 transition-colors truncate" title={lead.project_name || "Untitled Lead"}>
                                                                {lead.project_name || "Untitled Lead"}
                                                            </p>
                                                        </td>
                                                        <td className="px-3 py-3 align-middle text-right">
                                                            <span className="text-[13px] font-medium text-slate-700 whitespace-nowrap">
                                                                {fmtCurrency(lead.estimated_value)}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-3 align-middle">
                                                            {lead.pipeline_stage ? (
                                                                <span className={`inline-flex text-[11px] font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap truncate max-w-full ${
                                                                    lead.pipeline_stage.name.toLowerCase().includes("won")
                                                                        ? "bg-emerald-100 text-emerald-700"
                                                                        : lead.pipeline_stage.name.toLowerCase().includes("lost") || lead.pipeline_stage.name.toLowerCase().includes("cancel") || lead.pipeline_stage.name.toLowerCase().includes("turndown") || lead.pipeline_stage.name.toLowerCase().includes("postponed")
                                                                            ? "bg-red-100 text-red-600"
                                                                            : "bg-blue-50 text-blue-600"
                                                                }`}>
                                                                    {lead.pipeline_stage.name}
                                                                </span>
                                                            ) : (
                                                                <span className="text-[12px] text-slate-400">—</span>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-3 align-middle">
                                                            <span className="text-[12px] text-slate-600 truncate block">{lead.pic_sales_profile?.full_name || "—"}</span>
                                                        </td>
                                                        <td className="px-3 py-3 align-middle">
                                                            <span className="text-[12px] text-slate-500 whitespace-nowrap">{fmtDate(lead.target_close_date)}</span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                {leadsTotalPages > 1 && (
                                    <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between bg-slate-50">
                                        <span className="text-[12px] text-slate-500 font-medium">
                                            Page {leadsPage} of {leadsTotalPages}
                                        </span>
                                        <div className="flex gap-2">
                                            <Button variant="outline" size="sm" className="h-7 px-2 text-[12px] bg-white text-slate-600" disabled={leadsPage === 1} onClick={() => setLeadsPage(p => Math.max(1, p - 1))}>
                                                <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Prev
                                            </Button>
                                            <Button variant="outline" size="sm" className="h-7 px-2 text-[12px] bg-white text-slate-600" disabled={leadsPage === leadsTotalPages} onClick={() => setLeadsPage(p => Math.min(leadsTotalPages, p + 1))}>
                                                Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
                                            </Button>
                                        </div>
                                    </div>
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
                                        Upload business cards or ID scans for this contact.
                                    </p>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            {/* ═══ OVERLAYS ════════════════════════════════════ */}
            <AddContactModal
                isOpen={editModalOpen}
                onOpenChange={setEditModalOpen}
                initialData={contact}
                onSuccess={() => router.refresh()}
            />
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════
//  SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

function StatBadge({ icon: Icon, label, value, color }: {
    icon: typeof Target; label: string; value: string; color: string
}) {
    const colorMap: Record<string, string> = {
        blue: "bg-blue-50 text-blue-700",
        slate: "bg-slate-100 text-slate-700",
        emerald: "bg-emerald-50 text-emerald-700",
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

function InfoRow({ icon: Icon, label, value, isEmail, isPhone }: {
    icon: typeof Building2; label: string; value?: string | null; isEmail?: boolean; isPhone?: boolean
}) {
    if (!value || value === "—") return null
    const lines = value.split("\n").filter(Boolean)
    if (lines.length === 0) return null

    return (
        <div className="flex items-start gap-3 py-1.5">
            <Icon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
                <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">{label}</p>
                <div className="space-y-0.5 mt-0.5">
                    {lines.map((line, idx) => {
                        if (isEmail) {
                            return <a key={idx} href={`mailto:${line}`} className="text-[13px] text-blue-600 hover:underline break-all block">{line}</a>
                        } else if (isPhone) {
                            return <a key={idx} href={`tel:${line}`} className="text-[13px] text-blue-600 hover:underline break-all block">{line}</a>
                        } else {
                            return <p key={idx} className="text-[13px] text-slate-800 break-words">{line}</p>
                        }
                    })}
                </div>
            </div>
        </div>
    )
}
