"use client"

import { SectionCard, SectionTitle, SectionSub, InsightCallout, MiniSelect, DonutChart } from "./shared"

interface StreamItem {
    name: string
    value: number
}

interface StreamWidgetProps {
    data: StreamItem[]
    streamToggle: string
    setStreamToggle: (v: string) => void
    activeName?: string | null
    onSliceClick?: (item: StreamItem) => void
}

export function StreamWidget({ data, streamToggle, setStreamToggle, activeName = null, onSliceClick }: StreamWidgetProps) {
    const total = data.reduce((s, d) => s + d.value, 0)

    return (
        <SectionCard>
            <div className="flex justify-between items-start mb-1">
                <div>
                    <SectionTitle>Stream Alignment</SectionTitle>
                    <SectionSub>Business alignment distribution</SectionSub>
                </div>
                <MiniSelect
                    label="Group by"
                    value={streamToggle}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStreamToggle(e.target.value)}
                    className="text-[10px]"
                >
                    <option value="main_stream">Main Stream</option>
                    <option value="stream_type">Sub Stream</option>
                    <option value="business_purpose">Biz Purpose</option>
                    <option value="line_industry">Line Industry</option>
                    <option value="area">Area</option>
                    <option value="nationality">Nationality</option>
                </MiniSelect>
            </div>

            {/* Donut — composition view. Top 5 + Others handles high-cardinality
                groupings (Line Industry, Area, Nationality) without slivers. */}
            <DonutChart data={data} centerLabel="Leads" colorMap={{ Unspecified: "#d1d5db" }} maxSlices={6} activeName={activeName} onSliceClick={onSliceClick} />

            {/* Footer */}
            <div className="mt-1.5 pt-1.5 border-t border-border/50 text-[10px] text-muted-foreground shrink-0">
                {total} total leads
            </div>

            {/* Insight */}
            {data.length > 0 && (() => {
                const unspecPct = total > 0 ? ((data.find(d => d.name === "Unspecified")?.value || 0) / total) * 100 : 0
                if (unspecPct > 20) return <InsightCallout type="warning" text={`${unspecPct.toFixed(0)}% leads unspecified — improve data capture`} />
                return <InsightCallout type="info" text={`${data[0].name} leads the pipeline — align sales capacity`} />
            })()}
        </SectionCard>
    )
}
