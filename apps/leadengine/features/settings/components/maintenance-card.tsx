"use client"

import { useState } from "react"
import { Wrench, ShieldAlert, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toggleMaintenanceAction } from "@/app/actions/maintenance-actions"

interface MaintenanceCardProps {
    initialEnabled: boolean
    initialMessage: string | null
}

/**
 * Super-admin-only control to toggle global maintenance mode (full lockdown).
 * Render this only when the current user is super_admin.
 */
export function MaintenanceCard({ initialEnabled, initialMessage }: MaintenanceCardProps) {
    const [enabled, setEnabled] = useState(initialEnabled)
    const [message, setMessage] = useState(initialMessage ?? "")
    const [saving, setSaving] = useState(false)
    const [confirmOpen, setConfirmOpen] = useState(false)

    const persist = async (next: boolean) => {
        setSaving(true)
        const result = await toggleMaintenanceAction(next, message)
        setSaving(false)
        if (!result.success) {
            toast.error(result.error || "Failed to update maintenance mode")
            return
        }
        setEnabled(next)
        toast.success(next ? "Maintenance mode enabled" : "Maintenance mode disabled")
    }

    const handleToggle = (next: boolean) => {
        // Enabling is destructive (locks everyone out) → confirm first.
        if (next) { setConfirmOpen(true); return }
        void persist(false)
    }

    const handleSaveMessage = async () => {
        setSaving(true)
        const result = await toggleMaintenanceAction(enabled, message)
        setSaving(false)
        if (!result.success) {
            toast.error(result.error || "Failed to save message")
            return
        }
        toast.success("Maintenance message saved")
    }

    return (
        <section className="mt-10">
            <div className="px-1">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Platform
                </h2>
            </div>
            <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card">
                <div className="flex items-start gap-4 px-4 py-4">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${enabled ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"}`}>
                        <Wrench className="h-4.5 w-4.5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <h3 className="text-sm font-semibold text-foreground">Maintenance mode</h3>
                                <p className="mt-0.5 text-[13px] text-muted-foreground">
                                    Lock the platform for everyone except Super Admins. Use during deploys or incidents.
                                </p>
                            </div>
                            <Switch checked={enabled} disabled={saving} onCheckedChange={handleToggle} aria-label="Toggle maintenance mode" />
                        </div>

                        {enabled && (
                            <div className="mt-3 flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                                <ShieldAlert className="h-4 w-4 shrink-0" />
                                Maintenance is ON. All non-super-admin users are being redirected to the maintenance page.
                            </div>
                        )}

                        <div className="mt-3">
                            <label className="text-[12px] font-medium text-foreground">Message shown to users</label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                rows={2}
                                placeholder="LeadEngine is undergoing maintenance. We'll be back shortly."
                                className="mt-1.5 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary/50"
                            />
                            <div className="mt-2 flex justify-end">
                                <button
                                    type="button"
                                    onClick={handleSaveMessage}
                                    disabled={saving}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-[12px] font-semibold text-secondary-foreground hover:bg-secondary/80 disabled:opacity-60"
                                >
                                    {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                    Save message
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Enable maintenance mode?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Every user except Super Admins will be signed out of the app and shown the
                            maintenance page. They will be redirected automatically within about a minute.
                            You can turn this off at any time.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={saving}
                            onClick={(e) => { e.preventDefault(); setConfirmOpen(false); void persist(true) }}
                        >
                            Enable maintenance
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </section>
    )
}
