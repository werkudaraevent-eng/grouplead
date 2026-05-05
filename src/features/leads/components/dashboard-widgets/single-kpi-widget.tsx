"use client"

import { cn } from "@/lib/utils"

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
    tooltip?: string
    /** Optional sparkline data points (normalized 0-1 range or raw values) */
    sparkline?: number[]
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

export function SingleKPIWidget({ label, value, prefix = "", suffix = "", vsTarget, vsPrev, tooltip, sparkline }: SingleKPIProps) {
    const hasBadge = vsTarget !== null || vsPrev !== null

    // Determine overall status — drives severity border, badge color, sparkline color
    // Only assign status when there's actual comparison data
    const status: "positive" | "neutral" | "negative" = vsTarget !== null
        ? (vsTarget >= 0 ? "positive" : vsTarget >= -20 ? "neutral" : "negative")
        : (vsPrev !== null
            ? (vsPrev >= 0 ? "positive" : vsPrev >= -20 ? "neutral" : "negative")
            : "neutral")

    // Only show severity border when card has comparison data to communicate
    const showSeverity = hasBadge

    return (
        <div
            className={cn(
                "group relative bg-card rounded-xl min-w-0 overflow-hidden",
                "px-3.5 pt-3 pb-2.5 flex flex-col justify-between",
                "cursor-default h-full box-border",
                "transition-all duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
                // Border base
                "border border-border/60",
                // Severity left-border — only when there's data to communicate
                showSeverity && "border-l-[2.5px]",
                showSeverity && status === "positive" && "border-l-[#6EBDA1]",
                showSeverity && status === "negative" && "border-l-[#ED6F22]",
                showSeverity && status === "neutral" && "border-l-border/60",
                // Subtle bg tint for critical
                showSeverity && status === "negative" && "bg-[#ED6F22]/[0.02]",
                // Hover
                "hover:border-border hover:shadow-[0_2px_8px_rgba(0,0,0,.04)]",
                showSeverity && status === "positive" && "hover:border-l-[#6EBDA1]",
                showSeverity && status === "negative" && "hover:border-l-[#ED6F22]",
            )}
            title={tooltip}
        >
            {/* Top row: Label + breathing dot */}
            <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-[10.5px] font-medium text-muted-foreground tracking-wide truncate">
                    {label}
                </span>
                <BreathingDot status={status} />
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
        </div>
    )
}
