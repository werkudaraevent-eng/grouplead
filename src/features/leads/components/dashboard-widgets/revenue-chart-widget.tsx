"use client"

import {
    ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, ResponsiveContainer, Legend, LabelList, Cell,
} from "recharts"
import { useCurrency } from "@/contexts/currency-context"
import { SectionCard, SectionTitle, SectionSub, DarkTooltip, MiniSelect, WidgetSkeleton } from "./shared"

export type RevenueBasis = "revenue_recognition" | "closed_won"

interface RevenueDataPoint {
    month: string
    actual: number
    target: number
    prevYear: number
    overUnder: number
    vsLastYear: number | null
}

interface RevenueChartWidgetProps {
    data: RevenueDataPoint[]
    /** The year the main bars represent (always the current calendar year). */
    currentYear: number
    /** Selected historical comparison year, or null for no comparison. */
    compareYear: number | null
    setCompareYear: (year: number | null) => void
    /** Past years that actually have revenue data, sorted descending. */
    compareYears: number[]
    hasMounted: boolean
    revenueBasis: RevenueBasis
    setRevenueBasis: (basis: RevenueBasis) => void
}

/** Compact axis formatter without currency prefix — avoids "IDR" repetition on Y-axis */
function axisOnly(amount: number): string {
    const abs = Math.abs(amount)
    const sign = amount < 0 ? '-' : ''
    if (abs >= 1_000_000_000_000) return `${sign}${(abs / 1_000_000_000_000).toFixed(1)}T`
    if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1)}B`
    if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(0)}M`
    if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}K`
    if (abs === 0) return '0'
    return `${sign}${abs}`
}

export function RevenueChartWidget({ data, currentYear, compareYear, setCompareYear, compareYears, hasMounted, revenueBasis, setRevenueBasis }: RevenueChartWidgetProps) {
    const { fmt, fmtAxis } = useCurrency()
    const basisLabel = revenueBasis === "revenue_recognition" ? "Revenue Recognition Month" : "Closed Won Date"
    const hasComparison = compareYear !== null
    const hasCompareYears = compareYears.length > 0

    // YTD summary — compare against elapsed target (not full year)
    const currentMonth = new Date().getMonth() // 0-indexed
    const ytdActual = data.reduce((s, d) => s + d.actual, 0)
    const ytdTarget = data.reduce((s, d) => s + d.target, 0)
    // Elapsed target = sum of targets for months that have passed
    const ytdElapsedTarget = data.slice(0, currentMonth + 1).reduce((s, d) => s + d.target, 0)
    const ytdPct = ytdTarget > 0 ? (ytdActual / ytdTarget) * 100 : 0
    const ytdElapsedPct = ytdElapsedTarget > 0 ? (ytdActual / ytdElapsedTarget) * 100 : 0
    const ytdOnTrack = ytdElapsedPct >= 80 // "on track" if >=80% of elapsed target

    return (
        <SectionCard className="self-stretch">
            <div className="flex justify-between items-start mb-2">
                <div>
                    <SectionTitle>Monthly Revenue vs Target</SectionTitle>
                    <SectionSub>{currentYear} · By {basisLabel}</SectionSub>
                </div>
                <div className="flex gap-2 items-end">
                    <MiniSelect
                        label="Based on"
                        value={revenueBasis}
                        onChange={e => setRevenueBasis(e.target.value as RevenueBasis)}
                        className="text-[10px]"
                    >
                        <option value="revenue_recognition">Rev. Recognition</option>
                        <option value="closed_won">Closed Won Date</option>
                    </MiniSelect>
                    <MiniSelect
                        label="Compare to"
                        value={compareYear ?? "none"}
                        onChange={e => setCompareYear(e.target.value === "none" ? null : Number(e.target.value))}
                        disabled={!hasCompareYears}
                        title={!hasCompareYears ? "No historical data available to compare" : undefined}
                    >
                        <option value="none">{hasCompareYears ? "None" : "No history"}</option>
                        {compareYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </MiniSelect>
                </div>
            </div>

            {/* YTD attainment — shows progress vs elapsed target for context */}
            {ytdTarget > 0 && (
                <div className="flex items-center gap-2.5 mb-1.5">
                    <span className="text-[9px] font-medium text-muted-foreground shrink-0 uppercase tracking-wider">YTD</span>
                    <div className="flex-1 h-[3px] bg-[#f0f0f0] rounded-full overflow-hidden relative">
                        {/* Elapsed time marker — shows how far through the year we are */}
                        <div
                            className="absolute top-0 h-full w-px bg-[#292D30]/20"
                            style={{ left: `${((currentMonth + 1) / 12) * 100}%` }}
                        />
                        <div
                            className="h-full rounded-full"
                            style={{
                                width: `${Math.min(ytdPct, 100)}%`,
                                backgroundColor: ytdOnTrack ? "#6EBDA1" : ytdElapsedPct >= 50 ? "#F9BB46" : "#ED6F22",
                                transition: "width 600ms cubic-bezier(0.23,1,0.32,1)",
                            }}
                        />
                    </div>
                    <span className="text-[10px] font-bold tabular-nums shrink-0" style={{ color: ytdOnTrack ? "#6EBDA1" : ytdElapsedPct >= 50 ? "#292D30" : "#ED6F22" }}>
                        {fmtAxis(ytdActual)} / {fmtAxis(ytdTarget)} ({ytdPct.toFixed(0)}%)
                    </span>
                </div>
            )}

            <div className="flex-1 min-h-0 w-full">
                {hasMounted ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={data} margin={{ top: 22, right: 12, left: 0, bottom: 4 }} barGap={3} barCategoryGap="26%">
                            <defs>
                                {/* Actual — deep navy → bright blue vertical gradient */}
                                <linearGradient id="revActualGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#2069B4" />
                                    <stop offset="100%" stopColor="#02378D" />
                                </linearGradient>
                                {/* Above-target — sage gradient */}
                                <linearGradient id="revAboveGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#8ED3BB" />
                                    <stop offset="100%" stopColor="#6EBDA1" />
                                </linearGradient>
                                {/* Last year — soft sky gradient */}
                                <linearGradient id="revPrevGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#A9DBF6" />
                                    <stop offset="100%" stopColor="#5EC5F2" />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="2 5" vertical={false} stroke="#e4e9f0" />
                            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 500 }} dy={8} />
                            <YAxis yAxisId="left" tickFormatter={axisOnly} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 500 }} dx={-5} width={42} />
                            <RechartsTooltip content={<DarkTooltip fmt={fmt} />} cursor={{ fill: 'rgba(2,55,141,0.04)' }} />
                            <Legend wrapperStyle={{ paddingTop: '8px', fontSize: '10px', fontWeight: 600 }} iconType="circle" iconSize={8} />
                            {/* Target line — smooth monotone, subtle reference */}
                            <Line yAxisId="left" type="monotone" dataKey="target" name="Target" stroke="#F9BB46" strokeWidth={2.5} strokeDasharray="6 4" dot={false} strokeOpacity={0.85} strokeLinecap="round" />
                            {/* Actual bars — color changes based on vs target.
                                Solid `fill` drives the legend swatch (gradients
                                don't resolve in Recharts' separate legend SVG);
                                per-Cell gradient fills drive the actual bars. */}
                            <Bar yAxisId="left" dataKey="actual" name={`Actual ${currentYear}`} fill="#02378D" radius={[6, 6, 0, 0]} maxBarSize={34}>
                                {data.map((entry, i) => {
                                    const aboveTarget = entry.actual >= entry.target && entry.target > 0
                                    const hasData = entry.actual > 0
                                    return (
                                        <Cell
                                            key={i}
                                            fill={!hasData ? "transparent" : aboveTarget ? "url(#revAboveGrad)" : "url(#revActualGrad)"}
                                        />
                                    )
                                })}
                                <LabelList dataKey="actual" position="top" formatter={((v: unknown) => { const n = Number(v); return n > 0 ? axisOnly(n) : '' }) as (label: unknown) => string} style={{ fontSize: 8, fontWeight: 700, fill: "#475569" }} />
                            </Bar>
                            {/* Comparison bars — only rendered when the user picks a
                                historical year. Without a comparison the main bars
                                widen to fill, keeping the default view clean.
                                Solid `fill` for the legend; gradient via Cells. */}
                            {hasComparison && (
                                <Bar yAxisId="left" dataKey="prevYear" name={`${compareYear}`} fill="#5EC5F2" radius={[6, 6, 0, 0]} maxBarSize={34} opacity={0.7}>
                                    {data.map((entry, i) => (
                                        <Cell key={i} fill="url(#revPrevGrad)" />
                                    ))}
                                </Bar>
                            )}
                        </ComposedChart>
                    </ResponsiveContainer>
                ) : (
                    <WidgetSkeleton />
                )}
            </div>
        </SectionCard>
    )
}
