"use client"

import {
    BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip,
    ResponsiveContainer, Cell, LabelList,
} from "recharts"
import { resolveStageColor } from "@/features/leads/lib/stage-color"
import { useHasMounted } from "@/hooks/use-has-mounted"
import { SectionCard, SectionTitle, SectionSub, CHART_COLORS, formatPct, formatSignedPct, EllipsisTick, TOOLTIP_STYLE } from "./shared"

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

    return (
        <SectionCard>
            <SectionTitle>Pipeline Stages</SectionTitle>
            <SectionSub>Lead distribution by stage</SectionSub>
            <div className="thin-scrollbar" style={{ flex: 1, minHeight: 80, overflowY: "auto", overflowX: "hidden" }}>
                {hasMounted ? (
                    <div style={{ width: "100%", height: Math.max(chartData.length * 32, 80), minHeight: "100%" }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={chartData}
                                layout="vertical"
                                margin={{ top: 4, right: 12, left: 0, bottom: 4 }}
                            >
                                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#94a3b8", fontWeight: 500 }} />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={<EllipsisTick width={110} fontSize={10} />}
                                    width={110}
                                />
                                <RechartsTooltip
                                    content={<PipelineTooltip comparisonLabel={comparisonLabel} />}
                                    cursor={{ fill: "rgba(0,0,0,.03)" }}
                                />
                                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={14}>
                                    {chartData.map((entry, i) => (
                                        <Cell key={entry.id} fill={entry._color} />
                                    ))}
                                    <LabelList dataKey="count" position="right" style={{ fontSize: 9, fontWeight: 600, fill: "#64748b" }} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div style={{
                        height: "100%",
                        borderRadius: 8,
                        background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
                        border: "1px solid #eef2f7",
                    }} />
                )}
            </div>
        </SectionCard>
    )
}
