"use client"

import { Lead } from "@/types"
import {
    Building2, User, Mail, Phone, MapPin, DollarSign,
    ArrowRight, Briefcase, CalendarDays, Globe
} from "lucide-react"
import { WorkflowActions } from "@/features/tasks/components/workflow-actions"

interface LeadDetailLayoutProps {
    lead: Lead
}

export function LeadDetailLayout({ lead }: LeadDetailLayoutProps) {
    return (
        <div className="grid grid-cols-12 gap-6 p-6">
            <div className="col-span-12 lg:col-span-4 space-y-4">
                <IdentityCard lead={lead} />
                <ContactCard lead={lead} />
            </div>
            <div className="col-span-12 lg:col-span-4 space-y-4">
                <EventInfoCard lead={lead} />
                <FinancialCard lead={lead} />
            </div>
            <div className="col-span-12 lg:col-span-4 space-y-4">
                <ActionCenterCard lead={lead} />
                <ClassificationCard lead={lead} />
            </div>
        </div>
    )
}

function IdentityCard({ lead }: { lead: Lead }) {
    const statusColor = getStatusColor(lead.status)
    return (
        <div className="border rounded-xl bg-card overflow-hidden">
            <div className={`h-1.5 ${statusColor}`} />
            <div className="p-4 space-y-3">
                <div>
                    <h2 className="font-bold text-base leading-tight">{lead.project_name || "Untitled"}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">#{lead.manual_id || "N/A"}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusColor.replace("bg-", "border-").replace("500", "300")} ${statusColor.replace("bg-", "text-").replace("500", "700")} bg-opacity-15`}>
                        {lead.status || "Unknown"}
                    </span>
                    {lead.category && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{lead.category}</span>
                    )}
                    {lead.event_format && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">{lead.event_format}</span>
                    )}
                </div>
                <DetailRow icon={Building2} label="Client" value={lead.client_company?.name} />
                <DetailRow icon={Briefcase} label="Sector" value={lead.sector} />
                <DetailRow icon={User} label="PIC Sales" value={lead.pic_sales_profile?.full_name} />
                <DetailRow icon={User} label="Account Mgr" value={lead.account_manager_profile?.full_name} />
                <DetailRow icon={MapPin} label="Lead Source" value={lead.lead_source} />
                {lead.referral_source && <DetailRow icon={Globe} label="Referral" value={lead.referral_source} />}
            </div>
        </div>
    )
}

function ContactCard({ lead }: { lead: Lead }) {
    if (!lead.contact) return null
    const c = lead.contact
    return (
        <div className="border rounded-xl bg-card p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Contact Person</h3>
            <p className="font-semibold text-sm">{c.salutation ? `${c.salutation} ` : ""}{c.full_name}</p>
            <div className="space-y-1.5">
                {c.email && (
                    <a href={`mailto:${c.email}`} className="flex items-center gap-2 text-xs text-blue-600 hover:underline">
                        <Mail className="h-3 w-3" /> {c.email}
                    </a>
                )}
                {c.phone && (
                    <a href={`tel:${c.phone}`} className="flex items-center gap-2 text-xs text-blue-600 hover:underline">
                        <Phone className="h-3 w-3" /> {c.phone}
                    </a>
                )}
            </div>
        </div>
    )
}

function EventInfoCard({ lead }: { lead: Lead }) {
    if (!lead.event_date_start && (!lead.destinations || lead.destinations.length === 0) && !lead.pax_count) return null
    return (
        <div className="border rounded-xl bg-card p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Event Details</h3>
            <DetailRow icon={CalendarDays} label="Start Date" value={lead.event_date_start ? formatDate(lead.event_date_start) : null} />
            <DetailRow icon={CalendarDays} label="End Date" value={lead.event_date_end ? formatDate(lead.event_date_end) : null} />
            <DetailRow icon={MapPin} label="Venue" value={
                Array.isArray(lead.destinations) && lead.destinations.length > 0
                    ? lead.destinations.map((d: { city: string; venue?: string }) => d.venue ? `${d.city} — ${d.venue}` : d.city).join("; ")
                    : null
            } />
            <DetailRow icon={User} label="Pax" value={lead.pax_count?.toString()} />
            <DetailRow icon={Briefcase} label="Format" value={lead.event_format} />
        </div>
    )
}

function FinancialCard({ lead }: { lead: Lead }) {
    return (
        <div className="border rounded-xl bg-card p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Financials</h3>
            <div className="space-y-2">
                <FinancialRow label="Estimated Value" value={lead.estimated_value} primary />
                <FinancialRow label="Actual Value" value={lead.actual_value} primary />
            </div>
        </div>
    )
}

function ActionCenterCard({ lead }: { lead: Lead }) {
    return (
        <div className="border rounded-xl bg-card overflow-hidden">
            <div className="p-4 border-b bg-muted/30">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                    <ArrowRight className="h-4 w-4 text-primary" /> Action Center
                </h3>
                <p className="text-xs text-muted-foreground mt-1">Update lead status and manage tasks.</p>
            </div>
            <div className="p-4"><WorkflowActions lead={lead} /></div>
        </div>
    )
}

function ClassificationCard({ lead }: { lead: Lead }) {
    if (!lead.stream_type && !lead.business_purpose && !lead.tipe && !lead.grade_lead && !lead.nationality) return null
    return (
        <div className="border rounded-xl bg-card p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Classification</h3>
            <DetailRow icon={Briefcase} label="Stream Type" value={lead.stream_type} />
            <DetailRow icon={Briefcase} label="Business Purpose" value={lead.business_purpose} />
            <DetailRow icon={Briefcase} label="Type" value={lead.tipe} />
            <DetailRow icon={Briefcase} label="Grade" value={lead.grade_lead} />
            <DetailRow icon={Globe} label="Nationality" value={lead.nationality} />
            <DetailRow icon={Briefcase} label="Industry" value={lead.line_industry} />
            <DetailRow icon={MapPin} label="Area" value={lead.area} />
        </div>
    )
}

function DetailRow({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string | null | undefined }) {
    if (!value) return null
    return (
        <div className="flex items-start gap-2">
            <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
                <p className="text-xs font-medium text-foreground break-words">{value}</p>
            </div>
        </div>
    )
}

function FinancialRow({ label, value, primary = false }: { label: string; value: number | null | undefined; primary?: boolean }) {
    return (
        <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className={`text-sm font-mono ${primary ? "font-bold text-foreground" : "text-muted-foreground"}`}>
                {value != null ? formatCurrency(value) : "-"}
            </span>
        </div>
    )
}

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency", currency: "IDR", minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(amount)
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

function getStatusColor(status: string | null): string {
    switch ((status || "").toLowerCase()) {
        case "lead masuk": return "bg-blue-500"
        case "estimasi project": return "bg-amber-500"
        case "proposal sent": return "bg-violet-500"
        case "closed won": return "bg-emerald-500"
        case "closed lost": return "bg-red-400"
        default: return "bg-gray-400"
    }
}
