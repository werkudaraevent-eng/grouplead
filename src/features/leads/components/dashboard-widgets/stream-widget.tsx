"use client"

import {
    BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, LabelList,
} from "recharts"
import { SectionCard, SectionTitle, SectionSub, InsightCallout, CHART_COLORS, miniSelectStyle, EllipsisTick } from "./shared"
import { useHasMounted } from "@/hooks/use-has-mounted"

interface StreamItem {
    name: string
    value: number
}

interface StreamWidgetProps {
    data: StreamItem[]
    streamToggle: string
    setStreamToggle: (v: string) => void
}

function StreamTooltip({ active, payload }: any) {
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

export function StreamWidget({ data, streamToggle, setStreamToggle }: StreamWidgetProps) {
    const hasMounted = useHasMounted()
    const totalStream = data.reduce((s, d) => s + d.value, 0)

    const chartData = data.map((d, i) => {
        const isUnspecified = d.name === "Unspecified"
        return {
            ...d,
            fill: isUnspecified ? "#d1d5db" : CHART_COLORS[i % CHART_COLORS.length],
            isUnspecified,
            pctLabel: totalStream > 0 ? `${((d.value / totalStream) * 100).toFixed(1)}%` : "0%",
        }
    })

    return (
        <SectionCard>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 1 }}>
                <SectionTitle>Stream Alignment</SectionTitle>
                <select style={{ ...miniSelectStyle, fontSize: 10 }} value={streamToggle} onChange={(e: any) => setStreamToggle(e.target.value)}>
                    <option value="main_stream">All</option>
                    <option value="stream_type">Sub Stream</option>
                    <option value="business_purpose">Biz Purpose</option>
                    <option value="line_industry">Line Industry</option>
                    <option value="area">Area</option>
                    <option value="nationality">Nationality</option>
                </select>
            </div>
            <SectionSub>Business alignment distribution</SectionSub>

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
                                <RechartsTooltip content={<StreamTooltip />} cursor={{ fill: "rgba(0,0,0,.03)" }} />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14}>
                                    {chartData.map((d, i) => (
                                        <Cell
                                            key={i}
                                            fill={d.fill}
                                            fillOpacity={d.isUnspecified ? 0.5 : 1}
                                            strokeDasharray={d.isUnspecified ? "4 2" : undefined}
                                            stroke={d.isUnspecified ? "#9ca3af" : undefined}
                                            strokeWidth={d.isUnspecified ? 1 : 0}
                                        />
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
                const unspecPct = totalStream > 0 ? ((data.find(d => d.name === "Unspecified")?.value || 0) / totalStream) * 100 : 0
                if (unspecPct > 20) return <InsightCallout icon="⚠" text={`${unspecPct.toFixed(0)}% leads unspecified — improve data capture`} />
                return <InsightCallout icon="💡" text={`${data[0].name} leads the pipeline — align sales capacity`} />
            })()}
        </SectionCard>
    )
}
