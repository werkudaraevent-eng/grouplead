"use client"

import { useCurrency } from "@/contexts/currency-context"
import { SectionCard, SectionTitle, SectionSub, InsightCallout } from "./shared"
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
    if (!hasTarget) return "#02378D"
    if (pct >= 100) return "#6EBDA1"
    if (pct >= 70) return "#02378D"
    return "#ED6F22"
}

export function SalesPerfWidget({ data }: SalesPerfWidgetProps) {
    const { fmtAxis } = useCurrency()

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

    // Split into tracked (with target) and untracked (no target).
    // Tracked are sorted by achievement % ascending so under-performers
    // (especially 0% reps with target but no leads in this period) surface
    // at the top where they are most actionable.
    const tracked = data.filter(r => r.target > 0).sort((a, b) => (a.actual / a.target) - (b.actual / b.target))
    const untracked = data.filter(r => r.target <= 0 && r.actual > 0).sort((a, b) => b.actual - a.actual)

    const teamActual = tracked.reduce((s, r) => s + r.actual, 0)
    const teamTarget = tracked.reduce((s, r) => s + r.target, 0)
    const teamPct = teamTarget > 0 ? (teamActual / teamTarget) * 100 : 0

    // For untracked reps, bar is relative to the highest untracked actual
    const maxUntracked = untracked[0]?.actual || 1

    return (
        <SectionCard>
            <div className="flex items-start justify-between mb-1">
                <div>
                    <SectionTitle>Sales Performance</SectionTitle>
                    <SectionSub>Revenue achievement per sales rep</SectionSub>
                </div>
                {teamTarget > 0 && (
                    <div className="text-right shrink-0">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Team avg</div>
                        <div className="text-[15px] font-bold tabular-nums tracking-tight" style={{ color: getColor(teamPct, true) }}>
                            {teamPct.toFixed(0)}%
                        </div>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto thin-scrollbar space-y-0.5">
                {/* ─── Tracked reps (with target) ─── */}
                {tracked.map((rep) => {
                    const pct = (rep.actual / rep.target) * 100
                    const color = getColor(pct, true)
                    const barWidth = Math.min(pct, 100)

                    return (
                        <div key={rep.name} className="group py-[6px] px-1 rounded hover:bg-muted/30 transition-colors">
                            <div className="flex items-baseline justify-between mb-1">
                                <span className="text-[11.5px] font-medium text-[#292D30] truncate mr-2" title={rep.name}>
                                    {rep.name}
                                </span>
                                <div className="flex items-baseline gap-1.5 shrink-0 tabular-nums">
                                    <span className="text-[12px] font-bold" style={{ color }}>{pct.toFixed(0)}%</span>
                                    <span className="text-[9px] text-muted-foreground">{fmtAxis(rep.actual)} / {fmtAxis(rep.target)}</span>
                                </div>
                            </div>
                            <div className="h-[7px] bg-[#eef2f7] rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full"
                                    style={{
                                        width: `${barWidth}%`,
                                        background: `linear-gradient(90deg, ${color}bb 0%, ${color} 100%)`,
                                        transition: "width 500ms cubic-bezier(0.23,1,0.32,1)",
                                    }}
                                />
                            </div>
                        </div>
                    )
                })}

                {/* ─── Untracked reps (no target) ─── */}
                {untracked.length > 0 && (
                    <>
                        {tracked.length > 0 && (
                            <div className="flex items-center gap-2 pt-2 pb-1 px-1">
                                <div className="h-px flex-1 bg-border/60" />
                                <span className="text-[9px] text-muted-foreground/70 uppercase tracking-wider font-medium">No Target Set</span>
                                <div className="h-px flex-1 bg-border/60" />
                            </div>
                        )}
                        {untracked.map((rep) => {
                            const barWidth = (rep.actual / maxUntracked) * 60 // Cap at 60% width to visually de-emphasize

                            return (
                                <div key={rep.name} className="group py-[6px] px-1 rounded hover:bg-muted/30 transition-colors opacity-70">
                                    <div className="flex items-baseline justify-between mb-1">
                                        <span className="text-[11.5px] font-medium text-[#292D30]/70 truncate mr-2" title={rep.name}>
                                            {rep.name}
                                        </span>
                                        <div className="flex items-baseline gap-1.5 shrink-0 tabular-nums">
                                            <span className="text-[12px] font-semibold text-[#292D30]/70">{fmtAxis(rep.actual)}</span>
                                            <span className="text-[9px] text-muted-foreground/40 italic">untracked</span>
                                        </div>
                                    </div>
                                    <div className="h-[5px] bg-[#f0f0f0]/60 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full"
                                            style={{
                                                width: `${barWidth}%`,
                                                backgroundColor: "#94a3b8",
                                                opacity: 0.5,
                                                transition: "width 500ms cubic-bezier(0.23,1,0.32,1)",
                                            }}
                                        />
                                    </div>
                                </div>
                            )
                        })}
                    </>
                )}
            </div>

            {/* Legend */}
            <div className="flex gap-3 mt-2 pt-1.5 border-t border-border/50 shrink-0">
                {[{ color: "#6EBDA1", label: "Above" }, { color: "#02378D", label: "On Track" }, { color: "#ED6F22", label: "Below" }, { color: "#94a3b8", label: "Untracked" }].map(l => (
                    <div key={l.label} className="flex items-center gap-1 text-[9px] text-muted-foreground">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: l.color, opacity: l.label === "Untracked" ? 0.5 : 1 }} />{l.label}
                    </div>
                ))}
            </div>

            {/* Insight callout — prioritized by severity:
                1. Reps with a target and zero actual (idle / not delivering)
                2. Reps below 50% — needs attention
                3. Reps without any target set — config gap
                4. Whole team on track — celebration */}
            {(() => {
                const idle = tracked.filter(r => r.actual === 0)
                if (idle.length > 0) {
                    if (idle.length === 1) return <InsightCallout type="warning" text={`${idle[0].name} has a target but no closing this period`} />
                    return <InsightCallout type="warning" text={`${idle.length} reps have targets but no closings this period`} />
                }

                const lowPerf = tracked.find(r => (r.actual / r.target) < 0.5)
                if (lowPerf) return <InsightCallout type="warning" text={`${lowPerf.name} at ${((lowPerf.actual / lowPerf.target) * 100).toFixed(0)}% — needs attention`} />

                const noTargets = untracked.length
                if (noTargets > 0) return <InsightCallout type="warning" text={`${noTargets} sales rep${noTargets > 1 ? 's' : ''} without targets — set targets in goal settings`} />

                if (tracked.length > 0 && tracked.every(r => (r.actual / r.target) >= 0.8)) return <InsightCallout type="success" text="Team on track — consider raising targets" />
                return null
            })()}
        </SectionCard>
    )
}
