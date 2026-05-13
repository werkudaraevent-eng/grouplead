"use client"

import { cn } from "@/lib/utils"

// ─── DESIGN TOKENS ──────────────────────────────────────────────────────────
// ─── Werkudara Brand Palette ────────────────────────────────────────────────
const W = {
    P1: "#02378D", // deep navy (primary)
    P2: "#2069B4", // medium blue
    P3: "#00A1E9", // bright cyan
    P4: "#5EC5F2", // sky blue
    P5: "#C3E6F5", // ice blue
    S1: "#ED6F22", // orange (warning/CTA)
    S2: "#F9BB46", // gold (attention)
    S3: "#6EBDA1", // sage green (success)
    S4: "#292D30", // charcoal
    S5: "#EFEFEF", // light gray
} as const

export const ACCENT = {
    leads: W.P1,
    revenue: W.P3,
    winrate: W.S3,
    conversion: W.P2,
    dealsize: W.S2,
}

export const CHART_COLORS = [
    W.P1, W.P2, W.S3, W.S2, W.S1,
    W.P3, W.P4, '#14b8a6', W.P5, '#06b6d4',
]

export const MONTHS_SHORT = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

// ─── FORMATTERS ─────────────────────────────────────────────────────────────
export function formatPct(value: number) {
    return `${value.toFixed(1)}%`
}

export function formatSignedPct(value: number, suffix = "%") {
    const sign = value > 0 ? "+" : ""
    return `${sign}${value.toFixed(1)}${suffix}`
}

export function getVsLastYearPct(current: number, previous: number) {
    if (previous <= 0) return null
    return ((current - previous) / previous) * 100
}

// ─── SHARED COMPONENTS ──────────────────────────────────────────────────────
export function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={cn(
            "bg-card rounded-xl border-0 shadow-[0_4px_12px_rgba(0,0,0,.06),0_1px_3px_rgba(0,0,0,.04)]",
            "px-[18px] pt-4 pb-3.5 h-full flex flex-col",
            "overflow-y-auto overflow-x-hidden thin-scrollbar",
            "animate-in fade-in duration-300 fill-mode-both",
            className,
        )}>
            {children}
        </div>
    )
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
    return <div className="text-[13px] font-bold text-foreground tracking-tight mb-0.5">{children}</div>
}

export function SectionSub({ children }: { children: React.ReactNode }) {
    return <div className="text-[11px] text-muted-foreground mb-3">{children}</div>
}

export function InsightCallout({ type = "info", text }: { icon?: string; type?: "warning" | "info" | "success"; text: string }) {
    const styles = {
        warning: "border-[#ED6F22]/40 bg-[#ED6F22]/[0.03]",
        info: "border-[#00A1E9]/30 bg-[#00A1E9]/[0.03]",
        success: "border-[#6EBDA1]/40 bg-[#6EBDA1]/[0.03]",
    }
    const dotColor = {
        warning: "bg-[#ED6F22]",
        info: "bg-[#00A1E9]",
        success: "bg-[#6EBDA1]",
    }
    return (
        <div className={cn("mt-2 px-2.5 py-1.5 border-l-2 rounded-r text-[10.5px] text-muted-foreground leading-relaxed line-clamp-2 shrink-0 flex items-start gap-1.5", styles[type])}>
            <div className={cn("w-1.5 h-1.5 rounded-full mt-[4px] shrink-0", dotColor[type])} />
            {text}
        </div>
    )
}

