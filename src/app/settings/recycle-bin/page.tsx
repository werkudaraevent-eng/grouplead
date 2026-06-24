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

const ENTITY_META: Record<TrashEntity, { label: string; icon: typeof KanbanSquare }> = {
    lead: { label: "Lead", icon: KanbanSquare },
    client_company: { label: "Company", icon: Building2 },
    contact: { label: "Contact", icon: Users },
}

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

    const grouped = useMemo(() => items, [items])

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
                        <div className="mt-10 flex justify-center text-muted-foreground">
                            <Loader2 className="w-5 h-5 animate-spin" />
                        </div>
                    ) : grouped.length === 0 ? (
                        <div className="mt-10 rounded-xl border border-border bg-card p-10 text-center">
                            <Trash2 className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                            <h3 className="mt-3 text-sm font-semibold text-foreground">Recycle Bin is empty</h3>
                            <p className="mt-1 text-sm text-muted-foreground">Deleted items will appear here and can be restored.</p>
                        </div>
                    ) : (
                        <ul className="mt-6 overflow-hidden rounded-xl border border-border bg-card divide-y divide-border">
                            {grouped.map((item) => {
                                const meta = ENTITY_META[item.entity]
                                const Icon = meta.icon
                                const isBusy = busyId === item.id
                                return (
                                    <li key={`${item.entity}-${item.id}`} className="flex items-center gap-4 px-4 py-3">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-foreground truncate">{item.label}</span>
                                                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted rounded px-1.5 py-0.5">{meta.label}</span>
                                            </div>
                                            <p className="text-[12px] text-muted-foreground mt-0.5">
                                                Deleted {formatRelativeTime(item.deleted_at) || "recently"}
                                                {item.deleted_by_name ? ` by ${item.deleted_by_name}` : ""}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Button variant="outline" size="sm" disabled={isBusy} onClick={() => handleRestore(item)} className="h-8 gap-1.5">
                                                {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                                                Restore
                                            </Button>
                                            <Button variant="ghost" size="sm" disabled={isBusy} onClick={() => setPurgeTarget(item)} className="h-8 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10">
                                                <Trash2 className="h-3.5 w-3.5" /> Delete forever
                                            </Button>
                                        </div>
                                    </li>
                                )
                            })}
                        </ul>
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
