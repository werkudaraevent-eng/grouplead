"use client"

import { SectionCard, SectionTitle, SectionSub, InsightCallout, CHART_COLORS } from "./shared"

interface SourceItem {
    name: string
    value: number
}

interface LeadSourceWidgetProps {
    data: SourceItem[]
}

export function LeadSourceWidget({ data }: LeadSourceWidgetProps) {
    const totalLeads = data.reduce((s, d) => s + d.value, 0)
    const sourceColors: Record<string, string> = { "Referral": "#6366f1", "Event Partnership": "#8b5cf6", "Direct Request": "#0ea5e9", "Cold Call": "#f59e0b", "Repeat Client": "#10b981" }

    return (
        <SectionCard>
            <SectionTitle>Lead Source</SectionTitle>
            <SectionSub>Origin channel distribution</SectionSub>

            {/* Stacked bar */}
            <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", marginBottom: 12 }}>
                {data.map((d, i) => (
                    <div key={d.name} style={{ width: `${(d.value / totalLeads) * 100}%`, background: sourceColors[d.name] || CHART_COLORS[i % CHART_COLORS.length], transition: "width .4s ease" }} />
                ))}
            </div>
            <div style={{ fontSize: 9, color: "#94a3b8", textAlign: "right" as const, marginTop: -8, marginBottom: 8 }}>Total: {totalLeads}</div>

            {/* Breakdown list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minHeight: 0, overflowY: "auto" }}>
                {data.map((d, i) => {
                    const color = sourceColors[d.name] || CHART_COLORS[i % CHART_COLORS.length]
                    const pct = totalLeads > 0 ? (d.value / totalLeads) * 100 : 0
                    return (
                        <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ width: 75, fontSize: 10.5, fontWeight: 500, color: "#5a6178", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flexShrink: 0 }}>{d.name}</div>
                            <div style={{ flex: 1, height: 6, background: "#f1f3f5", borderRadius: 3, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width .4s" }} />
                            </div>
                            <span style={{ fontSize: 10.5, fontWeight: 700, color: "#0f1729", width: 20, textAlign: "right" as const, flexShrink: 0 }}>{d.value}</span>
                            <span style={{ fontSize: 9.5, color: "#94a3b8", width: 30, flexShrink: 0 }}>({pct.toFixed(0)}%)</span>
                        </div>
                    )
                })}
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
