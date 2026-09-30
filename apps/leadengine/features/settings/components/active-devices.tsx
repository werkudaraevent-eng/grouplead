"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Info, Laptop, Loader2, MonitorSmartphone, RefreshCw, Smartphone, Tablet } from "@/components/icons"
import { deviceErrorMessage, toDeviceViews, type DeviceRow, type DeviceView } from "@/lib/devices/device-display"
import type { DeviceKind } from "@/lib/devices/user-agent"

/**
 * Settings › Account › Active devices: every device where this account is
 * signed in, in LeadEngine and Sales Activity alike (one sign-in covers
 * both). This device first, marked; each other one can be signed out on its
 * own, or all of them at once. Signing a device out cannot be undone from
 * here (that device has to sign in again), so it is confirmed, and the
 * dialog says what is lost there.
 *
 * The page's body, and the header's one action: `header` receives "Sign out
 * of all other devices" (or null when there are none) to place in the
 * page's header on a desk; on a phone the same button sits under the list,
 * full width, where the thumb is (one door each). The same anatomy as
 * Sales Activity's Perangkat aktif, row for row.
 *
 * Reads and writes go straight to the database functions under the
 * person's own session (`fn_list_my_devices`, `fn_sign_out_device`,
 * `fn_sign_out_other_devices`), which act on the caller's sessions only.
 */

const KIND_ICON: Record<DeviceKind, typeof Laptop> = {
    desktop: Laptop,
    phone: Smartphone,
    tablet: Tablet,
    unknown: MonitorSmartphone,
}

/** The error role as a text button, M3's text button in the error colour. */
const DANGER_TEXT = "text-[var(--danger-foreground)] hover:bg-[var(--danger)] hover:text-[var(--danger-foreground)]"

type Confirm = { kind: "one"; device: DeviceView } | { kind: "others"; count: number }

export function ActiveDevices({ header }: { header: (action: React.ReactNode | null) => React.ReactNode }) {
    const [rows, setRows] = useState<DeviceRow[] | null>(null)
    const [failed, setFailed] = useState(false)
    const [confirm, setConfirm] = useState<Confirm | null>(null)
    const [pending, setPending] = useState(false)
    const [now, setNow] = useState(() => new Date())

    /** The list, or null when it could not be read. */
    const fetchRows = useCallback(async (): Promise<DeviceRow[] | null> => {
        const { data, error } = await createClient().rpc("fn_list_my_devices")
        return error ? null : ((data ?? []) as DeviceRow[])
    }, [])

    const apply = useCallback((next: DeviceRow[] | null) => {
        setFailed(next === null)
        setNow(new Date())
        setRows(next ?? [])
    }, [])

    const load = useCallback(() => fetchRows().then(apply), [fetchRows, apply])

    useEffect(() => {
        let active = true
        fetchRows().then((next) => {
            if (active) apply(next)
        })
        return () => { active = false }
    }, [fetchRows, apply])

    const devices = useMemo(() => toDeviceViews(rows ?? [], now), [rows, now])
    const others = devices.filter((device) => !device.isCurrent).length

    const run = async () => {
        if (!confirm) return
        setPending(true)
        const supabase = createClient()
        if (confirm.kind === "one") {
            const { error } = await supabase.rpc("fn_sign_out_device", { p_session_id: confirm.device.sessionId })
            if (error) toast.error(deviceErrorMessage(error.message))
            else toast.success(`${confirm.device.name} is signed out`)
        } else {
            const { data, error } = await supabase.rpc("fn_sign_out_other_devices")
            if (error) toast.error(deviceErrorMessage(error.message))
            else {
                const ended = typeof data === "number" ? data : 0
                toast.success(ended === 1 ? "1 other device is signed out" : `${ended} other devices are signed out`)
            }
        }
        setPending(false)
        setConfirm(null)
        load()
    }

    const signOutOthers = (className?: string) => (
        <Button variant="outline" size="sm" className={className} onClick={() => setConfirm({ kind: "others", count: others })}>
            Sign out of all other devices
        </Button>
    )

    return (
        <>
            {header(others > 0 ? signOutOthers() : null)}

            <div className="space-y-4 px-4 pb-10 sm:px-6 lg:px-8">
                <div className="overflow-hidden rounded-xl border bg-card">
                    {rows === null ? (
                        <div className="flex items-center gap-2 px-5 py-6 text-sm text-muted-foreground" role="status">
                            <Loader2 className="h-4 w-4 animate-spin" /> Loading devices…
                        </div>
                    ) : failed ? (
                        <div className="px-5 py-6 text-sm" role="alert">
                            <p className="font-semibold text-foreground">Your devices could not be loaded right now.</p>
                            <p className="mt-1 text-muted-foreground">You stay signed in as before. Try again in a moment.</p>
                            <Button variant="outline" size="sm" className="mt-4" onClick={() => { setRows(null); load() }}>
                                <RefreshCw className="h-4 w-4" /> Try again
                            </Button>
                        </div>
                    ) : devices.length === 0 ? (
                        <p className="px-5 py-6 text-sm text-muted-foreground" role="status">
                            No devices recorded yet. A device shows here once it opens Group Lead or Sales Activity.
                        </p>
                    ) : (
                        <ul className="divide-y" aria-label="Signed-in devices">
                            {devices.map((device) => {
                                const Icon = KIND_ICON[device.kind]
                                return (
                                    <li key={device.sessionId} className="flex min-h-[72px] items-center gap-4 px-4 py-3 sm:px-5">
                                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground" aria-hidden="true">
                                            <Icon className="h-5 w-5" />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                <span className="min-w-0 break-words text-sm font-semibold text-foreground">{device.name}</span>
                                                {device.isCurrent && (
                                                    <span className="inline-flex h-6 items-center rounded-md bg-[var(--success)] px-2 text-xs font-medium text-[var(--success-foreground)]">
                                                        This device
                                                    </span>
                                                )}
                                            </p>
                                            {device.meta && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{device.meta}</p>}
                                        </div>
                                        {!device.isCurrent && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className={`shrink-0 font-semibold ${DANGER_TEXT}`}
                                                onClick={() => setConfirm({ kind: "one", device })}
                                                aria-label={`Sign out ${device.name}`}
                                            >
                                                Sign out
                                            </Button>
                                        )}
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </div>

                {/* On a phone the page's action sits under the list, full
                    width, where the thumb is; on a desk it is the header's. */}
                {others > 0 && <div className="lg:hidden">{signOutOthers("w-full")}</div>}

                <p className="flex items-start gap-2 px-1 text-xs leading-relaxed text-muted-foreground">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Don&apos;t recognise a device? Sign it out, then change your password in Profile. Devices idle for 30 days sign out on their own.
                </p>
            </div>

            <AlertDialog open={confirm !== null} onOpenChange={(open) => { if (!open && !pending) setConfirm(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {confirm?.kind === "one"
                                ? `Sign out ${confirm.device.name}?`
                                : `Sign out of ${confirm?.count === 1 ? "1 other device" : `${confirm?.count ?? 0} other devices`}?`}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirm?.kind === "one"
                                ? "That device leaves Group Lead and Sales Activity at once. Anything not yet saved there is lost. Its owner can sign in again with the password."
                                : "Every other device leaves Group Lead and Sales Activity at once; this one stays signed in. Anything not yet saved there is lost. They can sign in again with the password."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={pending}
                            onClick={(event) => { event.preventDefault(); run() }}
                            variant="destructive"
                        >
                            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                            {confirm?.kind === "one" ? "Sign out" : "Sign out all"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