export function DarkTooltip({ active, payload, label, fmt }: any) {
    if (!active || !payload) return null
    const _fmt = fmt ?? ((v: number) => v.toLocaleString())
    const dataPoint = payload[0]?.payload
    const vsLastYear = dataPoint?.vsLastYear ?? null
    return (
        <div className="bg-slate-900 text-white px-3 py-2 rounded-lg text-[11px] leading-relaxed shadow-[0_4px_16px_rgba(0,0,0,.25)] max-w-[260px]">
            <div className="font-bold mb-px">{label}</div>
            {payload.map((p: any, i: number) => (
                <div key={i} className="flex gap-1.5 items-center">
                    <div className="w-1.5 h-1.5 rounded-sm shrink-0" style={{ background: p.color }} />
                    <span>{p.name}: {typeof p.value === 'number' && p.name !== 'Count' ? _fmt(p.value) : p.value}</span>
                </div>
            ))}
            {payload[0]?.payload?.overUnder !== undefined && payload[0].payload.actual > 0 && (
                <div className="mt-0.5 opacity-70">
                    vs Target: <span className={payload[0].payload.overUnder >= 0 ? "text-emerald-300" : "text-red-300"}>
                        {payload[0].payload.overUnder > 0 ? "+" : ""}{payload[0].payload.overUnder.toFixed(1)}%
                    </span>
                </div>
            )}
            {dataPoint?.prevYear !== undefined && (
                <div className="mt-0.5 opacity-70">
                    vs Last Year:{" "}
                    <span className={vsLastYear === null ? "text-slate-300" : vsLastYear >= 0 ? "text-emerald-300" : "text-red-300"}>
                        {vsLastYear === null
                            ? (dataPoint.actual > 0 && dataPoint.prevYear === 0 ? "New" : "N/A")
                            : formatSignedPct(vsLastYear)}
                    </span>
                </div>
            )}
        </div>
    )
}

export function Badge({ value, label }: { value: number | null; label: string }) {
    if (value === null) {
        return (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-muted-foreground bg-muted/50 px-1.5 py-px rounded leading-relaxed">
                <span className="text-[7px]">—</span>
                N/A {label}
            </span>
        )
    }

    const pos = value >= 0
    return (
        <span className={cn(
            "inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-px rounded leading-relaxed",
            pos ? "text-emerald-500 bg-emerald-500/[0.07]" : "text-red-500 bg-red-500/[0.07]",
        )}>
            <span className="text-[7px]">{pos ? "▲" : "▼"}</span>
            {Math.abs(value).toFixed(1)}% {label}
        </span>
    )
}

// ─── RECHARTS TOOLTIP STYLE (inline required by Recharts) ──────────────────
export const TOOLTIP_STYLE: React.CSSProperties = {
    background: "#0f172a", color: "#fff", padding: "8px 11px", borderRadius: 8,
    fontSize: 11, lineHeight: 1.6, boxShadow: "0 4px 16px rgba(0,0,0,.25)",
    maxWidth: 260,
}

// ─── MINI SELECT ───────────────────────────────────────────────────────────
export function MiniSelect({ value, onChange, label, children, className }: {
    value: string | number
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
    label?: string
    children: React.ReactNode
    className?: string
}) {
    return (
        <div>
            {label && <div className="text-[9px] font-semibold text-muted-foreground mb-0.5 tracking-wide">{label}</div>}
            <select
                value={value}
                onChange={onChange}
                className={cn(
                    "appearance-none bg-muted border border-border rounded-[5px]",
                    "px-2 pr-5 py-0.5 text-[11px] font-semibold text-foreground",
                    "cursor-pointer font-[inherit]",
                    "bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20width=%279%27%20height=%279%27%20viewBox=%270%200%2024%2024%27%20fill=%27none%27%20stroke=%27%239ca3af%27%20stroke-width=%272.5%27%3E%3Cpath%20d=%27M6%209l6%206%206-6%27/%3E%3C/svg%3E')]",
                    "bg-no-repeat bg-[position:right_5px_center]",
                    className,
                )}
            >
                {children}
            </select>
        </div>
    )
}

