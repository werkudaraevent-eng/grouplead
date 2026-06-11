"use client"

import { cn } from "@/lib/utils"
import { Info } from "lucide-react"
import { Tooltip as TooltipPrimitive } from "radix-ui"
import { useId, type ReactNode } from "react"

// Format percentage compactly: "4.6%" for small, "2.6x" for >100%, "86%" for large
function formatCompact(pct: number): string {
    const abs = Math.abs(pct)
    if (abs >= 200) return `${(abs / 100).toFixed(1)}x`
    if (abs >= 100) return `${Math.round(abs)}%`
    if (abs >= 10) return `${Math.round(abs)}%`
    return `${abs.toFixed(1)}%`
}

// Sparkline — soft line + area fill. Renders the 8-point monthly micro-trend
// on the card footer. Colored with the card's brand accent so it reads as
// "this metric's trend", not a separate data series. Needs ≥2 points.
function Sparkline({ data, color }: { data: number[]; color: string }) {
    const rawId = useId()
    const id = rawId.replace(/[^a-zA-Z0-9_-]/g, "")
    const W = 52, H = 22, P = 2
    const max = Math.max(...data, 1)
    const min = Math.min(...data, 0)
    const range = max - min || 1
    const pts = data.map((v, i) => {
        const x = P + (i * (W - 2 * P)) / (data.length - 1)
        const y = H - P - ((v - min) / range) * (H - 2 * P)
        return [Number(x.toFixed(1)), Number(y.toFixed(1))] as const
    })
    const line = pts.map((p) => p.join(",")).join(" ")
    const area = `${line} ${W - P},${H - P} ${P},${H - P}`
    const last = pts[pts.length - 1]
    return (
        <svg
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            className="shrink-0 opacity-90"
            aria-hidden="true"
        >
            <defs>
                <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={color} stopOpacity="0.16" />
                    <stop offset="1" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <polygon points={area} fill={`url(#spark-${id})`} />
            <polyline
                points={line}
                fill="none"
                stroke={color}
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <circle cx={last[0]} cy={last[1]} r="2" fill={color} />
        </svg>
    )
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
    /** Supporting metrics rendered as a small, muted line under the hero
     *  value (e.g. total value + average). Kept low-contrast on purpose so
     *  the eye lands on the hero number first. Omit for single-metric cards
     *  like Lead Conversion. */
    supporting?: { label: string; value: string }[]
    /** When true, a positive delta is treated as bad (red) and negative as
     *  good (green). Use for metrics where "up is worse" — e.g. Lost count. */
    invertDelta?: boolean
}

// Delta pill — a small rounded chip showing the % change with an arrow.
// Color encodes meaning only: green = good, red/orange = bad, gray = flat.
// `tone` is pre-resolved by the caller via the metric's good/bad polarity.
function DeltaPill({ value, note, tone }: { value: number; note: string; tone: "up" | "down" | "flat" }) {
    return (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span
                className={cn(
                    "inline-flex items-center gap-[2px] rounded-full px-2 py-[3px]",
                    "text-[11px] font-bold leading-none tabular-nums",
                    tone === "up" && "bg-[#ECFDF5] text-[#059669]",
                    tone === "down" && "bg-[#FEF2F2] text-[#DC2626]",
                    tone === "flat" && "bg-[#F3F4F6] text-muted-foreground",
                )}
            >
                {tone !== "flat" && (value >= 0 ? "↑" : "↓")}
                {formatCompact(value)}
            </span>
            <span className="text-[10.5px] font-medium text-[#9aa1b0] whitespace-nowrap">{note}</span>
        </span>
    )
}

