"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Lead } from "@/types"
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"

// ── Badge helper ──
const Badge = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${className ?? "bg-slate-100 text-slate-600"}`}>
        {children}
    </span>
)

// ── Sortable Header ──
function SortableHeader({ column, label }: { column: any; label: string }) {
    const sorted = column.getIsSorted()
    return (
        <button
            className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-900 transition-colors group"
            onClick={() => column.toggleSorting(sorted === "asc")}
        >
            {label}
            <span className="text-slate-300 group-hover:text-slate-500 transition-colors">
                {sorted === "asc" ? <ArrowUp className="h-3 w-3" /> : sorted === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3" />}
            </span>
        </button>
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

// ── Currency formatter ──
const fmtCurrency = (v: number | null | undefined) =>
    v ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v) : "—"

const fmtDate = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "—"

// ════════════════════════════════════════════════════════════
//  COLUMN DEFINITIONS
// ════════════════════════════════════════════════════════════

export const columns: ColumnDef<Lead>[] = [
    {
        id: "subsidiary",
        header: "Subsidiary",
        accessorFn: (row) => row.company?.name ?? "",
        cell: ({ row }) => {
            const name = row.original.company?.name
            if (!name) return <span className="text-slate-300">—</span>
            return (
                <span className="text-[11px] font-medium text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded">
                    {name}
                </span>
            )
        },
        enableHiding: true,
    },
    {
        id: "client",
        header: ({ column }) => <SortableHeader column={column} label="Client" />,
        accessorFn: (row) => row.client_company?.name ?? "",
        cell: ({ row }) => {
            const name = row.original.client_company?.name
            return (
                <div className="flex items-center gap-2">
                    {name && (
                        <div className="h-6 w-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                            {name.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <span className="font-medium text-[13px] text-slate-800 truncate max-w-[160px]">
                        {name || "—"}
                    </span>
                </div>
            )
        },
    },
    {
        accessorKey: "project_name",
        id: "project_name",
        header: ({ column }) => <SortableHeader column={column} label="Project" />,
        cell: ({ row }) => {
            const val = row.getValue("project_name") as string
            return (
                <span className="text-[13px] text-slate-700 truncate block max-w-[180px]" title={val}>
                    {val || "—"}
                </span>
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
        header: "Stream",
        cell: ({ row }) => {
            const val = row.getValue("main_stream") as string
            if (!val) return <span className="text-slate-300">—</span>
            return <Badge>{val}</Badge>
        },
        enableHiding: true,
    },
    {
        accessorKey: "event_format",
        id: "event_format",
        header: "Format",
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
            const val = (row.original.pipeline_stage?.name) || (row.original.status as string)
            if (!val) return <span className="text-slate-300">—</span>
            return <Badge className={getStatusStyle(val)}>{val}</Badge>
        },
    },
    {
        accessorKey: "grade_lead",
        id: "grade_lead",
        header: "Grade",
        cell: ({ row }) => {
            const val = row.getValue("grade_lead") as string
            if (!val) return <span className="text-slate-300">—</span>
            return <Badge className={getGradeStyle(val)}>{val}</Badge>
        },
        enableHiding: true,
    },
    {
        id: "pic_sales",
        header: ({ column }) => <SortableHeader column={column} label="Sales" />,
        accessorFn: (row) => row.pic_sales_profile?.full_name ?? "",
        cell: ({ row }) => {
            const name = row.original.pic_sales_profile?.full_name
            if (!name) return <span className="text-slate-300">—</span>
            return (
                <div className="flex items-center gap-1.5">
                    <div className="h-5 w-5 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 text-white flex items-center justify-center text-[9px] font-bold shrink-0">
                        {name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                    </div>
                    <span className="text-[12px] text-slate-700 truncate max-w-[100px]">{name}</span>
                </div>
            )
        },
    },
    {
        accessorKey: "target_close_date",
        id: "target_close_date",
        header: ({ column }) => <SortableHeader column={column} label="Close Date" />,
        cell: ({ row }) => {
            const val = row.getValue("target_close_date") as string
            return <span className="text-[12px] text-slate-500 whitespace-nowrap">{fmtDate(val)}</span>
        },
        enableHiding: true,
    },
    {
        accessorKey: "estimated_value",
        id: "estimated_value",
        header: ({ column }) => (
            <div className="text-right">
                <SortableHeader column={column} label="Est. Value" />
            </div>
        ),
        cell: ({ row }) => {
            const amount = parseFloat(row.getValue("estimated_value"))
            return (
                <div className="text-right font-semibold text-[13px] text-slate-900 whitespace-nowrap">
                    {fmtCurrency(amount || null)}
                </div>
            )
        },
    },
]

// Default hidden columns
export const DEFAULT_HIDDEN_COLUMNS: Record<string, boolean> = {
    main_stream: false,
    grade_lead: false,
    target_close_date: false,
}
