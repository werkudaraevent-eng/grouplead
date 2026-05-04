"use client"

import { SectionCard, SectionTitle, SectionSub, InsightCallout, CHART_COLORS, MiniSelect } from "./shared"

interface StreamItem {
    name: string
    value: number
}

interface StreamWidgetProps {
    data: StreamItem[]
    streamToggle: string
    setStreamToggle: (v: string) => void
}

export function StreamWidget({ data, streamToggle, setStreamToggle }: StreamWidgetProps) {
    const total = data.reduce((s, d) => s + d.value, 0)
    const maxVal = Math.max(...data.map(d => d.value), 1)

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

            <div className="flex-1 overflow-y-auto thin-scrollbar space-y-0.5">
                {data.map((d, i) => {
                    const pct = total > 0 ? (d.value / total) * 100 : 0
                    const barWidth = maxVal > 0 ? (d.value / maxVal) * 100 : 0
                    const isUnspecified = d.name === "Unspecified"
                    const color = isUnspecified ? "#d1d5db" : CHART_COLORS[i % CHART_COLORS.length]

                    return (
                        <div key={d.name} className="py-[5px] px-1 rounded hover:bg-muted/30 transition-colors">
                            <div className="flex items-baseline justify-between mb-1">
                                <span className={`text-[11.5px] font-medium truncate mr-2 ${isUnspecified ? "text-muted-foreground italic" : "text-[#292D30]"}`}>
                                    {d.name}
                                </span>
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
                                        opacity: isUnspecified ? 0.5 : 0.8,
                                        transition: "width 500ms cubic-bezier(0.23,1,0.32,1)",
                                    }}
                                />
                            </div>
                        </div>
                    )
                })}
            </div>

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
