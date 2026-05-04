"use client"

import { SectionCard, SectionTitle, SectionSub, InsightCallout, CHART_COLORS, MiniSelect } from "./shared"

interface CatGradeItem {
    name: string
    value: number
}

interface ClassificationWidgetProps {
    data: CatGradeItem[]
    catToggle: string
    setCatToggle: (v: string) => void
}

/** Semantic colors for temperature/grade categories */
const TEMP_COLORS: Record<string, string> = {
    "Hot": "#ED6F22", "Warm": "#F9BB46", "Cold": "#02378D", "HQL": "#6EBDA1",
    "A": "#ED6F22", "B": "#F9BB46", "C": "#02378D", "D": "#94a3b8",
}

export function ClassificationWidget({ data, catToggle, setCatToggle }: ClassificationWidgetProps) {
    const total = data.reduce((s, d) => s + d.value, 0)
    const maxVal = Math.max(...data.map(d => d.value), 1)

    return (
        <SectionCard>
            <div className="flex justify-between items-start mb-1">
                <div>
                    <SectionTitle>Lead Classification</SectionTitle>
                    <SectionSub>Pipeline temperature breakdown</SectionSub>
                </div>
                <MiniSelect
                    label="Group by"
                    value={catToggle}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCatToggle(e.target.value)}
                    className="text-[10px]"
                >
                    <option value="category">Category</option>
                    <option value="grade_lead">Grade</option>
                    <option value="lead_source">Lead Source</option>
                    <option value="business_purpose">Biz Purpose</option>
                    <option value="sector">Sector</option>
                </MiniSelect>
            </div>

            {/* Stacked summary bar — shows proportions at a glance */}
            {total > 0 && (
                <div className="flex h-[8px] rounded-full overflow-hidden mb-3 bg-[#f0f0f0]">
                    {data.map((d, i) => {
                        const pct = (d.value / total) * 100
                        if (pct === 0) return null
                        return (
                            <div
                                key={d.name}
                                className="h-full first:rounded-l-full last:rounded-r-full"
                                style={{
                                    width: `${pct}%`,
                                    backgroundColor: TEMP_COLORS[d.name] || CHART_COLORS[i % CHART_COLORS.length],
                                    transition: "width 500ms cubic-bezier(0.23,1,0.32,1)",
                                }}
                                title={`${d.name}: ${d.value} (${pct.toFixed(0)}%)`}
                            />
                        )
                    })}
                </div>
            )}

            {/* Detail rows */}
            <div className="flex-1 overflow-y-auto thin-scrollbar space-y-0.5">
                {data.map((d, i) => {
                    const pct = total > 0 ? (d.value / total) * 100 : 0
                    const barWidth = maxVal > 0 ? (d.value / maxVal) * 100 : 0
                    const color = TEMP_COLORS[d.name] || CHART_COLORS[i % CHART_COLORS.length]

                    return (
                        <div key={d.name} className="py-[5px] px-1 rounded hover:bg-muted/30 transition-colors">
                            <div className="flex items-baseline justify-between mb-1">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                                    <span className="text-[11.5px] font-medium text-[#292D30]">{d.name}</span>
                                </div>
                                <div className="flex items-baseline gap-1.5 shrink-0 tabular-nums">
                                    <span className="text-[12px] font-bold text-[#292D30]">{d.value}</span>
                                    <span className="text-[9px] text-muted-foreground">{pct.toFixed(0)}%</span>
                                </div>
                            </div>
                            <div className="h-[5px] bg-[#f0f0f0] rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full"
                                    style={{
                                        width: `${barWidth}%`,
                                        backgroundColor: color,
                                        opacity: 0.8,
                                        transition: "width 500ms cubic-bezier(0.23,1,0.32,1)",
                                    }}
                                />
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Footer: total */}
            <div className="mt-1.5 pt-1.5 border-t border-border/50 text-[10px] text-muted-foreground shrink-0">
                {total} total leads
            </div>

            {/* Insight */}
            {data.length > 0 && (() => {
                const topPct = total > 0 ? (data[0].value / total) * 100 : 0
                const isHot = data[0].name.toLowerCase().includes("hot") || data[0].name === "A"
                if (isHot && topPct > 30) return <InsightCallout type="info" text={`Hot leads at ${topPct.toFixed(0)}% — prioritize immediate follow-up`} />
                return <InsightCallout type="info" text={`${data[0].name} leads dominate at ${topPct.toFixed(0)}%`} />
            })()}
        </SectionCard>
    )
}
