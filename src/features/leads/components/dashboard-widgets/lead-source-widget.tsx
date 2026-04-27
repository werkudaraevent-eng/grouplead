"use client"

import {
    BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, LabelList,
} from "recharts"
import { SectionCard, SectionTitle, SectionSub, InsightCallout, CHART_COLORS, EllipsisTick } from "./shared"
import { useHasMounted } from "@/hooks/use-has-mounted"

interface SourceItem {
    name: string
    value: number
}

interface LeadSourceWidgetProps {
    data: SourceItem[]
}

function SourceTooltip({ active, payload }: any) {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    return (
        <div style={{
            background: "#0f172a", color: "#fff", padding: "8px 11px", borderRadius: 8,
            fontSize: 11, lineHeight: 1.6, boxShadow: "0 4px 16px rgba(0,0,0,.25)",
        }}>
            <div style={{ fontWeight: 700, marginBottom: 1 }}>{d.name}</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <div style={{ width: 6, height: 6, borderRadius: 2, background: d.fill, flexShrink: 0 }} />
                <span>Count: {d.value}</span>
            </div>
            <div style={{ opacity: 0.7 }}>{d.pctLabel}</div>
        </div>
    )
}

export function LeadSourceWidget({ data }: LeadSourceWidgetProps) {
    const hasMounted = useHasMounted()
    const totalLeads = data.reduce((s, d) => s + d.value, 0)
    const sourceColors: Record<string, string> = { "Referral": "#6366f1", "Event Partnership": "#8b5cf6", "Direct Request": "#0ea5e9", "Cold Call": "#f59e0b", "Repeat Client": "#10b981" }

    const chartData = data.map((d, i) => ({
        ...d,
        fill: sourceColors[d.name] || CHART_COLORS[i % CHART_COLORS.length],
        pctLabel: totalLeads > 0 ? `${((d.value / totalLeads) * 100).toFixed(1)}%` : "0%",
    }))

    return (
        <SectionCard>
            <SectionTitle>Lead Source</SectionTitle>
            <SectionSub>Origin channel distribution</SectionSub>

            <div style={{ fontSize: 9, color: "#94a3b8", textAlign: "right" as const, marginBottom: 4 }}>Total: {totalLeads}</div>

            <div className="thin-scrollbar" style={{ flex: 1, minHeight: 80, overflowY: "auto", overflowX: "hidden" }}>
                {hasMounted ? (
                    <div style={{ width: "100%", height: Math.max(chartData.length * 32, 80), minHeight: "100%" }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
                                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#b0b8c8", fontWeight: 500 }} />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={<EllipsisTick width={100} fontSize={10} />}
                                    width={100}
                                />
                                <RechartsTooltip content={<SourceTooltip />} cursor={{ fill: "rgba(0,0,0,.03)" }} />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14}>
                                    {chartData.map((d, i) => (
                                        <Cell key={i} fill={d.fill} />
                                    ))}
                                    <LabelList dataKey="value" position="right" style={{ fontSize: 9, fontWeight: 600, fill: "#64748b" }} />
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

            {/* Insight */}
            {data.length > 0 && (() => {
                const topPct = totalLeads > 0 ? (data[0].value / totalLeads) * 100 : 0
                const extra = topPct > 60 ? " — consider diversifying" : ""
                return <InsightCallout icon="💡" text={`${data[0].name} is your top source at ${topPct.toFixed(0)}%${extra}`} />
            })()}
        </SectionCard>
    )
}