// ─── TOP N TOGGLE ──────────────────────────────────────────────────────────
export function TopNToggle({ value, onChange, total }: { value: number; onChange: (n: number) => void; total: number }) {
    const options = [5, 10]
    if (total > 10) options.push(total)
    // Don't show toggle if total <= 5
    if (total <= 5) return null
    return (
        <div className="flex items-center gap-0.5 bg-muted/60 rounded-md p-0.5">
            {options.map(n => (
                <button
                    key={n}
                    onClick={() => onChange(n)}
                    className={cn(
                        "px-2 py-0.5 text-[9px] font-semibold rounded transition-all",
                        value === n || (n === total && value >= total)
                            ? "bg-white text-[#292D30] shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    {n === total ? "All" : `Top ${n}`}
                </button>
            ))}
        </div>
    )
}

// ─── LOADING PLACEHOLDER ───────────────────────────────────────────────────
export function WidgetSkeleton() {
    return (
        <div className="h-full rounded-lg bg-gradient-to-b from-muted/60 to-muted animate-pulse border border-border/50" />
    )
}

/** Shared Y-axis tick that truncates long labels with ellipsis */
export function EllipsisTick({ x, y, payload, width = 100, fontSize = 10 }: any) {
    const maxChars = Math.floor((width - 8) / (fontSize * 0.52))
    const text = payload?.value ?? ""
    const display = text.length > maxChars ? text.slice(0, maxChars - 1) + "\u2026" : text
    return (
        <g transform={`translate(${x},${y})`}>
            <title>{text}</title>
            <text x={-4} y={0} dy={4} textAnchor="end" fill="#292D30" fontSize={fontSize} fontWeight={500}>
                {display}
            </text>
        </g>
    )
}

/**
 * Sticky numeric x-axis rendered as plain HTML. Use below a scrollable
 * horizontal bar chart so the value scale stays visible while bars scroll.
 *
 * Why not a second Recharts chart: when Bar is marked `hide`, Recharts
 * skips the scale computation and the axis collapses to an empty domain,
 * so ticks never render. Manual HTML ticks with linear interpolation give
 * the same visual result without fighting the chart library.
 *
 * `paddingLeft` must match the YAxis `width` on the chart above so the
 * "0" tick aligns with the left edge of the bars. `paddingRight` matches
 * the chart's right margin.
 */
export function StickyAxis({
    maxValue,
    paddingLeft = 80,
    paddingRight = 12,
    tickCount = 5,
    format,
}: {
    maxValue: number
    paddingLeft?: number
    paddingRight?: number
    tickCount?: number
    format: (value: number) => string
}) {
    // Evenly spaced ticks from 0..maxValue inclusive.
    const ticks = Array.from({ length: tickCount }, (_, i) => (maxValue * i) / (tickCount - 1))
    return (
        <div
            style={{
                width: "100%",
                height: 22,
                flexShrink: 0,
                borderTop: "1px solid #f1f5f9",
                paddingTop: 4,
                marginTop: 2,
                position: "relative",
                boxSizing: "border-box",
            }}
        >
            <div
                style={{
                    position: "absolute",
                    top: 4,
                    left: paddingLeft,
                    right: paddingRight,
                    height: 14,
                }}
            >
                {ticks.map((tick, i) => {
                    const pct = (i / (tickCount - 1)) * 100
                    // End ticks use edge-aligned transforms so they sit inside
                    // the bar area instead of overflowing the container.
                    const transform =
                        i === 0
                            ? "translateX(0)"
                            : i === ticks.length - 1
                                ? "translateX(-100%)"
                                : "translateX(-50%)"
                    return (
                        <span
                            key={i}
                            style={{
                                position: "absolute",
                                left: `${pct}%`,
                                transform,
                                fontSize: 9,
                                color: "#94a3b8",
                                fontWeight: 500,
                                whiteSpace: "nowrap",
                                fontVariantNumeric: "tabular-nums",
                                lineHeight: 1,
                            }}
                        >
                            {format(tick)}
                        </span>
                    )
                })}
            </div>
        </div>
    )
}
