"use client"

import { useState } from "react"
import { useCurrency } from "@/contexts/currency-context"
import { SectionCard, SectionTitle, SectionSub, InsightCallout, TopNToggle } from "./shared"
import { EmptyState } from "@/components/shared/empty-state"
import { Users } from "lucide-react"

interface SalesRep {
    name: string
    actual: number
    target: number
    hasRealTarget?: boolean
}

interface SalesPerfWidgetProps {
    data: SalesRep[]
}

function getColor(pct: number, hasTarget: boolean): string {
    if (!hasTarget) return "#94a3b8"
    if (pct >= 100) return "#6EBDA1"
    if (pct >= 70) return "#02378D"
    return "#ED6F22"
}

export function SalesPerfWidget({ data }: SalesPerfWidgetProps) {
    const { fmtAxis } = useCurrency()
    const [topN, setTopN] = useState(10)

    if (data.length === 0) {
        return (
            <SectionCard>
                <SectionTitle>Sales Performance</SectionTitle>
                <SectionSub>Revenue achievement per sales rep</SectionSub>
                <EmptyState
                    icon={Users}
                    title="No sales data yet"
                    description="Assign leads to sales reps to see performance metrics"
                    size="sm"
                />
            </SectionCard>
        )
    }

    // Sort by achievement descending
    const sorted = [...data].sort((a, b) => {
        const pctA = a.target > 0 ? a.actual / a.target : -1
        const pctB = b.target > 0 ? b.actual / b.target : -1
        return pctB - pctA
    })

    const teamActual = data.reduce((s, r) => s + r.actual, 0)
    const teamTarget = data.reduce((s, r) => s + r.target, 0)
    const teamPct = teamTarget > 0 ? (teamActual / teamTarget) * 100 : 0

    return (
        <SectionCard>
            <div className="flex items-start justify-between mb-1">
                <div>
                    <SectionTitle>Sales Performance</SectionTitle>
                    <SectionSub>Revenue achievement per sales rep</SectionSub>
                </div>
                <div className="flex items-center gap-2">
                    <TopNToggle value={topN} onChange={setTopN} total={sorted.length} />
                {teamTarget > 0 && (
                    <div className="text-right shrink-0">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Team avg</div>
                        <div className="text-[15px] font-bold tabular-nums tracking-tight" style={{ color: getColor(teamPct, true) }}>
                            {teamPct.toFixed(0)}%
                        </div>
                    </div>
                )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto thin-scrollbar space-y-0.5">
                {sorted.slice(0, topN).map((rep) => {
                    const hasTarget = rep.target > 0
                    const pct = hasTarget ? (rep.actual / rep.target) * 100 : 0
                    const color = getColor(pct, hasTarget)
                    const barWidth = hasTarget ? Math.min(pct, 100) : 0

                    return (
                        <div key={rep.name} className="group py-[6px] px-1 rounded hover:bg-muted/30 transition-colors">
                            {/* Name + percentage */}
                            <div className="flex items-baseline justify-between mb-1">
                                <span className="text-[11.5px] font-medium text-[#292D30] truncate mr-2" title={rep.name}>
                                    {rep.name}
                                </span>
                                <div className="flex items-baseline gap-1.5 shrink-0 tabular-nums">
                                    {hasTarget ? (
                                        <>
                                            <span className="text-[12px] font-bold" style={{ color }}>{pct.toFixed(0)}%</span>
                                            <span className="text-[9px] text-muted-foreground">{fmtAxis(rep.actual)} / {fmtAxis(rep.target)}</span>
                                        </>
                                    ) : (
                                        <span className="text-[10px] text-muted-foreground/50">No target</span>
                                    )}
                                </div>
                            </div>
                            {/* Progress bar */}
                            <div className="h-[6px] bg-[#f0f0f0] rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full"
                                    style={{
                                        width: `${barWidth}%`,
                                        backgroundColor: color,
                                        opacity: 0.85,
                                        transition: "width 500ms cubic-bezier(0.23,1,0.32,1)",
                                    }}
                                />
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Legend */}
            <div className="flex gap-3 mt-2 pt-1.5 border-t border-border/50 shrink-0">
                {[{ color: "#6EBDA1", label: "Above" }, { color: "#02378D", label: "On Track" }, { color: "#ED6F22", label: "Below" }].map(l => (
                    <div key={l.label} className="flex items-center gap-1 text-[9px] text-muted-foreground">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: l.color }} />{l.label}
                    </div>
                ))}
            </div>

            {/* Insight callout */}
            {(() => {
                const noTargets = data.filter(r => r.target <= 0).length
                if (noTargets > 0) return <InsightCallout type="warning" text={`${noTargets} sales rep${noTargets > 1 ? 's' : ''} without targets — set targets in goal settings`} />

                const lowPerf = data.find(r => r.target > 0 && (r.actual / r.target) < 0.5)
                if (lowPerf) return <InsightCallout type="warning" text={`${lowPerf.name} at ${((lowPerf.actual / lowPerf.target) * 100).toFixed(0)}% — needs attention`} />

                if (data.every(r => r.target <= 0 || (r.actual / r.target) >= 0.8)) return <InsightCallout type="success" text="Team on track — consider raising targets" />
                return null
            })()}
        </SectionCard>
    )
}
