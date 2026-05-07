"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { fetchAuditLogs, getAuditVisibility, type AuditLogRow } from "@/app/actions/audit-actions"
import { createClient } from "@/utils/supabase/client"
import { usePermissions } from "@/contexts/permissions-context"
import {
    Search, Filter, ChevronLeft, ChevronRight, Activity,
    Plus, Pencil, Trash2, ArrowRightLeft, Upload, Download,
    LogIn, Settings, Users, ShieldAlert,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"

// ─── Action icon mapping ──────────────────────────────────────────────────
const ACTION_ICONS: Record<string, typeof Activity> = {
    create: Plus,
    update: Pencil,
    delete: Trash2,
    stage_change: ArrowRightLeft,
    import: Upload,
    export: Download,
    login: LogIn,
    settings: Settings,
    user_management: Users,
}

const ACTION_COLORS: Record<string, string> = {
    create: "text-emerald-600 bg-emerald-50",
    update: "text-blue-600 bg-blue-50",
    delete: "text-red-600 bg-red-50",
    stage_change: "text-amber-600 bg-amber-50",
    import: "text-indigo-600 bg-indigo-50",
    export: "text-cyan-600 bg-cyan-50",
    login: "text-slate-600 bg-slate-50",
    settings: "text-slate-600 bg-slate-50",
    user_management: "text-purple-600 bg-purple-50",
}

const RESOURCE_TYPES = ["lead", "contact", "company", "goal", "pipeline", "user", "settings"]
const ACTION_TYPES = ["create", "update", "delete", "stage_change", "import", "export", "login", "settings"]

export default function HistoryPage() {
    const { can } = usePermissions()
    const [isPending, startTransition] = useTransition()
    const [logs, setLogs] = useState<AuditLogRow[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState("")
    const [actionFilter, setActionFilter] = useState<string>("")
    const [resourceFilter, setResourceFilter] = useState<string>("")
    const [userFilter, setUserFilter] = useState<string>("")
    const [users, setUsers] = useState<{ id: string; full_name: string }[]>([])
    const [visibility, setVisibility] = useState<"all_users" | "admin_only">("all_users")
    const [accessDenied, setAccessDenied] = useState(false)

    const pageSize = 30
    const totalPages = Math.ceil(total / pageSize)

    // Check visibility setting
    useEffect(() => {
        getAuditVisibility().then(v => {
            setVisibility(v)
            if (v === "admin_only" && !can("settings", "update")) {
                setAccessDenied(true)
            }
        })
    }, [can])

    // Fetch users for filter
    useEffect(() => {
        const supabase = createClient()
        supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name")
            .then(({ data }) => { if (data) setUsers(data) })
    }, [])

    // Fetch logs
    const loadLogs = useCallback(() => {
        startTransition(async () => {
            const result = await fetchAuditLogs({
                page,
                pageSize,
                action: actionFilter || undefined,
                resource_type: resourceFilter || undefined,
                user_id: userFilter || undefined,
                search: search || undefined,
            })
            setLogs(result.data)
            setTotal(result.total)
        })
    }, [page, actionFilter, resourceFilter, userFilter, search])

    useEffect(() => { loadLogs() }, [loadLogs])

    // Debounced search
    const [searchInput, setSearchInput] = useState("")
    useEffect(() => {
        const t = setTimeout(() => setSearch(searchInput), 400)
        return () => clearTimeout(t)
    }, [searchInput])

    if (accessDenied) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                <ShieldAlert className="h-12 w-12 text-slate-300" />
                <h2 className="text-lg font-semibold text-slate-700">Access Restricted</h2>
                <p className="text-sm text-slate-500 text-center max-w-sm">
                    The audit history is currently restricted to administrators only.
                    Contact your admin to request access.
                </p>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-200 bg-white shrink-0">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-semibold text-[#292D30]">Activity History</h1>
                        <p className="text-[12px] text-slate-500 mt-0.5">
                            Audit trail of all actions across the system · {total} events
                        </p>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2 mt-4">
                    <div className="relative flex-1 max-w-xs">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        <Input
                            placeholder="Search activity..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="pl-8 h-8 text-xs"
                        />
                    </div>
                    <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v === "all" ? "" : v); setPage(1) }}>
                        <SelectTrigger className="h-8 w-[130px] text-xs">
                            <SelectValue placeholder="All Actions" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Actions</SelectItem>
                            {ACTION_TYPES.map(a => (
                                <SelectItem key={a} value={a} className="text-xs capitalize">{a.replace("_", " ")}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={resourceFilter} onValueChange={(v) => { setResourceFilter(v === "all" ? "" : v); setPage(1) }}>
                        <SelectTrigger className="h-8 w-[130px] text-xs">
                            <SelectValue placeholder="All Resources" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Resources</SelectItem>
                            {RESOURCE_TYPES.map(r => (
                                <SelectItem key={r} value={r} className="text-xs capitalize">{r}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={userFilter} onValueChange={(v) => { setUserFilter(v === "all" ? "" : v); setPage(1) }}>
                        <SelectTrigger className="h-8 w-[150px] text-xs">
                            <SelectValue placeholder="All Users" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Users</SelectItem>
                            {users.map(u => (
                                <SelectItem key={u.id} value={u.id} className="text-xs">{u.full_name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Log List */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
                {isPending && logs.length === 0 ? (
                    <div className="flex items-center justify-center py-20 text-sm text-slate-400">
                        Loading...
                    </div>
                ) : logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Activity className="h-10 w-10 text-slate-200" />
                        <p className="text-sm text-slate-400">No activity found</p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {logs.map((log) => {
                            const Icon = ACTION_ICONS[log.action] || Activity
                            const colorClass = ACTION_COLORS[log.action] || "text-slate-600 bg-slate-50"
                            return (
                                <div
                                    key={log.id}
                                    className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50/80 transition-colors group"
                                >
                                    {/* Icon */}
                                    <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${colorClass}`}>
                                        <Icon className="h-3.5 w-3.5" />
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[12px] text-[#292D30] leading-relaxed">
                                            <span className="font-semibold">{log.user_name}</span>
                                            {" "}
                                            <span className="text-slate-600">{log.description}</span>
                                        </p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] text-slate-400">
                                                {new Date(log.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                                                {" "}
                                                {new Date(log.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                                            </span>
                                            <span className="text-[10px] text-slate-300">·</span>
                                            <span className="text-[10px] text-slate-400 capitalize">{log.resource_type}</span>
                                            {log.resource_name && (
                                                <>
                                                    <span className="text-[10px] text-slate-300">·</span>
                                                    <span className="text-[10px] text-slate-500 font-medium truncate max-w-[200px]">{log.resource_name}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action badge */}
                                    <span className="text-[9px] font-medium text-slate-400 uppercase tracking-wide shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {log.action.replace("_", " ")}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="px-6 py-3 border-t border-slate-100 bg-white flex items-center justify-between shrink-0">
                    <span className="text-[11px] text-slate-400">
                        Page {page} of {totalPages} · {total} total events
                    </span>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="h-7 w-7 p-0">
                            <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="h-7 w-7 p-0">
                            <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
