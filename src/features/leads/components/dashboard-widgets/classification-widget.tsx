"use client"

import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts"
import { SectionCard, SectionTitle, SectionSub, InsightCallout, CHART_COLORS, miniSelectStyle } from "./shared"
import { useHasMounted } from "@/hooks/use-has-mounted"

interface CatGradeItem {
    name: string
    value: number
}

interface ClassificationWidgetProps {
    data: CatGradeItem[]
    catToggle: string
    setCatToggle: (v: string) => void
}

function ClassificationTooltip({ active, payload }: any) {
    if (!active || !payload?.length) return null
    const { name, value, percent } = payload[0].payload
    return (
        <div style={{
            background: "#0f172a", color: "#fff", padding: "8px 12px", borderRadius: 8,
            fontSize: 11, lineHeight: 1.6, boxShadow: "0 4px 16px rgba(0,0,0,.25)",
        }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{name}</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <div style={{ width: 6, height: 6, borderRadius: 2, background: payload[0].payload.fill, flexShrink: 0 }} />
                <span>Count: {value}</span>
            </div>
            <div style={{ opacity: 0.7 }}>{(percent * 100).toFixed(1)}%</div>
        </div>
    )
}

export function ClassificationWidget({ data, catToggle, setCatToggle }: ClassificationWidgetProps) {
    const hasMounted = useHasMounted()
    const totalCat = data.reduce((s, d) => s + d.value, 0)
    const tempColors: Record<string, string> = { "Hot": "#ef4444", "Warm": "#f59e0b", "Cold": "#6366f1", "A": "#ef4444", "B": "#f59e0b", "C": "#6366f1" }
    const getColor = (name: string, idx: number) => tempColors[name] || CHART_COLORS[(idx + 3) % CHART_COLORS.length]

    const chartData = data.map((d, i) => ({
        ...d,
        fill: getColor(d.name, i),
        percent: totalCat > 0 ? d.value / totalCat : 0,
    }))

    return (
        <SectionCard>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
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

            {/* Donut chart — fills available vertical space */}
            <div style={{ flex: 1, minHeight: 80, width: "100%" }}>
                {hasMounted ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={chartData}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius="50%"
                                outerRadius="80%"
                                paddingAngle={2}
                                strokeWidth={0}
                            >
                                {chartData.map((d, i) => (
                                    <Cell key={i} fill={d.fill} />
                                ))}
                            </Pie>
                            <RechartsTooltip content={<ClassificationTooltip />} />
                        </PieChart>
                    </ResponsiveContainer>
                ) : (
                    <div style={{
                        height: "100%", borderRadius: 8,
                        background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
                        border: "1px solid #eef2f7",
                    }} />
                )}
            </div>

            {/* Legend — compact, below chart */}
            <div className="thin-scrollbar" style={{
                display: "flex", flexWrap: "wrap", gap: "4px 12px",
                marginTop: 8, paddingTop: 8, borderTop: "1px solid #f1f5f9",
                maxHeight: 72, overflowY: "auto", flexShrink: 0,
            }}>
                {chartData.map((d) => {
                    const pct = totalCat > 0 ? (d.value / totalCat) * 100 : 0
                    return (
                        <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
                            <div style={{ width: 7, height: 7, borderRadius: 2, background: d.fill, flexShrink: 0 }} />
                            <span style={{ fontSize: 10, fontWeight: 600, color: "#334155", whiteSpace: "nowrap" }}>
                                {d.name}
                            </span>
                            <span style={{ fontSize: 9, color: "#94a3b8", whiteSpace: "nowrap" }}>
                                {d.value} ({pct.toFixed(0)}%)
                            </span>
                        </div>
                    )
                })}
            </div>

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