export function SingleKPIWidget({ label, value, prefix = "", suffix = "", vsTarget, vsPrev, accent, icon: Icon, sparkline, basisLabel, basisInfo, supporting, invertDelta = false }: SingleKPIProps) {
    const hasWarning = !!basisLabel && /hidden|excluded|missing/i.test(basisLabel)

    // `invertDelta` flips the good/bad polarity for "up is worse" metrics
    // (e.g. Lost count). Drives the delta-pill tone.
    const isGood = (v: number) => (invertDelta ? v <= 0 : v >= 0)
    const tone = (v: number): "up" | "down" | "flat" => (v === 0 ? "flat" : isGood(v) ? "up" : "down")

    // Footer is shown whenever there are supporting stats and/or a sparkline.
    const hasSpark = !!sparkline && sparkline.length >= 2
    const hasSupporting = !!supporting && supporting.length > 0
    const hasFooter = hasSupporting || hasSpark

    return (
        <div
            className={cn(
                "group relative bg-card rounded-[20px] min-w-0 overflow-hidden",
                "p-[18px] flex flex-col",
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
            {/* Header — icon (left) + label + info icon (appears on hover).
                Icon tile is tinted with the card's own accent so each metric
                reads at a glance (matches the reference's colored icons). */}
            <div className="flex items-center gap-2.5 mb-3.5">
                <div
                    className="flex items-center justify-center w-[30px] h-[30px] rounded-[9px] shrink-0 transition-colors"
                    style={{ backgroundColor: `${accent}14` }}
                >
                    <Icon className="w-4 h-4" strokeWidth={1.9} style={{ color: accent }} />
                </div>
                <span className="flex-1 min-w-0 text-[12.5px] font-semibold text-muted-foreground truncate leading-tight">
                    {label}
                </span>
                {basisInfo && (
                    <TooltipPrimitive.Provider delayDuration={150}>
                        <TooltipPrimitive.Root>
                            <TooltipPrimitive.Trigger asChild>
                                <button
                                    type="button"
                                    aria-label={`${label} — calculation details`}
                                    className="shrink-0 inline-flex items-center justify-center text-slate-300 hover:text-slate-500 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity cursor-help"
                                >
                                    <Info className="w-3.5 h-3.5" />
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

            {/* Middle zone — grows to fill leftover height and vertically
                centers the hero value, so cards never show a dead gap between
                the value and the footer regardless of how much content each
                metric carries. */}
            <div className="flex-1 flex flex-col justify-center min-w-0">
                {/* Value row — hero number + inline delta pill. The hero font
                    scales with the card width (cqw) and never wraps, so large
                    currency values like "IDR 16.5B" stay on one line and shrink
                    gracefully on zoom / narrow columns. */}
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span
                        className="font-extrabold text-[#10141c] tracking-[-0.025em] leading-none tabular-nums min-w-0 whitespace-nowrap overflow-hidden text-ellipsis"
                        style={{ fontSize: "clamp(19px, 8.5cqw, 28px)" }}
                        title={`${prefix}${value}${suffix}`}
                    >
                        {prefix}{value}{suffix}
                    </span>
                    {vsTarget !== null && (
                        <DeltaPill value={vsTarget} note="vs target" tone={tone(vsTarget)} />
                    )}
                    {vsTarget === null && vsPrev !== null && (
                        <DeltaPill value={vsPrev} note="vs last year" tone={tone(vsPrev)} />
                    )}
                </div>

                {/* Secondary delta — only when BOTH target and yoy exist; kept
                    on a quiet second line so the value row stays uncluttered. */}
                {vsTarget !== null && vsPrev !== null && (
                    <div className="mt-1.5">
                        <DeltaPill value={vsPrev} note="vs last year" tone={tone(vsPrev)} />
                    </div>
                )}

                {/* Basis warning — when some leads are hidden because they lack
                    the required date, surface it inline so the user knows the
                    view is incomplete. The normal basis lives in the ⓘ tooltip. */}
                {hasWarning && (
                    <div className="mt-1.5 text-[9.5px] font-medium text-amber-600 truncate">
                        {basisLabel}
                    </div>
                )}
            </div>

            {/* Footer — divider, then supporting stats (left) + sparkline
                (right). Stats are inline flowing items: each "value label" pair
                stays glued together (whitespace-nowrap) and the row wraps as a
                whole, so on a narrow card the second stat drops to the line
                below instead of getting truncated mid-word. The sparkline sits
                right after with a small gap and auto-hides below 130px. */}
            {hasFooter && (
                <div className="shrink-0 mt-3 pt-3 border-t border-[#F1F2F5] flex items-center gap-2.5">
                    {hasSupporting ? (
                        <div className="flex-1 min-w-0 flex flex-wrap gap-x-3 gap-y-0.5 leading-[1.35] tabular-nums">
                            {supporting!.map((s) => (
                                <span key={s.label} className="inline">
                                    <span className="text-[11px] font-bold text-[#10141c] whitespace-nowrap">{s.value}</span>{" "}
                                    <span className="text-[9.5px] font-normal text-muted-foreground capitalize tracking-[0.01em]">{s.label}</span>
                                </span>
                            ))}
                        </div>
                    ) : (
                        <span className="flex-1 min-w-0" />
                    )}
                    {hasSpark && (
                        <div className="hidden @[130px]:block shrink-0">
                            <Sparkline data={sparkline!} color={accent} />
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
