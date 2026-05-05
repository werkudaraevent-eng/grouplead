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
    trendYear: number
    setTrendYear: (year: number) => void
    availableYears: number[]
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

export function RevenueChartWidget({ data, trendYear, setTrendYear, availableYears, hasMounted, revenueBasis, setRevenueBasis }: RevenueChartWidgetProps) {
    const { fmt, fmtAxis } = useCurrency()
    const basisLabel = revenueBasis === "revenue_recognition" ? "Revenue Recognition Month" : "Closed Won Date"

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
                    <SectionSub>By {basisLabel}</SectionSub>
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
                        value={trendYear}
                        onChange={e => setTrendYear(Number(e.target.value))}
                    >
                        {availableYears.map(y => <option key={y} value={y}>{y - 1}</option>)}
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
                        <ComposedChart data={data} margin={{ top: 22, right: 12, left: 0, bottom: 4 }} barGap={2} barCategoryGap="20%">
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 500 }} dy={8} />
                            <YAxis yAxisId="left" tickFormatter={axisOnly} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 500 }} dx={-5} width={42} />
                            <RechartsTooltip content={<DarkTooltip fmt={fmt} />} />
                            <Legend wrapperStyle={{ paddingTop: '8px', fontSize: '10px', fontWeight: 600 }} />
                            {/* Target line — smooth monotone, subtle reference */}
                            <Line yAxisId="left" type="monotone" dataKey="target" name="Target" stroke="#F9BB46" strokeWidth={2} strokeDasharray="6 3" dot={false} strokeOpacity={0.6} />
                            {/* Actual bars — color changes based on vs target */}
                            <Bar yAxisId="left" dataKey="actual" name={`Actual ${trendYear}`} radius={[3, 3, 0, 0]}>
                                {data.map((entry, i) => {
                                    const aboveTarget = entry.actual >= entry.target && entry.target > 0
                                    const hasData = entry.actual > 0
                                    return (
                                        <Cell
                                            key={i}
                                            fill={!hasData ? "transparent" : aboveTarget ? "#6EBDA1" : "#02378D"}
                                        />
                                    )
                                })}
                                <LabelList dataKey="actual" position="top" formatter={((v: unknown) => { const n = Number(v); return n > 0 ? axisOnly(n) : '' }) as (label: unknown) => string} style={{ fontSize: 8, fontWeight: 600, fill: "#292D30" }} />
                            </Bar>
                            {/* Last year bars — secondary, no labels to avoid clutter */}
                            <Bar yAxisId="left" dataKey="prevYear" name={`Last Year`} fill="#5EC5F2" radius={[3, 3, 0, 0]} opacity={0.45} />
                        </ComposedChart>
                    </ResponsiveContainer>
                ) : (
                    <WidgetSkeleton />
                )}
            </div>
        </SectionCard>
    )
}
