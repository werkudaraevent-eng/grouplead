"use client"

import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts"
import { SectionCard, SectionTitle, SectionSub, InsightCallout, CHART_COLORS, TOOLTIP_STYLE, MiniSelect, WidgetSkeleton } from "./shared"
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
        <div style={{ ...TOOLTIP_STYLE }}>
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
    const tempColors: Record<string, string> = { "Hot": "#ED6F22", "Warm": "#F9BB46", "Cold": "#02378D", "A": "#ED6F22", "B": "#F9BB46", "C": "#02378D" }
    const getColor = (name: string, idx: number) => tempColors[name] || CHART_COLORS[(idx + 3) % CHART_COLORS.length]

    const chartData = data.map((d, i) => ({
        ...d,
        fill: getColor(d.name, i),
        percent: totalCat > 0 ? d.value / totalCat : 0,
    }))

    return (
        <SectionCard>
            <div className="flex justify-between items-center mb-1">
                <SectionTitle>Lead Classification</SectionTitle>
                <MiniSelect
                    label="Group by"
                    value={catToggle}
                    onChange={(e: any) => setCatToggle(e.target.value)}
                    className="text-[10px]"
                >
                    <option value="category">Category</option>
                    <option value="grade_lead">Grade</option>
                    <option value="lead_source">Lead Source</option>
                    <option value="business_purpose">Biz Purpose</option>
                    <option value="sector">Sector</option>
                </MiniSelect>
            </div>
            <SectionSub>Pipeline temperature breakdown</SectionSub>

            {/* Donut chart */}
            <div className="flex-1 min-h-[80px] w-full">
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
                    <WidgetSkeleton />
                )}
            </div>

            {/* Legend */}
            <div className="thin-scrollbar flex flex-wrap gap-x-3 gap-y-1 mt-2 pt-2 border-t border-border/50 max-h-[72px] overflow-y-auto shrink-0">
                {chartData.map((d) => {
                    const pct = totalCat > 0 ? (d.value / totalCat) * 100 : 0
                    return (
                        <div key={d.name} className="flex items-center gap-1 min-w-0">
                            <div className="w-[7px] h-[7px] rounded-sm shrink-0" style={{ background: d.fill }} />
                            <span className="text-[10px] font-semibold text-slate-700 whitespace-nowrap">{d.name}</span>
                            <span className="text-[9px] text-muted-foreground whitespace-nowrap">{d.value} ({pct.toFixed(0)}%)</span>
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
