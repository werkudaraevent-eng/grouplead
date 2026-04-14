"use client"

import { SectionCard, SectionTitle, SectionSub, InsightCallout, CHART_COLORS, miniSelectStyle } from "./shared"

interface StreamItem {
    name: string
    value: number
}

interface StreamWidgetProps {
    data: StreamItem[]
    streamToggle: 'main_stream' | 'stream_type' | 'business_purpose'
    setStreamToggle: (v: 'main_stream' | 'stream_type' | 'business_purpose') => void
}

export function StreamWidget({ data, streamToggle, setStreamToggle }: StreamWidgetProps) {
    const totalStream = data.reduce((s, d) => s + d.value, 0)
    const maxStream = data[0]?.value || 1

    return (
        <SectionCard>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 1 }}>
                <SectionTitle>Stream Alignment</SectionTitle>
                <select style={{ ...miniSelectStyle, fontSize: 10 }} value={streamToggle} onChange={(e: any) => setStreamToggle(e.target.value)}>
                    <option value="main_stream">All</option>
                    <option value="stream_type">Sub Stream</option>
                    <option value="business_purpose">Biz Purpose</option>
                </select>
            </div>
            <SectionSub>Business alignment distribution</SectionSub>

            <div style={{ display: "flex", flexDirection: "column", gap: 7, flex: 1, minHeight: 0, overflowY: "auto" }}>
                {data.map((d, i) => {
                    const color = CHART_COLORS[i % CHART_COLORS.length]
                    const isUnspecified = d.name === "Unspecified"
                    const pct = totalStream > 0 ? (d.value / totalStream) * 100 : 0
                    return (
                        <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ width: 85, fontSize: 10.5, fontWeight: 500, color: isUnspecified ? "#94a3b8" : "#5a6178", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flexShrink: 0, fontStyle: isUnspecified ? "italic" : "normal" }}>
                                {isUnspecified && <span style={{ marginRight: 2 }}>⚠</span>}{d.name}
                            </div>
                            <div style={{ flex: 1, height: 6, background: "#f1f3f5", borderRadius: 3, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${(d.value / maxStream) * 100}%`, background: isUnspecified ? "#e2e5ea" : color, borderRadius: 3, transition: "width .4s", borderStyle: isUnspecified ? "dashed" : "none" }} />
                            </div>
                            <span style={{ fontSize: 10.5, fontWeight: 700, color: "#0f1729", width: 18, textAlign: "right" as const, flexShrink: 0 }}>{d.value}</span>
                            <span style={{ fontSize: 9.5, color: "#94a3b8", width: 30, flexShrink: 0 }}>({pct.toFixed(0)}%)</span>
                        </div>
                    )
                })}
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
