"use client"

import { SectionCard, SectionTitle, SectionSub, InsightCallout, MiniSelect, DonutChart } from "./shared"

interface CatGradeItem {
    name: string
    value: number
}

interface ClassificationWidgetProps {
    data: CatGradeItem[]
    catToggle: string
    setCatToggle: (v: string) => void
}

/** Semantic colors for temperature/grade categories — a heat encoding
 *  (Hot=orange, Cold=navy) that carries real meaning, so we keep it as an
 *  explicit override rather than the generic navy→sky ramp. */
const TEMP_COLORS: Record<string, string> = {
    "Hot": "#ED6F22", "Warm": "#F9BB46", "Cold": "#02378D", "HQL": "#6EBDA1",
    "A": "#ED6F22", "B": "#F9BB46", "C": "#02378D", "D": "#94a3b8",
}

export function ClassificationWidget({ data, catToggle, setCatToggle }: ClassificationWidgetProps) {
    const total = data.reduce((s, d) => s + d.value, 0)

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

            {/* Donut — composition is the question here ("what share?"), so a
                ring reads better than bars. Top 5 + Others keeps high-cardinality
                groupings (Sector, Lead Source) legible. */}
            <DonutChart data={data} centerLabel="Leads" colorMap={TEMP_COLORS} maxSlices={6} />

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
