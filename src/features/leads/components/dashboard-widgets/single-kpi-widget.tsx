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
    const W = 68, H = 26, P = 2
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
                    <stop offset="0" stopColor={color} stopOpacity="0.18" />
                    <stop offset="1" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <polygon points={area} fill={`url(#spark-${id})`} />
            <polyline
                points={line}
                fill="none"
                stroke={color}
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <circle cx={last[0]} cy={last[1]} r="2.4" fill={color} />
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
    /** Exact icon-tile background hex from the reference palette (e.g.
     *  "#EEF1FE"). Falls back to the accent at ~8% alpha when omitted. */
    accentBg?: string
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
                    "inline-flex items-center gap-[2px] rounded-[20px] px-2 py-[3px]",
                    "text-[11px] font-bold leading-none tabular-nums",
                    tone === "up" && "bg-[#ECFDF5] text-[#059669]",
                    tone === "down" && "bg-[#FEF2F2] text-[#DC2626]",
                    tone === "flat" && "bg-[#F3F4F6] text-[#697080]",
                )}
            >
                {tone !== "flat" && (value >= 0 ? "↑" : "↓")}
                {formatCompact(value)}
            </span>
            <span className="text-[10.5px] font-medium text-[#9aa1b0] whitespace-nowrap">{note}</span>
        </span>
    )
}

