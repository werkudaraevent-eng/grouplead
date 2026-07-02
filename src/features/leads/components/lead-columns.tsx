"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Lead, PipelineStage, TransitionRule } from "@/types"
import { ArrowUpDown, ArrowUp, ArrowDown, ExternalLink } from "lucide-react"
import Link from "next/link"
import { formatCurrency as formatCurrencyDefault } from "@/lib/format-currency"
import { StageCellEditor } from "@/features/leads/components/stage-cell-editor"

// ── Badge helper ──
const Badge = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap max-w-full truncate ${className ?? "bg-slate-100 text-slate-600"}`}>
        {children}
    </span>
)

// ── Sortable Header ──
function SortableHeader({ column, label, align = "left" }: { column: any; label: string; align?: "left" | "right" }) {
    const sorted = column.getIsSorted()
    return (
        <button
            className={`flex items-center gap-1 text-[12px] font-medium text-slate-700 hover:text-slate-900 transition-colors group w-full ${
                align === "right" ? "justify-end" : "justify-start"
            }`}
            onClick={() => column.toggleSorting(sorted === "asc")}
        >
            {align === "right" && (
                <span className="text-slate-300 group-hover:text-slate-500 transition-colors">
                    {sorted === "asc" ? <ArrowUp className="h-3 w-3" /> : sorted === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3" />}
                </span>
            )}
            <span className="tracking-tight">{label}</span>
            {align === "left" && (
                <span className="text-slate-300 group-hover:text-slate-500 transition-colors">
                    {sorted === "asc" ? <ArrowUp className="h-3 w-3" /> : sorted === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3" />}
                </span>
            )}
        </button>
    )
}

// ── Static header (non-sortable) ──
function StaticHeader({ label, align = "left" }: { label: string; align?: "left" | "right" }) {
    return (
        <span className={`text-[12px] font-medium text-slate-700 tracking-tight ${align === "right" ? "text-right block" : ""}`}>
            {label}
        </span>
    )
}

// ── Status color mapping ──
function getStatusStyle(val: string | null | undefined): string {
    if (!val) return "bg-slate-50 text-slate-500"
    const lower = val.toLowerCase()
    if (lower.includes("won") || lower.includes("confirm")) return "bg-emerald-50 text-emerald-700"
    if (lower.includes("lost") || lower.includes("cancel") || lower.includes("turndown")) return "bg-rose-50 text-rose-700"
    if (lower.includes("masuk") || lower.includes("new")) return "bg-blue-50 text-blue-700"
    if (lower.includes("sent") || lower.includes("proposal")) return "bg-violet-50 text-violet-700"
    if (lower.includes("estimasi") || lower.includes("project")) return "bg-amber-50 text-amber-700"
    if (lower.includes("postpone")) return "bg-orange-50 text-orange-700"
    return "bg-slate-50 text-slate-600"
}

// ── Grade color mapping ──
function getGradeStyle(val: string | null | undefined): string {
    if (!val) return "bg-slate-50 text-slate-500"
    const map: Record<string, string> = {
        "A+": "bg-emerald-50 text-emerald-700",
        "A": "bg-emerald-50 text-emerald-600",
        "B": "bg-amber-50 text-amber-700",
        "C": "bg-orange-50 text-orange-700",
        "D": "bg-rose-50 text-rose-700",
        "Hot": "bg-rose-50 text-rose-700",
        "Warm": "bg-amber-50 text-amber-700",
        "Cold": "bg-blue-50 text-blue-700",
    }
    return map[val] || "bg-slate-50 text-slate-600"
}

// ── Category color ──
function getCategoryStyle(val: string | null | undefined): string {
    if (!val) return "bg-slate-50 text-slate-500"
    const lower = val.toLowerCase()
    if (lower.includes("hot")) return "bg-rose-50 text-rose-700"
    if (lower.includes("warm")) return "bg-amber-50 text-amber-700"
    if (lower.includes("cold")) return "bg-blue-50 text-blue-700"
    return "bg-slate-50 text-slate-600"
}

const fmtDate = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "—"

// ════════════════════════════════════════════════════════════
//  COLUMN DEFINITIONS
// ════════════════════════════════════════════════════════════

/**
 * Optional context required to make the Stage column editable.
 * When omitted, the Stage cell falls back to a static badge (legacy behavior).
 */
export interface LeadColumnsContext {
    stages?: PipelineStage[]
    transitionRules?: TransitionRule[]
    onStageChanged?: (
        leadId: number,
        stage: PipelineStage,
        leadUpdates?: Record<string, unknown>,
    ) => void
}

/**
 * Returns column definitions for the leads table.
 * Accepts an optional `fmt` function for currency formatting and a context
 * object with pipeline stages + transition rules to enable the inline
 * stage editor in the Stage column.
 */
export function getColumns(
    fmt?: (amount: number) => string,
    ctx?: LeadColumnsContext,
): ColumnDef<Lead>[] {
  const fmtCurrency = (v: number | null | undefined) =>
      v ? (fmt ?? formatCurrencyDefault)(v) : "—"

  const stageEditorEnabled = !!(ctx?.stages && ctx.stages.length > 0)

  return [
    {
        id: "subsidiary",
        size: 190,
        header: ({ column }) => <SortableHeader column={column} label="Subsidiary" />,
        accessorFn: (row) => row.company?.name ?? "",
        cell: ({ row }) => {
            const name = row.original.company?.name
            if (!name) return <span className="text-slate-300">—</span>
            const initial = name.split(" ").map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || name.charAt(0).toUpperCase()
            return (
                <div className="flex items-center gap-2 w-full min-w-0" title={name}>
                    <div className="h-6 w-6 rounded-md bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100 flex items-center justify-center text-[10px] font-semibold shrink-0">
                        {initial}
                    </div>
                    <span className="text-[12.5px] font-medium text-slate-700 truncate min-w-0">{name}</span>
                </div>
            )
        },
        enableHiding: true,
    },
    {
        id: "client",
        size: 200,
        header: ({ column }) => <SortableHeader column={column} label="Client" />,
        accessorFn: (row) => row.client_company?.name ?? "",
        cell: ({ row }) => {
            const name = row.original.client_company?.name
            return (
                <div className="flex items-center gap-2 w-full min-w-0">
                    {name && (
                        <div className="h-6 w-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                            {name.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <span className="font-medium text-[13px] text-slate-800 truncate min-w-0">
                        {name || "—"}
                    </span>
                </div>
            )
        },
    },
    {
        accessorKey: "project_name",
        id: "project_name",
        size: 240,
        header: ({ column }) => <SortableHeader column={column} label="Project" />,
        cell: ({ row }) => {
            const val = row.getValue("project_name") as string
            const leadId = row.original.id
            return (
                <div className="group/project flex items-center gap-1.5 w-full min-w-0">
                    <span
                        className="text-[13px] text-slate-700 truncate min-w-0"
                        title={val}
                    >
                        {val || "—"}
                    </span>
                    <Link
                        href={`/leads/${leadId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0 opacity-0 group-hover/project:opacity-100 text-slate-400 hover:text-slate-700 transition-opacity"
                        aria-label="Open lead detail page"
                        title="Open detail page"
                    >
                        <ExternalLink className="h-3 w-3" />
                    </Link>
                </div>
            )
        },
    },
    {
        accessorKey: "category",
        id: "category",
        header: ({ column }) => <SortableHeader column={column} label="Category" />,
        cell: ({ row }) => {
            const val = row.getValue("category") as string
            if (!val) return <span className="text-slate-300">—</span>
            return <Badge className={getCategoryStyle(val)}>{val}</Badge>
        },
        enableHiding: true,
    },
    {
        accessorKey: "main_stream",
        id: "main_stream",
        header: ({ column }) => <SortableHeader column={column} label="Stream" />,
        cell: ({ row }) => {
            const val = row.getValue("main_stream") as string
            if (!val) return <span className="text-slate-300">—</span>
            return <Badge>{val}</Badge>
        },
        enableHiding: true,
    },
    {
        accessorKey: "stream_type",
        id: "stream_type",
        header: ({ column }) => <SortableHeader column={column} label="Stream Type" />,
        cell: ({ row }) => {
            const val = row.getValue("stream_type") as string
            if (!val) return <span className="text-slate-300">—</span>
            return <Badge className="bg-indigo-50 text-indigo-700">{val}</Badge>
        },
        enableHiding: true,
    },
    {
        accessorKey: "event_format",
        id: "event_format",
        header: ({ column }) => <SortableHeader column={column} label="Format" />,
        cell: ({ row }) => {
            const val = row.getValue("event_format") as string
            if (!val) return <span className="text-slate-300">—</span>
            return <Badge className="bg-blue-50 text-blue-700">{val}</Badge>
        },
        enableHiding: true,
    },
    {
        id: "pipeline_stage",
        header: ({ column }) => <SortableHeader column={column} label="Stage" />,
        accessorFn: (row) => row.pipeline_stage?.name ?? row.status ?? "",
        cell: ({ row }) => {
            const lead = row.original
            const val = lead.pipeline_stage?.name || (lead.status as string)
            if (stageEditorEnabled) {
                return (
                    <StageCellEditor
                        lead={lead}
                        stages={ctx!.stages!}
                        transitionRules={ctx!.transitionRules ?? []}
                        onStageChanged={ctx!.onStageChanged}
                    />
                )
            }
            if (!val) return <span className="text-slate-300">—</span>
            return <Badge className={getStatusStyle(val)}>{val}</Badge>
        },
    },
    {
        accessorKey: "grade_lead",
        id: "grade_lead",
        header: ({ column }) => <SortableHeader column={column} label="Grade" />,
        cell: ({ row }) => {
            const val = row.getValue("grade_lead") as string
            if (!val) return <span className="text-slate-300">—</span>
            return <Badge className={getGradeStyle(val)}>{val}</Badge>
        },
        enableHiding: true,
    },
    {
        id: "contact_person",
        header: ({ column }) => <SortableHeader column={column} label="Contact Person" />,
        accessorFn: (row) => row.contact?.full_name ?? "",
        cell: ({ row }) => {
            const contact = row.original.contact
            if (!contact?.full_name) return <span className="text-slate-300">—</span>
            return (
                <div className="flex items-center gap-1.5 w-full min-w-0">
                    <div className="h-5 w-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[9px] font-bold shrink-0">
                        {contact.full_name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-[12px] font-medium text-slate-700 truncate min-w-0" title={`${contact.salutation ? contact.salutation + ' ' : ''}${contact.full_name}`}>
                        {contact.salutation ? `${contact.salutation} ` : ""}{contact.full_name}
                    </span>
                </div>
            )
        },
        enableHiding: true,
    },
    {
        id: "pic_sales",
        header: ({ column }) => <SortableHeader column={column} label="PIC Sales" />,
        accessorFn: (row) => row.pic_sales_profile?.full_name ?? "",
        cell: ({ row }) => {
            const name = row.original.pic_sales_profile?.full_name
            const avatar = row.original.pic_sales_profile?.avatar_url
            if (!name) return <span className="text-slate-300">—</span>
            return (
                <div className="flex items-center gap-1.5">
                    <div className="h-5 w-5 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 text-white flex items-center justify-center text-[9px] font-bold shrink-0 overflow-hidden">
                        {avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={avatar} alt={name} className="w-full h-full object-cover" />
                        ) : name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                    </div>
                    <span className="text-[12px] text-slate-700 truncate min-w-0">{name}</span>
                </div>
            )
        },
        enableHiding: true,
    },
    {
        id: "account_manager",
        header: ({ column }) => <SortableHeader column={column} label="Account Manager" />,
        accessorFn: (row) => row.account_manager_profile?.full_name ?? "",
        cell: ({ row }) => {
            const name = row.original.account_manager_profile?.full_name
            const avatar = row.original.account_manager_profile?.avatar_url
            if (!name) return <span className="text-slate-300">—</span>
            return (
                <div className="flex items-center gap-1.5">
                    <div className="h-5 w-5 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center text-[9px] font-bold shrink-0 overflow-hidden">
                        {avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={avatar} alt={name} className="w-full h-full object-cover" />
                        ) : name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                    </div>
                    <span className="text-[12px] text-slate-700 truncate min-w-0">{name}</span>
                </div>
            )
        },
        enableHiding: true,
    },
    {
        accessorKey: "lead_source",
        id: "lead_source",
        header: ({ column }) => <SortableHeader column={column} label="Lead Source" />,
        cell: ({ row }) => {
            const val = row.getValue("lead_source") as string
            if (!val) return <span className="text-slate-300">—</span>
            return <Badge className="bg-teal-50 text-teal-700">{val}</Badge>
        },
        enableHiding: true,
    },
    {
        accessorKey: "referral_source",
        id: "referral_source",
        header: ({ column }) => <SortableHeader column={column} label="Referral Source" />,
        cell: ({ row }) => {
            const val = row.getValue("referral_source") as string
            if (!val) return <span className="text-slate-300">—</span>
            return (
                <span className="text-[12px] text-slate-600 truncate block w-full min-w-0" title={val}>
                    {val}
                </span>
            )
        },
        enableHiding: true,
    },
    {
        accessorKey: "business_purpose",
        id: "business_purpose",
        header: ({ column }) => <SortableHeader column={column} label="Business Purpose" />,
        cell: ({ row }) => {
            const val = row.getValue("business_purpose") as string
            if (!val) return <span className="text-slate-300">—</span>
            return <Badge className="bg-purple-50 text-purple-700">{val}</Badge>
        },
        enableHiding: true,
    },
    {
        accessorKey: "target_close_date",
        id: "target_close_date",
        header: ({ column }) => <SortableHeader column={column} label="Target Close Date" />,
        cell: ({ row }) => {
            const val = row.getValue("target_close_date") as string
            return <span className="text-[12px] text-slate-500 whitespace-nowrap">{fmtDate(val)}</span>
        },
        enableHiding: true,
    },
    {
        id: "event_dates",
        header: ({ column }) => <SortableHeader column={column} label="Event Dates" />,
        accessorFn: (row) => {
            if (row.event_dates && row.event_dates.length > 0) return row.event_dates.join(", ")
            if (row.event_date_start) return row.event_date_start
            return ""
        },
        cell: ({ row }) => {
            const lead = row.original
            if (lead.event_dates && lead.event_dates.length > 0) {
                const formatted = lead.event_dates.map(d => fmtDate(d)).join(", ")
                return <span className="text-[12px] text-slate-500 whitespace-nowrap truncate w-full min-w-0 block" title={formatted}>{formatted}</span>
            }
            if (lead.event_date_start) {
                const start = fmtDate(lead.event_date_start)
                const end = lead.event_date_end ? fmtDate(lead.event_date_end) : null
                return (
                    <span className="text-[12px] text-slate-500 whitespace-nowrap">
                        {start}{end ? ` – ${end}` : ""}
                    </span>
                )
            }
            return <span className="text-slate-300">—</span>
        },
        enableHiding: true,
    },
    {
        accessorKey: "pax_count",
        id: "pax_count",
        header: ({ column }) => <SortableHeader column={column} label="Pax" align="right" />,
        cell: ({ row }) => {
            const val = row.getValue("pax_count") as number
            if (!val) return <span className="text-slate-300 text-right block">—</span>
            return (
                <div className="text-right text-[13px] font-medium text-slate-700">
                    {new Intl.NumberFormat("id-ID").format(val)}
                </div>
            )
        },
        enableHiding: true,
    },
    {
        id: "destinations",
        header: ({ column }) => <SortableHeader column={column} label="Destinations" />,
        accessorFn: (row) => {
            if (!row.destinations || row.destinations.length === 0) return ""
            return row.destinations.map(d => d.city).join(", ")
        },
        cell: ({ row }) => {
            const dests = row.original.destinations
            if (!dests || dests.length === 0) return <span className="text-slate-300">—</span>
            const displayText = dests.map(d => d.venue ? `${d.city} (${d.venue})` : d.city).join(", ")
            return (
                <span className="text-[12px] text-slate-600 truncate block w-full min-w-0" title={displayText}>
                    {displayText}
                </span>
            )
        },
        enableHiding: true,
    },
    {
        accessorKey: "estimated_value",
        id: "estimated_value",
        header: ({ column }) => <SortableHeader column={column} label="Estimated Value" align="right" />,
        cell: ({ row }) => {
            const amount = parseFloat(row.getValue("estimated_value"))
            return (
                <div className="text-right font-semibold text-[13px] text-slate-900 whitespace-nowrap">
                    {fmtCurrency(amount || null)}
                </div>
            )
        },
    },
    {
        accessorKey: "actual_value",
        id: "actual_value",
        header: ({ column }) => <SortableHeader column={column} label="Confirmed Value" align="right" />,
        cell: ({ row }) => {
            const amount = parseFloat(row.getValue("actual_value"))
            return (
                <div className="text-right font-semibold text-[13px] text-slate-700 whitespace-nowrap">
                    {fmtCurrency(amount || null)}
                </div>
            )
        },
        enableHiding: true,
    },
  ]
}

// Backward-compatible export for consumers that don't pass fmt
export const columns: ColumnDef<Lead>[] = getColumns()

// Default hidden columns — columns hidden by default to keep initial view clean
// Users can toggle these on via the Columns popover
export const DEFAULT_HIDDEN_COLUMNS: Record<string, boolean> = {
    stream_type: false,
    grade_lead: false,
    contact_person: false,
    account_manager: false,
    lead_source: false,
    referral_source: false,
    business_purpose: false,
    event_dates: false,
    pax_count: false,
    destinations: false,
    actual_value: false,
}
