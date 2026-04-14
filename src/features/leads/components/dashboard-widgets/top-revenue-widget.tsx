"use client"

import { SectionCard, SectionTitle, SectionSub, InsightCallout, formatCur } from "./shared"

interface TopCompany {
    name: string
    revenue: number
}

interface TopRevenueWidgetProps {
    data: TopCompany[]
}

export function TopRevenueWidget({ data }: TopRevenueWidgetProps) {
    return (
        <SectionCard>
            <SectionTitle>Top Revenue Generators</SectionTitle>
            <SectionSub>Client companies by contribution</SectionSub>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minHeight: 0, overflowY: "auto" }}>
                {data.map((comp, i) => {
                    const maxRev = data[0]?.revenue || 1
                    const isUnknown = comp.name === "Unknown Company"
                    return (
                        <div key={comp.name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ width: 16, fontSize: 10, fontWeight: 700, color: i < 3 ? "#6366f1" : "#8892a4", textAlign: "right" as const, flexShrink: 0 }}>{i + 1}</span>
                            <div style={{ width: 85, fontSize: 11, fontWeight: 500, color: isUnknown ? "#94a3b8" : "#5a6178", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flexShrink: 0, fontStyle: isUnknown ? "italic" : "normal" }}>{comp.name}</div>
                            <div style={{ flex: 1, height: 22, background: "#f1f3f5", borderRadius: 4, overflow: "hidden" }}>
                                <div style={{
                                    height: "100%", width: `${(comp.revenue / maxRev) * 100}%`,
                                    background: isUnknown ? "#e2e5ea" : `linear-gradient(90deg, #6366f1, #818cf8)`,
                                    borderRadius: 4, transition: "width .4s ease",
                                    borderStyle: isUnknown ? "dashed" : "none",
                                }} />
                            </div>
                            <span style={{ width: 65, fontSize: 10, fontWeight: 700, color: "#0f1729", textAlign: "right" as const, flexShrink: 0, whiteSpace: "nowrap" }}>{formatCur(comp.revenue)}</span>
                        </div>
                    )
                })}
            </div>
            {/* Summary footer */}
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid #f1f3f5", fontSize: 10.5, color: "#8892a4" }}>
                Total Won Revenue: <span style={{ fontWeight: 700, color: "#0f1729" }}>{formatCur(data.reduce((s, c) => s + c.revenue, 0))}</span> from {data.length} {data.length === 1 ? "company" : "companies"}
            </div>
            {/* Insight */}
            {(() => {
                const total = data.reduce((s, c) => s + c.revenue, 0)
                if (data.length > 0 && total > 0 && (data[0].revenue / total) > 0.5) {
                    return <InsightCallout icon="⚠" text={`High client concentration — ${data[0].name} is ${((data[0].revenue / total) * 100).toFixed(0)}% of revenue`} />
                }
                if (data.length >= 5) return <InsightCallout icon="💡" text={`Healthy diversification across ${data.length} clients`} />
                return null
            })()}
        </SectionCard>
    )
}
