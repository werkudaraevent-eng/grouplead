"use client"

import Link from "next/link"
import { Check, ExternalLink, LayoutDashboard, MapPinned } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { usePermissions } from "@/contexts/permissions-context"

const salesMissionUrl = process.env.NEXT_PUBLIC_SALES_MISSION_URL?.trim() || null

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

export function AppSwitcher({ collapsed = false }: { collapsed?: boolean }) {
    const { can, loading } = usePermissions()
    const canOpenSalesMission = !loading && can("sales_mission", "read")

    return (
        <Popover>
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
                <Link href="/" className="flex items-center gap-3 rounded-lg bg-sidebar-accent px-3 py-3 outline-none focus-visible:ring-2 focus-visible:ring-primary">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/15 text-primary">
                        <LayoutDashboard className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">LeadEngine</span>
                        <span className="block truncate text-xs text-sidebar-foreground/55">CRM and pipeline operations</span>
                    </span>
                    <Check className="h-4 w-4 text-emerald-400" aria-label="Current app" />
                </Link>
                {canOpenSalesMission && salesMissionUrl && (
                    <a href={salesMissionUrl} className="mt-1 flex items-center gap-3 rounded-lg px-3 py-3 outline-none transition-colors duration-150 hover:bg-sidebar-accent focus-visible:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-primary">
                        <span className="grid h-9 w-9 place-items-center rounded-lg bg-amber-400/15 text-amber-300">
                            <MapPinned className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold">Sales Mission</span>
                            <span className="block truncate text-xs text-sidebar-foreground/55">Plan visits and capture results</span>
                        </span>
                        <ExternalLink className="h-3.5 w-3.5 text-sidebar-foreground/40" aria-hidden="true" />
                    </a>
                )}
                {canOpenSalesMission && !salesMissionUrl && (
                    <div className="mt-1 flex items-center gap-3 rounded-lg px-3 py-3 opacity-60" title="Set NEXT_PUBLIC_SALES_MISSION_URL to enable this app">
                        <span className="grid h-9 w-9 place-items-center rounded-lg bg-amber-400/15 text-amber-300"><MapPinned className="h-4 w-4" /></span>
                        <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Sales Mission</span><span className="block truncate text-xs text-sidebar-foreground/55">App URL is not configured</span></span>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    )
}
