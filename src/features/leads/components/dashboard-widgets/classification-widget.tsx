"use client"

import { SectionCard, SectionTitle, SectionSub, InsightCallout, CHART_COLORS, miniSelectStyle } from "./shared"

interface CatGradeItem {
    name: string
    value: number
}

interface ClassificationWidgetProps {
    data: CatGradeItem[]
    catToggle: string
    setCatToggle: (v: string) => void
}

export function ClassificationWidget({ data, catToggle, setCatToggle }: ClassificationWidgetProps) {
    const totalCat = data.reduce((s, d) => s + d.value, 0)
    const tempColors: Record<string, string> = { "Hot": "#ef4444", "Warm": "#f59e0b", "Cold": "#6366f1", "A": "#ef4444", "B": "#f59e0b", "C": "#6366f1" }
    const getColor = (name: string, idx: number) => tempColors[name] || CHART_COLORS[(idx + 3) % CHART_COLORS.length]

    return (
        <SectionCard>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 1 }}>
                <SectionTitle>Lead Classification</SectionTitle>
                <select style={{ ...miniSelectStyle, fontSize: 10 }} value={catToggle} onChange={(e: any) => setCatToggle(e.target.value)}>
                    <option value="category">Category</option>
                    <option value="grade_lead">Grade</option>
                    <option value="lead_source">Lead Source</option>
                    <option value="business_purpose">Biz Purpose</option>
                    <option value="sector">Sector</option>
                </select>
            </div>
            <SectionSub>Pipeline temperature breakdown</SectionSub>

            {/* Segmented bar */}
            <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", marginBottom: 12 }}>
                {data.map((d, i) => (
                    <div key={d.name} style={{ width: `${(d.value / totalCat) * 100}%`, background: getColor(d.name, i), transition: "width .4s ease" }} />
                ))}
            </div>
            <div style={{ fontSize: 9, color: "#94a3b8", textAlign: "right" as const, marginTop: -8, marginBottom: 8 }}>Total: {totalCat}</div>

            {/* Metric mini cards */}
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(data.length, 3)}, 1fr)`, gap: 6 }}>
                {data.slice(0, 3).map((d, i) => {
                    const color = getColor(d.name, i)
                    const pct = totalCat > 0 ? (d.value / totalCat) * 100 : 0
                    return (
                        <div key={d.name} style={{ background: color + "0d", borderRadius: 8, padding: 10, textAlign: "center" as const }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color, marginBottom: 2 }}>{d.name}</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: "#0f1729", lineHeight: 1.2 }}>{d.value}</div>
                            <div style={{ fontSize: 10, color: "#8892a4", marginTop: 2 }}>{pct.toFixed(0)}%</div>
                        </div>
                    )
                })}
            </div>

            {/* Remaining items */}
            {data.length > 3 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                    {data.slice(3).map((d) => (
                        <span key={d.name} style={{ fontSize: 9, color: "#8892a4", background: "#f4f5f7", padding: "2px 6px", borderRadius: 3, fontWeight: 500 }}>
                            {d.name}: {d.value}
                        </span>
                    ))}
                </div>
            )}

            {/* Insight */}
            {data.length > 0 && (() => {
                const topPct = totalCat > 0 ? (data[0].value / totalCat) * 100 : 0
                const isHot = data[0].name.toLowerCase().includes("hot") || data[0].name === "A"
                if (isHot && topPct > 30) return <InsightCallout icon="💡" text={`Hot leads at ${topPct.toFixed(0)}% — prioritize immediate follow-up`} />
                return <InsightCallout icon="💡" text={`${data[0].name} leads dominate at ${topPct.toFixed(0)}%`} />
            })()}
        </SectionCard>
    )
}
