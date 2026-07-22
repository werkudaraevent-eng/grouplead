"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { usePermissions } from "@/contexts/permissions-context"
import { SettingsPageHeader } from "@/components/layout/settings-page-header"
import { Button } from "@/components/ui/button"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Trash2, RotateCcw, ShieldAlert, Loader2, KanbanSquare, Building2, Users } from "lucide-react"
import {
    listTrash, restoreTrashItem, purgeTrashItem,
    getTrashRetentionDays, setTrashRetentionDays, purgeExpiredTrash,
    type TrashItem, type TrashEntity,
} from "@/app/actions/recycle-bin-actions"
import { formatRelativeTime } from "@/lib/relative-time"
import { cn } from "@/lib/utils"

const ENTITY_META: Record<TrashEntity, { label: string; icon: typeof KanbanSquare }> = {
    lead: { label: "Lead", icon: KanbanSquare },
    client_company: { label: "Company", icon: Building2 },
    contact: { label: "Contact", icon: Users },
}

// Type badge tints — brand-aligned, one subtle accent each for fast scanning.
const TYPE_BADGE: Record<TrashEntity, string> = {
    lead: "bg-[#2069B4]/10 text-[#2069B4]",
    client_company: "bg-[#02378D]/10 text-[#02378D]",
    contact: "bg-[#6EBDA1]/15 text-[#3f7e69]",
}

type TrashFilter = "all" | TrashEntity
const FILTERS: { key: TrashFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "lead", label: "Leads" },
    { key: "client_company", label: "Companies" },
    { key: "contact", label: "Contacts" },
]

