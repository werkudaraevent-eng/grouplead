"use client"

import { Lead } from "@/types"
import {
    Building2, User, Mail, Phone, MapPin, DollarSign,
    CheckCircle2, Clock, Circle, ArrowRight,
    FileText, Send, Briefcase, CalendarDays
} from "lucide-react"
import { WorkflowActions } from "./workflow-actions"

interface LeadDetailLayoutProps {
    lead: Lead
}

export function LeadDetailLayout({ lead }: LeadDetailLayoutProps) {
    return (
        <div className="grid grid-cols-12 gap-6 p-6">
            {/* === LEFT COLUMN (Span 3): Identity Card === */}
            <div className="col-span-12 lg:col-span-3 space-y-4">
                <IdentityCard lead={lead} />
                <ContactCard lead={lead} />
                <FinancialCard lead={lead} />
            </div>

            {/* === CENTER COLUMN (Span 6): Timeline === */}
            <div className="col-span-12 lg:col-span-6">
                <TimelineCard lead={lead} />
            </div>

            {/* === RIGHT COLUMN (Span 3): Action Center === */}
            <div className="col-span-12 lg:col-span-3 space-y-4">
                <ActionCenterCard lead={lead} />
                <EventInfoCard lead={lead} />
            </div>
        </div>
    )
}

// ========================================
// LEFT COLUMN COMPONENTS
// ========================================

function IdentityCard({ lead }: { lead: Lead }) {
    const statusColor = getStatusColor(lead.status)

    return (
        <div className="border rounded-xl bg-card overflow-hidden">
            {/* Header strip */}
            <div className={`h-1.5 ${statusColor}`} />
            <div className="p-4 space-y-3">
                <div>
                    <h2 className="font-bold text-base leading-tight">{lead.project_name || 'Untitled'}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">#{lead.manual_id || 'N/A'}</p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusColor.replace('bg-', 'border-').replace('500', '300')} ${statusColor.replace('bg-', 'text-').replace('500', '700')} bg-opacity-15`}>
                        {lead.status || 'Unknown'}
                    </span>
                    {lead.bu_revenue && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                            {lead.bu_revenue}
                        </span>
                    )}
                    {lead.category && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {lead.category}
                        </span>
                    )}
                </div>

                <DetailRow icon={Building2} label="Company" value={lead.company_name} />
                <DetailRow icon={Briefcase} label="Sector" value={lead.sector} />
                <DetailRow icon={User} label="PIC Sales" value={lead.pic_sales} />
                <DetailRow icon={User} label="Account Mgr" value={lead.account_manager} />
                <DetailRow icon={MapPin} label="Source" value={lead.source_lead} />
            </div>
        </div>
    )
}

function ContactCard({ lead }: { lead: Lead }) {
    const fullName = [lead.salutation, lead.contact_full_name].filter(Boolean).join(' ')
    if (!fullName && !lead.contact_email && !lead.contact_mobile) return null

    return (
        <div className="border rounded-xl bg-card p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Contact Person</h3>

            {fullName && (
                <div>
                    <p className="font-semibold text-sm">{fullName}</p>
                    {lead.job_title && <p className="text-xs text-muted-foreground">{lead.job_title}</p>}
                </div>
            )}

            <div className="space-y-1.5">
                {lead.contact_email && (
                    <a href={`mailto:${lead.contact_email}`} className="flex items-center gap-2 text-xs text-blue-600 hover:underline">
                        <Mail className="h-3 w-3" /> {lead.contact_email}
                    </a>
                )}
                {lead.contact_mobile && (
                    <a href={`tel:${lead.contact_mobile}`} className="flex items-center gap-2 text-xs text-blue-600 hover:underline">
                        <Phone className="h-3 w-3" /> {lead.contact_mobile}
                    </a>
                )}
                {lead.office_phone && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" /> {lead.office_phone} (Office)
                    </div>
                )}
            </div>
        </div>
    )
}

function FinancialCard({ lead }: { lead: Lead }) {
    return (
        <div className="border rounded-xl bg-card p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Financials</h3>
            <div className="space-y-2">
                <FinancialRow label="Estimated Revenue" value={lead.estimated_revenue} primary />
                <FinancialRow label="Nominal Konfirmasi" value={lead.nominal_konfirmasi} primary />
                <FinancialRow label="Materialized" value={lead.materialized_amount} />
                <FinancialRow label="Selisih" value={lead.difference_amount} />
                {lead.percentage_deal != null && (
                    <div className="flex justify-between items-center pt-2 border-t">
                        <span className="text-xs text-muted-foreground">Deal %</span>
                        <span className="text-sm font-bold text-primary">{lead.percentage_deal}%</span>
                    </div>
                )}
            </div>
        </div>
    )
}

// ========================================
// CENTER COLUMN: TIMELINE
// ========================================

const TIMELINE_STEPS = [
    { key: 'date_lead_received', label: 'Lead Received', desc: 'Initial inquiry received.', icon: CalendarDays },
    { key: 'sla_tep_to_pd', label: 'TEP → Project Design', desc: 'Handoff from Event Planner to PD.', icon: ArrowRight },
    { key: 'sla_pd_to_so', label: 'PD → Sales Ops', desc: 'Design sent to Sales Ops for validation.', icon: ArrowRight },
    { key: 'sla_so_to_pd', label: 'SO → PD (Feedback)', desc: 'Sales Ops feedback returned to PD.', icon: ArrowRight },
    { key: 'sla_pd_to_tep', label: 'PD → TEP (Final)', desc: 'Final design handover to Event Planner.', icon: ArrowRight },
    { key: 'sla_pd_to_acs', label: 'PD → ACS', desc: 'Design sent to ACS for review.', icon: ArrowRight },
    { key: 'sla_acs_to_pd', label: 'ACS → PD', desc: 'ACS review returned to PD.', icon: ArrowRight },
    { key: 'sla_quo_to_tep', label: 'Quotation Drafted', desc: 'Quotation prepared by TEP.', icon: FileText },
    { key: 'sla_pro_to_tep', label: 'Proposal Drafted', desc: 'Proposal document prepared.', icon: FileText },
    { key: 'sla_quo_send_client', label: 'Quotation Sent to Client', desc: 'Official quotation delivered.', icon: Send },
    { key: 'sla_pro_send_client', label: 'Proposal Sent to Client', desc: 'Full proposal delivered to client.', icon: Send },
] as const

