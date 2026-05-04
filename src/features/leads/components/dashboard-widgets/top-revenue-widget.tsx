"use client"

import { useState } from "react"
import { useCurrency } from "@/contexts/currency-context"
import { SectionCard, SectionTitle, SectionSub, InsightCallout, TopNToggle } from "./shared"

interface TopCompany {
    name: string
    revenue: number
}

interface TopRevenueWidgetProps {
    data: TopCompany[]
}

export function TopRevenueWidget({ data }: TopRevenueWidgetProps) {
    const { fmtAxis } = useCurrency()
    const [topN, setTopN] = useState(10)

    const totalRevenue = data.reduce((s, c) => s + c.revenue, 0)
    const maxRevenue = data.length > 0 ? data[0].revenue : 1
    const visibleData = data.slice(0, topN)

    return (
        <SectionCard>
            <div className="flex items-start justify-between mb-1">
                <div>
                    <SectionTitle>Top Revenue Generators</SectionTitle>
                    <SectionSub>Client companies by contribution</SectionSub>
                </div>
                <div className="flex items-center gap-2">
                    <TopNToggle value={topN} onChange={setTopN} total={data.length} />
                    {totalRevenue > 0 && (
                        <div className="text-right shrink-0">
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Total won</div>
                            <div className="text-[15px] font-bold tabular-nums tracking-tight text-[#292D30]">
                                {fmtAxis(totalRevenue)}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto thin-scrollbar">
                {visibleData.map((company, idx) => {
                    const share = totalRevenue > 0 ? (company.revenue / totalRevenue) * 100 : 0
                    const barWidth = maxRevenue > 0 ? (company.revenue / maxRevenue) * 100 : 0
                    const isTop3 = idx < 3
                    const isUnknown = company.name === "Unknown Company"

                    return (
                        <div key={company.name} className="group py-[5px] px-1 rounded hover:bg-muted/30 transition-colors">
                            {/* Rank + Name + Amount */}
                            <div className="flex items-baseline justify-between mb-1">
                                <div className="flex items-baseline gap-1.5 min-w-0 mr-2">
                                    <span className={`text-[10px] font-bold tabular-nums shrink-0 ${isTop3 ? "text-[#02378D]" : "text-muted-foreground/50"}`}>
                                        {idx + 1}.
                                    </span>
                                    <span
                                        className={`text-[11.5px] font-medium truncate ${isUnknown ? "text-muted-foreground italic" : "text-[#292D30]"}`}
                                        title={company.name}
                                    >
                                        {company.name}
                                    </span>
                                </div>
                                <div className="flex items-baseline gap-1.5 shrink-0 tabular-nums">
                                    <span className="text-[11px] font-bold text-[#292D30]">{fmtAxis(company.revenue)}</span>
                                    <span className="text-[9px] text-muted-foreground">{share.toFixed(0)}%</span>
                                </div>
                            </div>
                            {/* Bar */}
                            <div className="h-[5px] bg-[#f0f0f0] rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full"
                                    style={{
                                        width: `${barWidth}%`,
                                        backgroundColor: isUnknown ? "#d1d5db" : isTop3 ? "#02378D" : "#5EC5F2",
                                        opacity: isTop3 ? 0.85 : 0.6,
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
                {fmtAxis(totalRevenue)} from {data.length} {data.length === 1 ? "company" : "companies"}
            </div>

            {/* Insight */}
            {(() => {
                if (data.length > 0 && totalRevenue > 0 && (data[0].revenue / totalRevenue) > 0.5) {
                    return <InsightCallout type="warning" text={`High concentration — ${data[0].name} is ${((data[0].revenue / totalRevenue) * 100).toFixed(0)}% of revenue`} />
                }
                if (data.length >= 5) return <InsightCallout type="info" text={`Healthy diversification across ${data.length} clients`} />
                return null
            })()}
        </SectionCard>
    )
}
