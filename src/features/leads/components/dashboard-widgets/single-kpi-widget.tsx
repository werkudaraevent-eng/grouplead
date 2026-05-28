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

// ─── SPARKLINE ──────────────────────────────────────────────────────────────
// Minimal SVG sparkline — no axis, no labels, just direction & momentum
// Renders full-width below the value so it never competes for horizontal space
function MiniSparkline({ data, status }: { data: number[]; status: "positive" | "neutral" | "negative" }) {
    if (data.length < 2) return null

    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1

    const w = 64
    const h = 14
    const padding = 2

    const points = data.map((v, i) => {
        const x = padding + (i / (data.length - 1)) * (w - padding * 2)
        const y = h - padding - ((v - min) / range) * (h - padding * 2)
        return `${x},${y}`
    })

    const strokeColor =
        status === "positive" ? "#6EBDA1"
            : status === "negative" ? "#ED6F22"
                : "#94a3b8"

    return (
        <svg
            width="100%"
            height={h}
            viewBox={`0 0 ${w} ${h}`}
            preserveAspectRatio="none"
            fill="none"
            className="opacity-50 group-hover:opacity-80 transition-opacity duration-300"
        >
            <polyline
                points={points.join(" ")}
                stroke={strokeColor}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
            />
            {/* End dot — current value indicator */}
            <circle
                cx={points[points.length - 1].split(",")[0]}
                cy={points[points.length - 1].split(",")[1]}
                r="1.5"
                fill={strokeColor}
            />
        </svg>
    )
}

// ─── BREATHING DOT ──────────────────────────────────────────────────────────
// Subtle pulse for critical state — draws management eye without being alarming
function BreathingDot({ status }: { status: "positive" | "neutral" | "negative" }) {
    if (status !== "negative") return null
    return (
        <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ED6F22]/40" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ED6F22]/80" />
        </span>
    )
}

export function SingleKPIWidget({ label, value, prefix = "", suffix = "", vsTarget, vsPrev, accent, icon: Icon, sparkline, basisLabel, basisInfo }: SingleKPIProps) {
    const hasBadge = vsTarget !== null || vsPrev !== null

    // Determine overall status — drives badge color, sparkline color
    const status: "positive" | "neutral" | "negative" = vsTarget !== null
        ? (vsTarget >= 0 ? "positive" : vsTarget >= -20 ? "neutral" : "negative")
        : (vsPrev !== null
            ? (vsPrev >= 0 ? "positive" : vsPrev >= -20 ? "neutral" : "negative")
            : "neutral")

    return (
        <div
            className={cn(
                "group relative bg-card rounded-xl min-w-0 overflow-hidden",
                "px-3.5 pt-3 pb-2.5 flex flex-col justify-between",
                "cursor-default h-full box-border",
                "shadow-[0_4px_12px_rgba(0,0,0,.06),0_1px_3px_rgba(0,0,0,.04)]",
                "transition-all duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
                "border-0",
                // Hover
                "hover:shadow-[0_6px_16px_rgba(0,0,0,.08),0_2px_6px_rgba(0,0,0,.04)]",
                "hover:-translate-y-[1px]",
            )}
        >
            {/* Top row: Label (+ optional info icon) + Icon */}
            <div className="flex items-center justify-between gap-1 mb-1">
                <div className="flex items-center gap-1 min-w-0">
                    <span className="text-[10.5px] font-medium text-muted-foreground tracking-wide truncate">
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
                <div
                    className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0 opacity-80 group-hover:opacity-100 transition-opacity"
                    style={{ backgroundColor: `${accent}14` }}
                >
                    <Icon className="w-3.5 h-3.5" style={{ color: accent }} />
                </div>
            </div>

            {/* Value — the hero (never truncated, full width) */}
            <div className="text-[22px] font-bold text-[#292D30] tracking-tight leading-none tabular-nums min-w-0">
                {prefix}{value}{suffix}
            </div>

            {/* Sparkline — subtle trend line below value */}
            {sparkline && sparkline.length >= 2 && (
                <div className="mt-1 h-3.5 w-full max-w-[64px]">
                    <MiniSparkline data={sparkline} status={status} />
                </div>
            )}

            {/* Status line — single row, inline badges separated by dot */}
            {hasBadge ? (
                <div className="flex items-center gap-1.5 mt-2 text-[10.5px] leading-none tabular-nums">
                    {vsTarget !== null && (
                        <span className={cn(
                            "inline-flex items-center gap-[3px] font-semibold whitespace-nowrap",
                            status === "positive" && "text-[#3d7a5c]",
                            status === "neutral" && "text-[#555]",
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
            ) : (
                /* Empty spacer — maintains card height consistency */
                <div className="mt-2 h-[14px]" />
            )}

            {/* Layer 1 — basis micro-meta. Always-visible truth-in-labelling
                so the user knows which date the metric is bucketed by.
                Renders amber when the label carries a warning (e.g. when
                some leads are hidden because they lack the required
                date) so the user notices without an extra row. */}
            {basisLabel && (
                <div className={cn(
                    "mt-1 text-[9px] uppercase tracking-wider font-medium truncate",
                    /hidden|excluded|missing/i.test(basisLabel)
                        ? "text-amber-700"
                        : "text-slate-400",
                )}>
                    {basisLabel}
                </div>
            )}
        </div>
    )
}
