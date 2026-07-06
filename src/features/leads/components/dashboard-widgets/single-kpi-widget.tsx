"use client"

import { cn } from "@/lib/utils"
import { Info } from "lucide-react"
import { Tooltip as TooltipPrimitive } from "radix-ui"
import { useEffect, useId, useRef, useState, type ReactNode } from "react"

// ─── Density tiers ───────────────────────────────────────────────────────────
// KPI cards live in a resizable grid where the cell height is fixed per row
// span (h*50 + (h-1)*22 px). The card's own content stack has a hard minimum
// (~130px), so at a 2-row span (122px) the footer used to overflow and clip.
// Mirroring how mature dashboards (Zoho, Salesforce) handle shrinking tiles,
// we shed secondary content as the card gets shorter instead of overflowing:
//   • full    (≥185px) — icon + wrapped title + hero value + supporting + spark
//   • compact (140–185px) — drop the sparkline, keep supporting stats
//   • micro   (<140px, ~2-row span) — headline only: icon + title + value,
//                                     tighter padding, title truncates+tooltips
const MICRO_MAX_HEIGHT = 140
const COMPACT_MAX_HEIGHT = 185
type DensityTier = "full" | "compact" | "micro"

function resolveTier(height: number): DensityTier {
    if (height < MICRO_MAX_HEIGHT) return "micro"
    if (height < COMPACT_MAX_HEIGHT) return "compact"
    return "full"
}

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
    /** Optional node rendered at the right edge of the header row (e.g. an
     *  interactive filter dropdown for custom widgets). Sits after the label,
     *  where the ⓘ info button would otherwise be. */
    headerAction?: ReactNode
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- `accentBg` is kept in the props API (callers still pass a per-metric tile color) but the tile is now monochrome, so it's intentionally not read.
export function SingleKPIWidget({ label, value, prefix = "", suffix = "", vsTarget, vsPrev, accent, accentBg, icon: Icon, sparkline, basisLabel, basisInfo, supporting, invertDelta = false, headerAction }: SingleKPIProps) {
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
    // Height-aware density: observe the card's own box height and drop
    // secondary content as it shrinks so the fixed grid cell never clips.
    const cardRef = useRef<HTMLDivElement>(null)
    const [tier, setTier] = useState<DensityTier>("full")
    useEffect(() => {
        const el = cardRef.current
        if (!el) return
        const measure = () => setTier(resolveTier(el.getBoundingClientRect().height))
        measure()
        const obs = new ResizeObserver(measure)
        obs.observe(el)
        return () => obs.disconnect()
    }, [])

    const isMicro = tier === "micro"
    const hasSparkData = !!sparkline && sparkline.length >= 2
    const hasSupportingData = !!supporting && supporting.length > 0
    // Sparkline is the first thing to go (needs the most room); supporting
    // stats survive into compact; micro sheds the whole footer.
    const showSpark = hasSparkData && tier === "full"
    const showSupporting = hasSupportingData && tier !== "micro"
    const hasFooter = showSupporting || showSpark

    // Monochrome icon treatment (Linear / Vercel style): a quiet neutral tile
    // instead of a vivid accent-tinted one. Enterprise dashboards keep the
    // number as the hero and treat the icon as subtle context, not decoration.
    // The card's `accent` is reserved for signals that actually carry meaning
    // — the sparkline trend and the delta pill — not the icon chrome. This also
    // stops N differently-colored tiles from turning a KPI row into confetti.
    const TILE_BG = "#F4F5F7"
    const ICON_COLOR = "#5A6273"

    return (
        <div
            ref={cardRef}
            className={cn(
                "group relative bg-white rounded-[14px] min-w-0 overflow-hidden",
                isMicro ? "px-[13px] pt-[10px] pb-[10px]" : "px-[16px] pt-[15px] pb-[13px]",
                "flex flex-col",
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
            {/* Row 1 — header: icon tile + label + hover info. The icon tile
                shrinks in micro to reclaim width for the title; the label wraps
                to 2 lines when there's vertical room (full/compact) and falls
                back to a single truncated line in micro. `title` always carries
                the full label so a truncated header stays readable on hover. */}
            {/* Info ⓘ — absolutely positioned in the top-right corner so it
                never consumes horizontal space in the header flow. It used to
                sit inline with `shrink-0` and, even while invisible
                (opacity-0), stole ~14px from the title's width. That made two
                identically-named cards truncate differently depending on
                whether one had a tooltip configured (the card 5 vs 6 anomaly).
                Absolute = the title always gets the full header width. */}
            {basisInfo && (
                <TooltipPrimitive.Provider delayDuration={150}>
                    <TooltipPrimitive.Root>
                        <TooltipPrimitive.Trigger asChild>
                            <button
                                type="button"
                                aria-label={`${label} — calculation details`}
                                className="absolute top-[11px] right-[11px] z-20 inline-flex items-center justify-center text-[#9AA1B0] hover:text-[#697080] opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity cursor-help"
                            >
                                <Info className="w-[14px] h-[14px]" />
                            </button>
                        </TooltipPrimitive.Trigger>
                        <TooltipPrimitive.Portal>
                            <TooltipPrimitive.Content
                                side="bottom"
                                align="end"
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

            {/* Row 1 — header: icon tile + label. `headerAction` (custom-widget
                filter) stays in flow when present; the ⓘ button is absolute so
                the title width is identical whether or not a tooltip exists. */}
            <div className={cn("flex gap-[8px]", isMicro ? "items-center mb-[3px]" : "items-start mb-[5px]", basisInfo && !isMicro && "pr-[18px]")}>
                <div
                    className={cn(
                        "flex items-center justify-center rounded-[8px] shrink-0",
                        isMicro ? "w-[26px] h-[26px]" : "w-[30px] h-[30px]",
                    )}
                    style={{ backgroundColor: TILE_BG, border: "1px solid #ECEEF2" }}
                >
                    <Icon className={isMicro ? "w-[14px] h-[14px]" : "w-4 h-4"} strokeWidth={1.9} style={{ color: ICON_COLOR }} />
                </div>
                <span
                    className={cn(
                        "flex-1 min-w-0 text-[12.5px] font-semibold text-[#697080] leading-[1.25]",
                        isMicro ? "truncate self-center" : "line-clamp-2",
                    )}
                    // In full/compact the title may wrap to 2 lines. Reserve
                    // that height on every card so single- and double-line
                    // titles align to the same baseline across a KPI row, and
                    // allow breaking inside long single words so a narrow card
                    // (6-up layout) wraps them instead of clipping mid-word.
                    style={isMicro ? undefined : { overflowWrap: "anywhere", minHeight: "31px" }}
                    title={label}
                >
                    {label}
                </span>
                {headerAction && <div className="shrink-0">{headerAction}</div>}
            </div>

            {/* Row 2 — value (27px/800) + ONE inline delta chip + chip note.
                Font is 27px at normal width but scales down with the card via
                cqw when heavy zoom narrows the column, so the value + wrapping
                footer keep fitting inside the fixed-height cell. */}
            {/* Value + delta stack vertically (flex-col), so the gap between
                the hero value and the "vs target" pill is a single predictable
                vertical distance — controlled purely by `gap-[6px]` — instead
                of the old horizontal-with-wrap layout whose spacing changed
                depending on card width. Adjust the gap value to taste. */}
            <div className="flex-1 flex flex-col items-start justify-center gap-[6px] min-w-0">
                <span
                    className="font-bold text-[#10141C] tracking-[-0.7px] leading-none tabular-nums max-w-full whitespace-nowrap overflow-hidden text-ellipsis"
                    // Cap capped at 27px (was 32) so a long value like
                    // "IDR 910M" no longer towers over short ones like "43" or
                    // "20.9%" — the row reads as one calm, uniform scale. Still
                    // clamps down via cqw on very narrow cards to avoid overflow.
                    style={{ fontSize: "clamp(23px, 12cqw, 27px)" }}
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
                <div className="pt-3 border-t border-[#F1F2F5] flex items-end justify-between gap-3">
                    {showSupporting ? (
                        // Each supporting stat gets its own row (bold value +
                        // muted label), left-aligned. Previously they flowed as
                        // one inline string joined by a dot — when a card was
                        // narrow the second stat wrapped and the dot got
                        // stranded at the start of the next line ("· IDR 520M"),
                        // which read as a messy floating bullet. Discrete rows
                        // are the standard KPI-card treatment (Salesforce/Zoho)
                        // and stay tidy at any width. min-h reserves two rows so
                        // the divider stays level across cards with 1 vs 2 stats.
                        <div className="flex-1 min-w-0 min-h-[37px] flex flex-col justify-end gap-[2px] text-[11.5px] leading-[1.35] text-[#697080] tabular-nums">
                            {supporting!.map((s) => (
                                <div key={s.label} className="flex items-baseline gap-[5px] min-w-0">
                                    <span className="font-bold text-[#10141C] whitespace-nowrap">{s.value}</span>
                                    <span className="font-normal truncate">{s.label}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <span className="flex-1 min-w-0" />
                    )}
                    {/* Sparkline: shown only in full tier AND when the card is
                        wide enough (@[170px]); shed first as the card shrinks. */}
                    {/* Sparkline lives in its own non-shrinking column. The flex
                        `gap-3` is a hard minimum gap that the text can never
                        cross (both are flex items, the spark is shrink-0). When
                        the card gets too narrow to host both — heavy browser
                        zoom — the spark column collapses (container query
                        `@[170px]`) so the stats reclaim the full width, wrap
                        across fewer lines, and stop overflowing the fixed cell.
                        Result: at any zoom the text and spark never collide. */}
                    {showSpark && (
                        <div className="hidden @[170px]:block shrink-0">
                            <Sparkline data={sparkline!} color={accent} />
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
