"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Check, ExternalLink, LayoutDashboard, MapPinned } from "@/components/icons"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { usePermissions } from "@/contexts/permissions-context"
import { AppTransit, type WerkudaraApp } from "@/components/layout/app-transit"

/**
 * Twin of Sales Mission's app/workspace/app-switcher.tsx, with the active app
 * swapped. Keep the two in sync.
 *
 * Choosing the other app is a full navigation to another origin, so the
 * click gets its feedback here, before the browser takes over: the menu
 * closes and the transit screen covers the page until the new document
 * replaces it. The destination draws the same screen first, so the swap is
 * invisible. Modifier clicks (new tab) are left to the browser.
 *
 * Whether this person may open Sales Mission is known only after the
 * browser-side permission read. Until then the row is drawn disabled rather
 * than missing, so a menu opened early does not grow a row a moment later.
 */

/** Sales Activity's address, for this switcher and the phone's More sheet. */
export const salesMissionUrl = process.env.NEXT_PUBLIC_SALES_MISSION_URL?.trim() || null

function LauncherMark() {
    return (
        <span className="grid h-4 w-4 grid-cols-2 gap-[3px]" aria-hidden="true">
            <span className="rounded-[2px] bg-sky-400" />
            <span className="rounded-[2px] bg-violet-400" />
            <span className="rounded-[2px] bg-amber-400" />
            <span className="rounded-[2px] bg-emerald-400" />
        </span>
    )
}

/** Cover the page and go. The overlay is cleared if the page comes back from the back-forward cache. */
export function useAppTransit() {
    const [leaving, setLeaving] = useState<WerkudaraApp | null>(null)
    useEffect(() => {
        const onShow = (event: PageTransitionEvent) => {
            if (event.persisted) setLeaving(null)
        }
        window.addEventListener("pageshow", onShow)
        return () => window.removeEventListener("pageshow", onShow)
    }, [])
    const leaveTo = (app: WerkudaraApp, url: string, event: React.MouseEvent<HTMLAnchorElement>) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
        event.preventDefault()
        setLeaving(app)
        // One frame for the overlay to paint before the document is torn down.
        window.setTimeout(() => window.location.assign(url), 80)
    }
    return { leaving, leaveTo }
}

export function AppSwitcher({ collapsed = false }: { collapsed?: boolean }) {
    const { can, loading } = usePermissions()
    const canOpenSalesMission = !loading && can("sales_mission", "read")
    const [open, setOpen] = useState(false)
    const { leaving, leaveTo } = useAppTransit()

    const salesMissionRow = (
        <>
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-amber-400/15 text-amber-300">
                <MapPinned className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Sales Activity</span>
                <span className="block truncate text-xs text-sidebar-foreground/55">
                    {loading ? "Memeriksa akses…" : salesMissionUrl ? "Rencanakan aktivitas sales dan rekam hasilnya" : "App URL is not configured"}
                </span>
            </span>
        </>
    )

    return (
        <>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sidebar-foreground/60 transition-[background-color,color,transform] duration-150 ease-out hover:bg-sidebar-accent hover:text-sidebar-foreground active:scale-[0.96]"
                        aria-label="Switch Werkudara app"
                    >
                        <LauncherMark />
                    </button>
                </PopoverTrigger>
                <PopoverContent align="start" side={collapsed ? "right" : "bottom"} sideOffset={9} className="w-[318px] rounded-xl border-sidebar-border bg-sidebar p-2 text-sidebar-foreground shadow-xl duration-150">
                    <p className="px-2.5 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-sidebar-foreground/50">
                        Werkudara apps
                    </p>
                    <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg bg-sidebar-accent px-3 py-3 outline-none focus-visible:ring-2 focus-visible:ring-primary">
                        <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/15 text-primary">
                            <LayoutDashboard className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold">LeadEngine</span>
                            <span className="block truncate text-xs text-sidebar-foreground/55">CRM and pipeline operations</span>
                        </span>
                        <Check className="h-4 w-4 text-emerald-400" aria-label="Current app" />
                    </Link>
                    {canOpenSalesMission && salesMissionUrl ? (
                        <a
                            href={salesMissionUrl}
                            onClick={(event) => {
                                setOpen(false)
                                leaveTo("sales-mission", salesMissionUrl, event)
                            }}
                            className="mt-1 flex items-center gap-3 rounded-lg px-3 py-3 outline-none transition-colors duration-150 hover:bg-sidebar-accent focus-visible:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-primary"
                        >
                            {salesMissionRow}
                            <ExternalLink className="h-3.5 w-3.5 text-sidebar-foreground/40" aria-hidden="true" />
                        </a>
                    ) : loading || (canOpenSalesMission && !salesMissionUrl) ? (
                        <div
                            aria-disabled="true"
                            className="mt-1 flex items-center gap-3 rounded-lg px-3 py-3 opacity-60"
                            title={loading ? undefined : "Set NEXT_PUBLIC_SALES_MISSION_URL to enable this app"}
                        >
                            {salesMissionRow}
                        </div>
                    ) : null}
                </PopoverContent>
            </Popover>
            {leaving && createPortal(<AppTransit app={leaving} phase="leaving" />, document.body)}
        </>
    )
}
