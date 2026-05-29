"use client"

import { SectionCard, SectionTitle, SectionSub, InsightCallout } from "./shared"

interface SourceItem {
    name: string
    value: number
}

interface LeadSourceWidgetProps {
    data: SourceItem[]
}

export function LeadSourceWidget({ data }: LeadSourceWidgetProps) {
    const total = data.reduce((s, d) => s + d.value, 0)
    const maxVal = Math.max(...data.map(d => d.value), 1)

    return (
        <SectionCard>
            <div className="flex items-start justify-between mb-1">
                <div>
                    <SectionTitle>Lead Source</SectionTitle>
                    <SectionSub>Origin channel distribution</SectionSub>
                </div>
                {total > 0 && (
                    <div className="text-right shrink-0">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Total</div>
                        <div className="text-[15px] font-bold tabular-nums tracking-tight text-[#292D30]">{total}</div>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto thin-scrollbar space-y-0.5">
                {data.map((d, i) => {
                    const pct = total > 0 ? (d.value / total) * 100 : 0
                    const barWidth = maxVal > 0 ? (d.value / maxVal) * 100 : 0
                    // Single color (navy) with decreasing opacity for ranking effect
                    const opacity = Math.max(0.3, 1 - (i * 0.08))

                    return (
                        <div key={d.name} className="py-[5px] px-1 rounded hover:bg-muted/30 transition-colors">
                            <div className="flex items-baseline justify-between mb-1">
                                <span className="text-[11.5px] font-medium text-[#292D30] truncate mr-2">{d.name}</span>
                                <div className="flex items-baseline gap-1.5 shrink-0 tabular-nums">
                                    <span className="text-[12px] font-bold text-[#292D30]">{d.value}</span>
                                    <span className="text-[9px] text-muted-foreground">{pct.toFixed(0)}%</span>
                                </div>
                            </div>
                            <div className="h-[7px] bg-[#eef2f7] rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full"
                                    style={{
                                        width: `${barWidth}%`,
                                        background: "linear-gradient(90deg, #2069B4 0%, #02378D 100%)",
                                        opacity,
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
                {data.length} channels tracked
            </div>

            {/* Insight */}
            {data.length > 0 && (() => {
                const topPct = total > 0 ? (data[0].value / total) * 100 : 0
                const extra = topPct > 60 ? " — consider diversifying" : ""
                return <InsightCallout type="info" text={`${data[0].name} is your top source at ${topPct.toFixed(0)}%${extra}`} />
            })()}
        </SectionCard>
    )
}
