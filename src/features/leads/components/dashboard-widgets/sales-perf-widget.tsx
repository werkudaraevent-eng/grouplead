"use client"

import { SectionCard, SectionTitle, SectionSub, InsightCallout, formatCur } from "./shared"

interface SalesRep {
    name: string
    actual: number
    target: number
}

interface SalesPerfWidgetProps {
    data: SalesRep[]
}

export function SalesPerfWidget({ data }: SalesPerfWidgetProps) {
    return (
        <SectionCard>
            <SectionTitle>Sales Performance vs Target</SectionTitle>
            <SectionSub>Revenue achievement per sales rep</SectionSub>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minHeight: 0, overflowY: "auto" }}>
                {data.map((rep) => {
                    const maxVal = Math.max(...data.map(r => Math.max(r.actual, r.target)), 1)
                    const pct = rep.target > 0 ? (rep.actual / rep.target) * 100 : 0
                    const isUnassigned = rep.name === "Unassigned"
                    const barColor = isUnassigned ? "#94a3b8" : pct >= 100 ? "#10b981" : pct >= 70 ? "#6366f1" : "#ef4444"
                    return (
                        <div key={rep.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 80, fontSize: 11, fontWeight: 500, color: isUnassigned ? "#94a3b8" : "#5a6178", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flexShrink: 0, fontStyle: isUnassigned ? "italic" : "normal" }}>
                                {isUnassigned && <span style={{ marginRight: 3 }}>⚠</span>}{rep.name}
                            </div>
                            <div style={{ flex: 1, height: 28, background: "#f1f3f5", borderRadius: 4, position: "relative", overflow: "hidden" }}>
                                <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${(rep.target / maxVal) * 100}%`, background: barColor, opacity: 0.1, borderRadius: 4 }} />
                                <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${(rep.actual / maxVal) * 100}%`, background: barColor, borderRadius: 4, transition: "width .4s ease", minWidth: rep.actual > 0 ? 4 : 0 }} />
                                {rep.target > 0 && <span style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", fontSize: 9, fontWeight: 700, color: barColor, background: "#fff", padding: "0 4px", borderRadius: 3, lineHeight: "16px" }}>{pct.toFixed(0)}%</span>}
                            </div>
                            <div style={{ width: 100, fontSize: 10, textAlign: "right" as const, color: "#5a6178", flexShrink: 0, whiteSpace: "nowrap" }}>
                                <span style={{ fontWeight: 700, color: "#0f1729" }}>{formatCur(rep.actual)}</span>
                                {rep.target > 0 && <span style={{ color: "#94a3b8" }}> / {formatCur(rep.target)}</span>}
                            </div>
                        </div>
                    )
                })}
            </div>
            {/* Legend */}
            <div style={{ display: "flex", gap: 10, marginTop: 10, paddingTop: 8, borderTop: "1px solid #f1f3f5" }}>
                {[{ color: "#10b981", label: "Above Target" }, { color: "#6366f1", label: "On Track" }, { color: "#ef4444", label: "Below Target" }, { color: "#94a3b8", label: "Unassigned" }].map(l => (
                    <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 9, color: "#94a3b8" }}>
                        <div style={{ width: 6, height: 6, borderRadius: 2, background: l.color }} />{l.label}
                    </div>
                ))}
            </div>
            {/* Insight callout */}
            {(() => {
                const unassigned = data.find(r => r.name === "Unassigned")
                const lowPerf = data.find(r => r.name !== "Unassigned" && r.target > 0 && (r.actual / r.target) < 0.5)
                if (unassigned && unassigned.actual > 0) return <InsightCallout icon="⚠" text={`${formatCur(unassigned.actual)} unassigned revenue — distribute to sales reps`} />
                if (lowPerf) return <InsightCallout icon="⚠" text={`${lowPerf.name} at ${((lowPerf.actual / lowPerf.target) * 100).toFixed(0)}% — schedule performance review`} />
                if (data.every(r => r.target <= 0 || (r.actual / r.target) >= 0.8)) return <InsightCallout icon="💡" text="Team on track — consider raising targets" />
                return null
            })()}
        </SectionCard>
    )
}
