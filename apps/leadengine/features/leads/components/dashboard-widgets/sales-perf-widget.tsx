"use client"

import { useState } from "react"
import { useCurrency } from "@/contexts/currency-context"
import { SectionCard, SectionTitle, SectionSub, InsightCallout, MiniSelect } from "./shared"
import { EmptyState } from "@/components/shared/empty-state"
import { getInitials, getAvatarColor } from "@/lib/avatar"
import { Users } from "lucide-react"

// Sort modes offered to the user. Default `achievement_asc` keeps the
// action-oriented behaviour (worst performers surface at the top), but the
// user can flip to highest-first, by revenue, by target size, or A–Z.
type SortMode = "achievement_asc" | "achievement_desc" | "actual_desc" | "target_desc" | "name_asc"

const SORT_LABELS: Record<SortMode, string> = {
    achievement_asc: "Lowest %",
    achievement_desc: "Highest %",
    actual_desc: "Revenue",
    target_desc: "Target",
    name_asc: "Name (A\u2013Z)",
}

interface SalesRep {
    name: string
    actual: number
    target: number
    avatarUrl?: string | null
    hasRealTarget?: boolean
}

/** Small avatar chip — photo when available, else colored initials. */
function RepAvatar({ name, avatarUrl, dim }: { name: string; avatarUrl?: string | null; dim?: boolean }) {
    if (avatarUrl) {
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={avatarUrl} alt={name} className={`w-5 h-5 rounded-full object-cover shrink-0 ${dim ? "opacity-70" : ""}`} />
    }
    return (
        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 ${getAvatarColor(name)} ${dim ? "opacity-70" : ""}`}>
            {getInitials(name)}
        </span>
    )
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
    const [sortBy, setSortBy] = useState<SortMode>("achievement_asc")

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
    // Tracked order follows the user's chosen sort. Achievement modes add a
    // secondary sort by target size so reps tied at the same % (e.g. several
    // at 0%) get a stable, meaningful order instead of input order.
    const pctOf = (r: SalesRep) => r.actual / r.target
    const trackedComparators: Record<SortMode, (a: SalesRep, b: SalesRep) => number> = {
        achievement_asc: (a, b) => pctOf(a) - pctOf(b) || b.target - a.target,
        achievement_desc: (a, b) => pctOf(b) - pctOf(a) || b.target - a.target,
        actual_desc: (a, b) => b.actual - a.actual,
        target_desc: (a, b) => b.target - a.target,
        name_asc: (a, b) => a.name.localeCompare(b.name),
    }
    const tracked = data.filter(r => r.target > 0).sort(trackedComparators[sortBy])
    const untracked = data.filter(r => r.target <= 0 && r.actual > 0).sort(
        sortBy === "name_asc"
            ? (a, b) => a.name.localeCompare(b.name)
            : (a, b) => b.actual - a.actual,
    )

    const teamActual = tracked.reduce((s, r) => s + r.actual, 0)
    const teamTarget = tracked.reduce((s, r) => s + r.target, 0)
    const teamPct = teamTarget > 0 ? (teamActual / teamTarget) * 100 : 0

    // For untracked reps, bar is relative to the highest untracked actual
    const maxUntracked = untracked[0]?.actual || 1

    return (
        <SectionCard>
            <div className="flex items-start justify-between mb-1 gap-2">
                <div className="min-w-0">
                    <SectionTitle>Sales Performance</SectionTitle>
                    <SectionSub>Revenue achievement per sales rep</SectionSub>
                </div>
                <div className="flex items-end gap-2.5 shrink-0">
                    <MiniSelect
                        label="Sort by"
                        value={sortBy}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSortBy(e.target.value as SortMode)}
                        className="text-[10px]"
                    >
                        {(Object.keys(SORT_LABELS) as SortMode[]).map(mode => (
                            <option key={mode} value={mode}>{SORT_LABELS[mode]}</option>
                        ))}
                    </MiniSelect>
                    {teamTarget > 0 && (
                        <div className="text-right">
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Team avg</div>
                            <div className="text-[15px] font-bold tabular-nums tracking-tight" style={{ color: getColor(teamPct, true) }}>
                                {teamPct.toFixed(0)}%
                            </div>
                        </div>
                    )}
                </div>
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
                                <span className="flex items-center gap-2 min-w-0 mr-2">
                                    <RepAvatar name={rep.name} avatarUrl={rep.avatarUrl} />
                                    <span className="text-[11.5px] font-medium text-[#292D30] truncate" title={rep.name}>
                                        {rep.name}
                                    </span>
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
                                        minWidth: rep.actual > 0 ? "4px" : undefined,
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
                                        <span className="flex items-center gap-2 min-w-0 mr-2">
                                            <RepAvatar name={rep.name} avatarUrl={rep.avatarUrl} dim />
                                            <span className="text-[11.5px] font-medium text-[#292D30]/70 truncate" title={rep.name}>
                                                {rep.name}
                                            </span>
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
