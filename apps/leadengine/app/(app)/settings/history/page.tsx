"use client"

/**
 * Settings → Change history: the audit trail of every action across the CRM.
 *
 * It used to be a drawer destination (/history) open to every role unless an
 * admin flipped a visibility switch. An audit log is an administrator's
 * monitoring tool, not a place anyone works from each day, and Salesforce
 * (Setup → Audit Trail), HubSpot, Linear and Notion all keep it in settings,
 * as Sales Activity does with Riwayat perubahan. So it lives here now, behind
 * the Settings grant the layout and fetchAuditLogs both check; what happened
 * to one lead is on that lead's Timeline tab. /history redirects here.
 */

import { useCallback, useEffect, useState, useTransition } from "react"
import { fetchAuditLogs, type AuditLogRow } from "@/app/actions/audit-actions"
import { createClient } from "@/utils/supabase/client"
import { SettingsPageHeader } from "@/components/layout/settings-page-header"
import {
    Search, ChevronLeft, ChevronRight, Activity,
    Plus, Pencil, Trash2, ArrowRightLeft, Upload, Download,
    LogIn, Settings, Users,
} from "@/components/icons"
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

export default function ChangeHistoryPage() {
    const [isPending, startTransition] = useTransition()
    const [logs, setLogs] = useState<AuditLogRow[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState("")
    const [actionFilter, setActionFilter] = useState<string>("")
    const [resourceFilter, setResourceFilter] = useState<string>("")
    const [userFilter, setUserFilter] = useState<string>("")
    const [users, setUsers] = useState<{ id: string; full_name: string }[]>([])

    const pageSize = 30
    const totalPages = Math.ceil(total / pageSize)

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

    return (
        // Fluid on a phone: the filters wrap and the rows reflow, so the page
        // opts out of the shell's 900px canvas (main-layout.tsx).
        <div data-fluid-page className="min-h-[100dvh] bg-background">
            <SettingsPageHeader
                title="Change history"
                subtitle={`Who created, changed and deleted what across LeadEngine, recorded automatically · ${total} events`}
                breadcrumbs={[{ label: "Change history" }]}
            />
            <div className="shrink-0">
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3 pb-4 px-4 sm:px-6 lg:px-8 border-b border-border">
                    <div className="relative w-full min-w-[180px] sm:w-auto sm:flex-1 sm:max-w-[320px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        <Input
                            placeholder="Search activity..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="pl-9 h-9 w-full bg-white border-slate-200 hover:border-slate-300 focus-visible:ring-1 focus-visible:ring-slate-400 text-[13px] shadow-sm rounded-lg"
                        />
                    </div>
                    <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v === "all" ? "" : v); setPage(1) }}>
                        <SelectTrigger className="h-9 flex-1 min-w-[130px] max-w-[180px] bg-white border-slate-200 text-[13px] shadow-sm">
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
                        <SelectTrigger className="h-9 flex-1 min-w-[130px] max-w-[180px] bg-white border-slate-200 text-[13px] shadow-sm">
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
                        <SelectTrigger className="h-9 flex-1 min-w-[150px] max-w-[220px] bg-white border-slate-200 text-[13px] shadow-sm">
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
            <div className="px-4 py-4 sm:px-6">
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
                <div className="px-4 sm:px-6 py-3 border-t border-slate-100 bg-white flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                        Page {page} of {totalPages} · {total} total events
                    </span>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="h-9 w-9 p-0">
                            <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="h-9 w-9 p-0">
                            <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