export default function RecycleBinPage() {
    const router = useRouter()
    const { userType, loading: permsLoading } = usePermissions()
    const isAdmin = userType === "super_admin" || userType === "admin"

    const [items, setItems] = useState<TrashItem[]>([])
    const [loading, setLoading] = useState(true)
    const [busyId, setBusyId] = useState<string | null>(null)
    const [purgeTarget, setPurgeTarget] = useState<TrashItem | null>(null)
    const [retention, setRetention] = useState<number | null>(null)
    const [savingRetention, setSavingRetention] = useState(false)
    const isSuperAdmin = userType === "super_admin"

    const load = async () => {
        setLoading(true)
        // Lazy auto-purge: clean items past the retention window whenever an
        // admin opens the bin (no cron needed for the common case).
        await purgeExpiredTrash()
        const res = await listTrash()
        if (res.success && res.data) setItems(res.data.items)
        else if (!res.success) toast.error(res.error || "Failed to load Recycle Bin")
        setLoading(false)
        if (isSuperAdmin) getTrashRetentionDays().then(setRetention)
    }

    const handleSaveRetention = async () => {
        if (retention === null) return
        setSavingRetention(true)
        const res = await setTrashRetentionDays(retention)
        setSavingRetention(false)
        if (!res.success) { toast.error(res.error || "Failed to save retention"); return }
        toast.success("Retention updated")
    }

    useEffect(() => {
        if (!permsLoading && isAdmin) void load()
        else if (!permsLoading) setLoading(false)
    }, [permsLoading, isAdmin])

    const handleRestore = async (item: TrashItem) => {
        setBusyId(item.id)
        const res = await restoreTrashItem(item.entity, item.id)
        setBusyId(null)
        if (!res.success) { toast.error(res.error || "Restore failed"); return }
        toast.success(`${ENTITY_META[item.entity].label} restored`)
        setItems(prev => prev.filter(i => !(i.id === item.id && i.entity === item.entity)))
    }

    const handlePurge = async () => {
        if (!purgeTarget) return
        const item = purgeTarget
        setBusyId(item.id)
        const res = await purgeTrashItem(item.entity, item.id)
        setBusyId(null)
        setPurgeTarget(null)
        if (!res.success) { toast.error(res.error || "Permanent delete failed"); return }
        toast.success(`${ENTITY_META[item.entity].label} permanently deleted`)
        setItems(prev => prev.filter(i => !(i.id === item.id && i.entity === item.entity)))
    }

    const [filter, setFilter] = useState<TrashFilter>("all")
    const counts = useMemo(() => {
        const c: Record<TrashEntity, number> = { lead: 0, client_company: 0, contact: 0 }
        for (const i of items) c[i.entity]++
        return c
    }, [items])
    const filtered = useMemo(
        () => (filter === "all" ? items : items.filter(i => i.entity === filter)),
        [items, filter],
    )

    if (!permsLoading && !isAdmin) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-3">
                    <ShieldAlert className="w-6 h-6 text-red-500" />
                </div>
                <h2 className="text-[15px] font-semibold text-foreground">Access restricted</h2>
                <p className="text-[13px] text-muted-foreground mt-1 max-w-sm">
                    The Recycle Bin is available to administrators only.
                </p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => router.push("/settings")}>
                    Back to Settings
                </Button>
            </div>
        )
    }

    return (
        <div className="min-h-[100dvh] bg-background">
            <SettingsPageHeader
                title="Recycle Bin"
                subtitle="Deleted leads, companies, and contacts. Restore them or remove permanently."
                breadcrumbs={[{ label: "Recycle Bin" }]}
            />

            <div className="px-4 sm:px-6 lg:px-8 pb-20">
                <div className="w-full max-w-[1000px]">
                    {isSuperAdmin && retention !== null && (
                        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-foreground">Auto-delete after</p>
                                <p className="text-[12px] text-muted-foreground mt-0.5">Trashed items past this age are removed permanently. Set 0 to keep forever.</p>
                            </div>
                            <input
                                type="number"
                                min={0}
                                max={3650}
                                value={retention}
                                onChange={(e) => setRetention(Math.max(0, parseInt(e.target.value || "0", 10)))}
                                className="h-9 w-24 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary/50"
                            />
                            <span className="text-sm text-muted-foreground">days</span>
                            <Button size="sm" disabled={savingRetention} onClick={handleSaveRetention} className="h-9">
                                {savingRetention && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                                Save
                            </Button>
                        </div>
                    )}
                    {loading ? (
                        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
                            <div className="border-b border-border px-3 py-2.5">
                                <div className="h-8 w-72 rounded-lg bg-muted animate-pulse" />
                            </div>
                            <div className="divide-y divide-border">
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                                        <div className="h-8 w-8 shrink-0 rounded-md bg-muted animate-pulse" />
                                        <div className="flex-1 space-y-2">
                                            <div className="h-3.5 w-48 rounded bg-muted animate-pulse" />
                                            <div className="h-3 w-32 rounded bg-muted animate-pulse" />
                                        </div>
                                        <div className="h-8 w-44 rounded bg-muted animate-pulse" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="mt-10 rounded-xl border border-border bg-card p-10 text-center">
                            <Trash2 className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                            <h3 className="mt-3 text-sm font-semibold text-foreground">Recycle Bin is empty</h3>
                            <p className="mt-1 text-sm text-muted-foreground">Deleted items will appear here and can be restored.</p>
                        </div>
                    ) : (
                        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
                            {/* Toolbar — segmented type filter + total count */}
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-2.5">
                                <div className="inline-flex items-center gap-0.5 rounded-lg bg-muted/50 p-0.5">
                                    {FILTERS.map(f => {
                                        const active = filter === f.key
                                        const count = f.key === "all" ? items.length : counts[f.key]
                                        return (
                                            <button
                                                key={f.key}
                                                type="button"
                                                onClick={() => setFilter(f.key)}
                                                className={cn(
                                                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                                                    active
                                                        ? "bg-card text-foreground shadow-sm"
                                                        : "text-muted-foreground hover:text-foreground",
                                                )}
                                            >
                                                {f.label}
                                                <span className={cn(
                                                    "rounded px-1 text-[11px] tabular-nums",
                                                    active ? "bg-muted text-foreground" : "text-muted-foreground/70",
                                                )}>
                                                    {count}
                                                </span>
                                            </button>
                                        )
                                    })}
                                </div>
                                <span className="px-1 text-[12px] text-muted-foreground tabular-nums">
                                    {filtered.length} item{filtered.length === 1 ? "" : "s"}
                                </span>
                            </div>

                            {/* Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-border bg-muted/30 text-left">
                                            <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">Name</th>
                                            <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">Type</th>
                                            <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Deleted</th>
                                            <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Deleted by</th>
                                            <th className="px-4 py-2.5 w-px"><span className="sr-only">Actions</span></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {filtered.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                                                    No {filter === "all" ? "items" : `${ENTITY_META[filter].label.toLowerCase()}s`} in the Recycle Bin.
                                                </td>
                                            </tr>
                                        ) : filtered.map((item) => {
                                            const meta = ENTITY_META[item.entity]
                                            const Icon = meta.icon
                                            const isBusy = busyId === item.id
                                            return (
                                                <tr key={`${item.entity}-${item.id}`} className="group transition-colors hover:bg-muted/20">
                                                    <td className="px-4 py-3">
                                                        <div className="flex min-w-0 items-center gap-3">
                                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                                                                <Icon className="h-4 w-4" />
                                                            </div>
                                                            <span className="truncate font-medium text-foreground">{item.label}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={cn(
                                                            "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold",
                                                            TYPE_BADGE[item.entity],
                                                        )}>
                                                            {meta.label}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-[13px] text-muted-foreground tabular-nums">
                                                        {formatRelativeTime(item.deleted_at) || "recently"}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-[13px] text-muted-foreground">
                                                        {item.deleted_by_name || "—"}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className={cn(
                                                            "flex items-center justify-end gap-1.5 transition-opacity",
                                                            isBusy ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100",
                                                        )}>
                                                            <Button variant="outline" size="sm" disabled={isBusy} onClick={() => handleRestore(item)} className="h-8 gap-1.5">
                                                                {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                                                                Restore
                                                            </Button>
                                                            <Button variant="ghost" size="sm" disabled={isBusy} onClick={() => setPurgeTarget(item)} className="h-8 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10">
                                                                <Trash2 className="h-3.5 w-3.5" /> Delete forever
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <AlertDialog open={!!purgeTarget} onOpenChange={(o) => { if (!o) setPurgeTarget(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Permanently delete?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete <strong className="text-foreground">{purgeTarget?.label}</strong>.
                            This cannot be undone — the item will not be recoverable.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={(e) => { e.preventDefault(); handlePurge() }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete forever
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
