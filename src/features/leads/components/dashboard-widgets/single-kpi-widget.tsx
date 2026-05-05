"use client"

import { cn } from "@/lib/utils"

export interface SingleKPIProps {
    label: string
    value: string
    prefix?: string
    suffix?: string
    vsTarget: number | null
    vsPrev: number | null
    accent: string
    icon: React.ComponentType<any>
    tooltip?: string
}

export function SingleKPIWidget({ label, value, prefix = "", suffix = "", vsTarget, vsPrev, tooltip }: SingleKPIProps) {
    const hasBadge = vsTarget !== null || vsPrev !== null

    // Determine overall status for subtle background tint
    const status = vsTarget !== null
        ? (vsTarget >= 0 ? "positive" : vsTarget >= -20 ? "neutral" : "negative")
        : "neutral"

    return (
        <div
            className={cn(
                "group bg-card rounded-xl border border-border/60",
                "px-3.5 pt-3 pb-2.5 flex flex-col justify-between min-w-0",
                "cursor-default h-full box-border",
                "transition-all duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
                "hover:border-border hover:shadow-[0_2px_8px_rgba(0,0,0,.04)]",
            )}
            title={tooltip}
        >
            {/* Label */}
            <span className="text-[10.5px] font-medium text-muted-foreground tracking-wide truncate mb-1">
                {label}
            </span>

            {/* Value — the hero */}
            <div className="text-[22px] font-bold text-[#292D30] tracking-tight leading-none truncate tabular-nums">
                {prefix}{value}{suffix}
            </div>

            {/* Status badge — only show when there's data to communicate */}
            {hasBadge ? (
                <div className="flex items-center gap-2 mt-1.5">
                    {vsTarget !== null && (
                        <span className={cn(
                            "inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded",
                            status === "positive" && "text-[#3d7a5c] bg-[#6EBDA1]/10",
                            status === "neutral" && "text-[#292D30] bg-[#292D30]/5",
                            status === "negative" && "text-[#b84a1c] bg-[#ED6F22]/10",
                        )}>
                            <span className="text-[8px]">{vsTarget >= 0 ? "▲" : "▼"}</span>
                            {Math.abs(vsTarget).toFixed(1)}% vs target
                        </span>
                    )}
                    {vsPrev !== null && (
                        <span className={cn(
                            "inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded",
                            vsPrev >= 0 ? "text-[#3d7a5c] bg-[#6EBDA1]/8" : "text-[#b84a1c] bg-[#ED6F22]/8",
                        )}>
                            <span className="text-[8px]">{vsPrev >= 0 ? "▲" : "▼"}</span>
                            {Math.abs(vsPrev).toFixed(0)}% YoY
                        </span>
                    )}
                </div>
            ) : (
                /* Empty spacer — maintains card height consistency without showing "no data" text */
                <div className="mt-1.5 h-[18px]" />
            )}
        </div>
    )
}
