"use client"

import { cn } from "@/lib/utils"
import { Info } from "lucide-react"
import { Tooltip as TooltipPrimitive } from "radix-ui"
import type { ReactNode } from "react"

// Format percentage compactly: "4.6%" for small, "2.6x" for >100%, "86%" for large
function formatCompact(pct: number): string {
    const abs = Math.abs(pct)
    if (abs >= 200) return `${(abs / 100).toFixed(1)}x`
    if (abs >= 100) return `${Math.round(abs)}%`
    if (abs >= 10) return `${Math.round(abs)}%`
    return `${abs.toFixed(1)}%`
}

export interface SingleKPIProps {
    label: string
    value: string
    prefix?: string
    suffix?: string
    vsTarget: number | null
    vsPrev: number | null
    accent: string
    icon: React.ComponentType<any>
    /** Optional sparkline data points (normalized 0-1 range or raw values) */
    sparkline?: number[]
    /** Layer 1 — micro-meta line at the bottom of the card describing
     *  which date basis the metric uses. Always visible. e.g. "by received date".
     *  When the string contains "hidden" we render it amber to call out
     *  excluded data (e.g. Pipeline Value missing target_close_date). */
    basisLabel?: string
    /** Layer 2 — rich tooltip content shown on the small ⓘ icon next to
     *  the label. Use to explain the formula, basis, and rationale. */
    basisInfo?: ReactNode
}

export function SingleKPIWidget({ label, value, prefix = "", suffix = "", vsTarget, vsPrev, icon: Icon, basisLabel, basisInfo }: SingleKPIProps) {
    const hasBadge = vsTarget !== null || vsPrev !== null
    const hasWarning = !!basisLabel && /hidden|excluded|missing/i.test(basisLabel)

    // Determine overall status — drives badge color, sparkline color
    const status: "positive" | "neutral" | "negative" = vsTarget !== null
        ? (vsTarget >= 0 ? "positive" : vsTarget >= -20 ? "neutral" : "negative")
        : (vsPrev !== null
            ? (vsPrev >= 0 ? "positive" : vsPrev >= -20 ? "neutral" : "negative")
            : "neutral")

    return (
        <div
            className={cn(
                "group relative bg-card rounded-[20px] min-w-0 overflow-hidden",
                "px-5 pt-4 pb-4 flex flex-col justify-between",
                "cursor-default h-full box-border border-0",
                "shadow-[0_1px_3px_rgba(16,24,40,0.03),0_6px_20px_-8px_rgba(16,24,40,0.06)]",
                "transition-all duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
                // Hover
                "hover:shadow-[0_2px_6px_rgba(16,24,40,0.04),0_10px_28px_-10px_rgba(16,24,40,0.10)]",
                "hover:-translate-y-[1px]",
            )}
            // Establish a container-query context so the hero value can scale
            // with the card's own width (handles browser zoom / narrow grid
            // columns) instead of wrapping to a second line.
            style={{ containerType: "inline-size" }}
        >
            {/* Top row: Label (+ optional info icon) + Icon */}
            <div className="flex items-center justify-between gap-1 mb-1.5">
                <div className="flex items-center gap-1 min-w-0">
                    <span className="text-[12px] font-medium text-muted-foreground truncate">
                        {label}
                    </span>
                    {basisInfo && (
                        <TooltipPrimitive.Provider delayDuration={150}>
                            <TooltipPrimitive.Root>
                                <TooltipPrimitive.Trigger asChild>
                                    <button
                                        type="button"
                                        aria-label={`${label} — calculation details`}
                                        className="shrink-0 inline-flex items-center justify-center text-slate-300 hover:text-slate-500 transition-colors cursor-help"
                                    >
                                        <Info className="w-3 h-3" />
                                    </button>
                                </TooltipPrimitive.Trigger>
                                <TooltipPrimitive.Portal>
                                    <TooltipPrimitive.Content
                                        side="bottom"
                                        align="start"
                                        sideOffset={6}
                                        className={cn(
                                            "z-50 max-w-[280px] p-3 text-[11px] leading-snug",
                                            "bg-slate-900 text-white rounded-lg shadow-xl",
                                            "animate-in fade-in-0 zoom-in-95",
                                            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
                                        )}
                                    >
                                        {basisInfo}
                                        <TooltipPrimitive.Arrow className="fill-slate-900" width={10} height={5} />
                                    </TooltipPrimitive.Content>
                                </TooltipPrimitive.Portal>
                            </TooltipPrimitive.Root>
                        </TooltipPrimitive.Provider>
                    )}
                </div>
                <div className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0 bg-[#02378D]/[0.06] group-hover:bg-[#02378D]/[0.10] transition-colors">
                    <Icon className="w-[18px] h-[18px] text-[#02378D]" strokeWidth={1.75} />
                </div>
            </div>

            {/* Value — the hero. Font scales with the card width (cqw) and
                never wraps, so large currency values like "IDR 16.5B" stay on
                one line and shrink gracefully on zoom / narrow columns instead
                of breaking to two rows. leading-tight (not none) keeps glyph
                ascenders from being clipped by the card's overflow-hidden. */}
            <div
                className="font-bold text-[#1a2230] tracking-[-0.02em] leading-tight tabular-nums min-w-0 mt-1 whitespace-nowrap overflow-hidden text-ellipsis"
                style={{ fontSize: "clamp(16px, 8.5cqw, 26px)" }}
                title={`${prefix}${value}${suffix}`}
            >
                {prefix}{value}{suffix}
            </div>

            {/* Status line — single row, inline badges separated by dot.
                Green/red delta stays on the card face (key signal); the
                date-basis micro-meta moved into the ⓘ tooltip to reduce noise. */}
            {hasBadge ? (
                <div className="flex items-center gap-1.5 mt-2.5 text-[11px] leading-none tabular-nums">
                    {vsTarget !== null && (
                        <span className={cn(
                            "inline-flex items-center gap-[3px] font-semibold whitespace-nowrap",
                            status === "positive" && "text-[#3d7a5c]",
                            status === "neutral" && "text-[#64748b]",
                            status === "negative" && "text-[#b84a1c]",
                        )}>
                            {vsTarget >= 0 ? "↑" : "↓"}{formatCompact(vsTarget)}
                            <span className="font-normal text-muted-foreground">target</span>
                        </span>
                    )}
                    {vsTarget !== null && vsPrev !== null && (
                        <span className="text-border">·</span>
                    )}
                    {vsPrev !== null && (
                        <span className={cn(
                            "inline-flex items-center gap-[3px] font-semibold whitespace-nowrap",
                            vsPrev >= 0 ? "text-[#3d7a5c]" : "text-[#b84a1c]",
                        )}>
                            {vsPrev >= 0 ? "↑" : "↓"}{formatCompact(vsPrev)}
                            <span className="font-normal text-muted-foreground">yoy</span>
                        </span>
                    )}
                </div>
            ) : !hasWarning ? (
                /* Empty spacer — maintains card height consistency only when
                   there's neither a badge nor a warning line to occupy it.
                   (Pipeline Value has a warning but no badge, so rendering both
                   the spacer AND the warning overflowed the card and clipped
                   the hero number.) */
                <div className="mt-2.5 h-[14px]" />
            ) : null}

            {/* Basis warning only — when some leads are hidden because they
                lack the required date, surface it inline so the user knows
                their view is incomplete. The normal date-basis label now
                lives in the ⓘ tooltip to keep the card calm. */}
            {hasWarning && (
                <div className="mt-1.5 text-[9.5px] font-medium text-amber-600 truncate">
                    {basisLabel}
                </div>
            )}
        </div>
    )
}
