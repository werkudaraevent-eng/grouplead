"use client"

import {
    BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip,
    ResponsiveContainer, Cell, LabelList,
} from "recharts"
import { resolveStageColor } from "@/features/leads/lib/stage-color"
import { useHasMounted } from "@/hooks/use-has-mounted"
import { SectionCard, SectionTitle, SectionSub, CHART_COLORS, formatPct, formatSignedPct, EllipsisTick, TOOLTIP_STYLE, WidgetSkeleton } from "./shared"

interface PipelineStageData {
    id: string
    name: string
    color: string
    count: number
    previousCount: number
    share: number
    previousShare: number
    shareDelta: number
    sortOrder: number
}

interface PipelineWidgetProps {
    data: PipelineStageData[]
    comparisonLabel: string
}

function PipelineTooltip({ active, payload, comparisonLabel }: any) {
    if (!active || !payload?.[0]) return null
    const d = payload[0].payload as PipelineStageData
    return (
        <div style={{ ...TOOLTIP_STYLE }}>
            <div style={{ fontWeight: 700, marginBottom: 1 }}>{d.name}</div>
            <div>Count: {d.count} ({formatPct(d.share)} of current leads)</div>
            <div style={{ opacity: 0.7 }}>
                {comparisonLabel}: {d.previousCount} lead{d.previousCount === 1 ? "" : "s"} ({formatPct(d.previousShare)})
            </div>
            <div style={{
                fontWeight: 600,
                color: d.shareDelta >= 0 ? "#6ee7b7" : "#fca5a5",
            }}>
                YoY share: {formatSignedPct(d.shareDelta, " pts")}
            </div>
        </div>
    )
}

export function PipelineWidget({ data, comparisonLabel }: PipelineWidgetProps) {
    const hasMounted = useHasMounted()

    const chartData = data.map((d, i) => ({
        ...d,
        _color: resolveStageColor(d.color, CHART_COLORS[i % CHART_COLORS.length]),
    }))

    // Calculate win rate for summary
    const totalLeads = data.reduce((s, d) => s + d.count, 0)
    const wonCount = data.find(d => d.name.toLowerCase().includes("won"))?.count || 0
    const lostCount = data.filter(d => {
        const n = d.name.toLowerCase()
        return n.includes("lost") || n.includes("turndown") || n.includes("cancelled") || n.includes("postponed")
    }).reduce((s, d) => s + d.count, 0)
    const closedTotal = wonCount + lostCount
    const winRate = closedTotal > 0 ? (wonCount / closedTotal) * 100 : 0

    return (
        <SectionCard>
            <div className="flex items-start justify-between mb-1">
                <div>
                    <SectionTitle>Pipeline Stages</SectionTitle>
                    <SectionSub>Lead distribution by stage</SectionSub>
                </div>
                {closedTotal > 0 && (
                    <div className="text-right shrink-0">
                        <div className="text-[11px] text-muted-foreground">Win rate</div>
                        <div className="text-[15px] font-bold tabular-nums" style={{ color: winRate >= 50 ? "#6EBDA1" : winRate >= 30 ? "#292D30" : "#ED6F22" }}>
                            {winRate.toFixed(1)}%
                        </div>
                    </div>
                )}
            </div>
            <div className="thin-scrollbar flex-1 min-h-[80px] overflow-y-auto overflow-x-hidden">
                {hasMounted ? (
                    <div style={{ width: "100%", height: Math.max(chartData.length * 34, 80), minHeight: "100%" }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={chartData}
                                layout="vertical"
                                margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
                            >
                                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#94a3b8", fontWeight: 500 }} />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={<EllipsisTick width={150} fontSize={11} />}
                                    width={150}
                                />
                                <RechartsTooltip
                                    content={<PipelineTooltip comparisonLabel={comparisonLabel} />}
                                    cursor={{ fill: "rgba(0,0,0,.03)" }}
                                />
                                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
                                    {chartData.map((entry) => (
                                        <Cell key={entry.id} fill={entry._color} />
                                    ))}
                                    <LabelList dataKey="count" position="right" style={{ fontSize: 10, fontWeight: 700, fill: "#292D30" }} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <WidgetSkeleton />
                )}
            </div>
        </SectionCard>
    )
}