function TimelineCard({ lead }: { lead: Lead }) {
    // Find the last completed step index for the progress indicator
    let lastCompleted = -1
    TIMELINE_STEPS.forEach((step, i) => {
        if (lead[step.key as keyof Lead]) lastCompleted = i
    })

    return (
        <div className="border rounded-xl bg-card overflow-hidden h-full">
            <div className="p-4 border-b bg-muted/30">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    SLA Processing Timeline
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                    {lastCompleted + 1} of {TIMELINE_STEPS.length} stages completed
                </p>
                {/* Progress bar */}
                <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${((lastCompleted + 1) / TIMELINE_STEPS.length) * 100}%` }}
                    />
                </div>
            </div>

            <div className="p-4 space-y-0">
                {TIMELINE_STEPS.map((step, index) => {
                    const dateValue = lead[step.key as keyof Lead] as string | null
                    const isDone = !!dateValue
                    const isCurrent = index === lastCompleted + 1
                    const Icon = step.icon

                    return (
                        <div key={step.key} className="relative flex gap-3">
                            {/* Vertical line */}
                            <div className="flex flex-col items-center">
                                <div className={`
                                    flex items-center justify-center w-7 h-7 rounded-full border-2 shrink-0 z-10
                                    ${isDone
                                        ? 'bg-primary border-primary text-primary-foreground'
                                        : isCurrent
                                            ? 'bg-background border-primary text-primary animate-pulse'
                                            : 'bg-background border-muted-foreground/20 text-muted-foreground/30'
                                    }
                                `}>
                                    {isDone ? (
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                    ) : isCurrent ? (
                                        <Circle className="h-3 w-3 fill-primary" />
                                    ) : (
                                        <Circle className="h-3 w-3" />
                                    )}
                                </div>
                                {index < TIMELINE_STEPS.length - 1 && (
                                    <div className={`w-0.5 flex-1 min-h-[32px] ${isDone ? 'bg-primary' : 'bg-muted-foreground/10'}`} />
                                )}
                            </div>

                            {/* Content */}
                            <div className={`pb-6 pt-0.5 ${!isDone && !isCurrent ? 'opacity-40' : ''}`}>
                                <div className="flex items-center gap-2">
                                    <span className={`text-sm font-semibold ${isDone ? 'text-foreground' : isCurrent ? 'text-primary' : 'text-muted-foreground'}`}>
                                        {step.label}
                                    </span>
                                    {isDone && (
                                        <Icon className="h-3 w-3 text-primary" />
                                    )}
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-0.5">{step.desc}</p>
                                {isDone && dateValue && (
                                    <span className="inline-block mt-1 text-[10px] font-mono bg-primary/10 text-primary px-2 py-0.5 rounded">
                                        {formatDateTime(dateValue)}
                                    </span>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// ========================================
// RIGHT COLUMN: ACTION CENTER
// ========================================

function ActionCenterCard({ lead }: { lead: Lead }) {
    return (
        <div className="border rounded-xl bg-card overflow-hidden">
            <div className="p-4 border-b bg-muted/30">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                    <ArrowRight className="h-4 w-4 text-primary" />
                    Action Center
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                    Update lead status and log SLA timestamps.
                </p>
            </div>
            <div className="p-4">
                <WorkflowActions lead={lead} />
            </div>
        </div>
    )
}

function EventInfoCard({ lead }: { lead: Lead }) {
    if (!lead.date_of_event && !lead.venue_hotel && !lead.number_of_pax) return null

    return (
        <div className="border rounded-xl bg-card p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Event Details</h3>
            <DetailRow icon={CalendarDays} label="Event Date" value={lead.date_of_event ? formatDate(lead.date_of_event) : null} />
            <DetailRow icon={MapPin} label="Venue" value={lead.venue_hotel} />
            <DetailRow icon={MapPin} label="City" value={lead.location_city} />
            <DetailRow icon={User} label="Pax" value={lead.number_of_pax?.toString()} />
            <DetailRow icon={Briefcase} label="Format" value={[lead.is_onsite ? 'Onsite' : null, lead.is_online ? 'Online' : null].filter(Boolean).join(' + ') || null} />
        </div>
    )
}

// ========================================
// SHARED HELPERS
// ========================================

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
            <span className={`text-sm font-mono ${primary ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>
                {value != null ? formatCurrency(value) : '-'}
            </span>
        </div>
    )
}

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency', currency: 'IDR',
        minimumFractionDigits: 0, maximumFractionDigits: 0
    }).format(amount)
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateTime(dateStr: string): string {
    return new Date(dateStr).toLocaleString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    })
}

function getStatusColor(status: string | null): string {
    switch ((status || '').toLowerCase()) {
        case 'lead masuk': return 'bg-blue-500'
        case 'estimasi project': return 'bg-amber-500'
        case 'proposal sent': return 'bg-violet-500'
        case 'closed won': return 'bg-emerald-500'
        case 'closed lost': return 'bg-red-400'
        default: return 'bg-gray-400'
    }
}