export function SingleKPIWidget({ label, value, prefix = "", suffix = "", vsTarget, vsPrev, accent, accentBg, icon: Icon, sparkline, basisLabel, basisInfo, supporting, invertDelta = false }: SingleKPIProps) {
    const hasWarning = !!basisLabel && /hidden|excluded|missing/i.test(basisLabel)

    // `invertDelta` flips the good/bad polarity for "up is worse" metrics
    // (e.g. Lost count). Drives the delta-pill tone.
    const isGood = (v: number) => (invertDelta ? v <= 0 : v >= 0)
    const tone = (v: number): "up" | "down" | "flat" => (v === 0 ? "flat" : isGood(v) ? "up" : "down")

    // ONE chip in the value row (reference rule). Target is the primary
    // comparison; if there's no target we fall back to the yoy figure.
    const primaryDelta = vsTarget !== null
        ? { value: vsTarget, note: "vs target" }
        : vsPrev !== null
            ? { value: vsPrev, note: "vs last year" }
            : null

    // Footer is shown whenever there are supporting stats and/or a sparkline.
    const hasSpark = !!sparkline && sparkline.length >= 2
    const hasSupporting = !!supporting && supporting.length > 0
    const hasFooter = hasSupporting || hasSpark

    const tileBg = accentBg ?? `${accent}14`

    return (
        <div
            className={cn(
                "group relative bg-white rounded-[14px] min-w-0 overflow-hidden",
                "px-[18px] pt-[18px] pb-[15px] flex flex-col",
                "cursor-default h-full box-border border border-[#E7E9EE]",
                "shadow-[0_1px_2px_rgba(16,20,28,0.05),0_1px_3px_rgba(16,20,28,0.04)]",
                "transition-all duration-[220ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
                // Hover — exact reference shadow + lift
                "hover:shadow-[0_8px_24px_rgba(16,20,28,0.08),0_2px_6px_rgba(16,20,28,0.05)]",
                "hover:-translate-y-[2px]",
            )}
            // Container-query context so the hero value can shrink when the
            // card itself gets narrow (heavy browser zoom narrows the grid
            // columns while the row height stays fixed — without this the
            // value stays 27px, the footer wraps, and the total overflows the
            // fixed cell, clipping the bottom stats).
            style={{ containerType: "inline-size" }}
        >
            {/* Row 1 — header: 30×30 icon tile + label (12.5px/600) + hover info */}
            <div className="flex items-center gap-[9px] mb-[15px]">
                <div
                    className="flex items-center justify-center w-[30px] h-[30px] rounded-[8px] shrink-0"
                    style={{ backgroundColor: tileBg }}
                >
                    <Icon className="w-4 h-4" strokeWidth={1.9} style={{ color: accent }} />
                </div>
                <span className="flex-1 min-w-0 text-[12.5px] font-semibold text-[#697080] truncate leading-[1.2]">
                    {label}
                </span>
                {basisInfo && (
                    <TooltipPrimitive.Provider delayDuration={150}>
                        <TooltipPrimitive.Root>
                            <TooltipPrimitive.Trigger asChild>
                                <button
                                    type="button"
                                    aria-label={`${label} — calculation details`}
                                    className="shrink-0 inline-flex items-center justify-center text-[#9AA1B0] hover:text-[#697080] opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity cursor-help"
                                >
                                    <Info className="w-[14px] h-[14px]" />
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

            {/* Row 2 — value (27px/800) + ONE inline delta chip + chip note.
                Font is 27px at normal width but scales down with the card via
                cqw when heavy zoom narrows the column, so the value + wrapping
                footer keep fitting inside the fixed-height cell. */}
            <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span
                    className="font-extrabold text-[#10141C] tracking-[-0.7px] leading-none tabular-nums min-w-0 whitespace-nowrap overflow-hidden text-ellipsis"
                    style={{ fontSize: "clamp(17px, 12.5cqw, 27px)" }}
                    title={`${prefix}${value}${suffix}`}
                >
                    {prefix}{value}{suffix}
                </span>
                {primaryDelta && (
                    <DeltaPill value={primaryDelta.value} note={primaryDelta.note} tone={tone(primaryDelta.value)} />
                )}
            </div>

            {/* Basis warning — only when data is excluded. Sits quietly under
                the value; the normal date basis lives in the ⓘ tooltip. */}
            {hasWarning && (
                <div className="mt-1.5 text-[9.5px] font-medium text-amber-600 truncate">
                    {basisLabel}
                </div>
            )}

            {/* Row 3 — footer: ONE dotted stats line (left) + sparkline (right).
                Pushed to the card bottom via mt-auto so all 5 cards share the
                same footer baseline. The stats line does NOT truncate: like the
                reference, it flows as inline text (line-height 1.6) and wraps to
                2–3 rows when the card narrows (e.g. on zoom-in) so the numbers
                stay readable instead of colliding with / hiding behind the
                sparkline. Each value stays glued (whitespace-nowrap) so numbers
                never break mid-figure; the sparkline is shrink-0 on the right. */}
            {hasFooter && (
                <div className="mt-auto pt-3 border-t border-[#F1F2F5] flex items-end justify-between gap-3">
                    {hasSupporting ? (
                        <div className="flex-1 min-w-0 text-[11.5px] leading-[1.6] text-[#697080] tabular-nums">
                            {supporting!.map((s, i) => (
                                <span key={s.label}>
                                    {i > 0 && (
                                        <span className="inline-block w-[3px] h-[3px] rounded-full bg-[#C9CDD6] mx-[6px] align-middle" />
                                    )}
                                    <span className="font-bold text-[#10141C] whitespace-nowrap">{s.value}</span>{" "}
                                    <span className="font-normal">{s.label}</span>
                                </span>
                            ))}
                        </div>
                    ) : (
                        <span className="flex-1 min-w-0" />
                    )}
                    {/* Sparkline lives in its own non-shrinking column. The flex
                        `gap-3` is a hard minimum gap that the text can never
                        cross (both are flex items, the spark is shrink-0). When
                        the card gets too narrow to host both — heavy browser
                        zoom — the spark column collapses (container query
                        `@[170px]`) so the stats reclaim the full width, wrap
                        across fewer lines, and stop overflowing the fixed cell.
                        Result: at any zoom the text and spark never collide. */}
                    {hasSpark && (
                        <div className="hidden @[170px]:block shrink-0">
                            <Sparkline data={sparkline!} color={accent} />
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
