"use client"

import { useState } from "react"
import { useCurrency } from "@/contexts/currency-context"
import { SectionCard, SectionTitle, SectionSub, InsightCallout, MiniSelect } from "./shared"

interface TopCompany {
    name: string
    revenue: number
}

interface TopRevenueWidgetProps {
    /** ALL won-revenue companies for the period, grouped by the leaf company
     *  directly on each lead, pre-sorted descending. */
    data: TopCompany[]
    /** Same set rolled up to the top-level / parent (group) company. When
     *  omitted, the Company/Group switcher is hidden and only `data` shows. */
    dataGrouped?: TopCompany[]
}

// How many leaderboard rows the user can choose to see. "All" still caps the
// rendered bars (long-tail 0% rows are visual noise); the remainder is rolled
// up into a single "+ N more" line so totals always reconcile.
type ShowMode = "top10" | "top20" | "all"
const SHOW_LIMIT: Record<ShowMode, number> = { top10: 10, top20: 20, all: 50 }
const SHOW_LABELS: Record<ShowMode, string> = { top10: "Top 10", top20: "Top 20", all: "All" }

// Which company level the leaderboard groups by. "group" rolls divisions up to
// their parent/holding company; "company" shows each leaf company as-is.
type GroupMode = "company" | "group"
const GROUP_LABELS: Record<GroupMode, string> = { company: "Company", group: "Group" }

export function TopRevenueWidget({ data, dataGrouped }: TopRevenueWidgetProps) {
    const { fmtAxis } = useCurrency()
    const [showMode, setShowMode] = useState<ShowMode>("top10")
    const [groupMode, setGroupMode] = useState<GroupMode>("company")

    // Grouping is only offered when a rolled-up set is supplied AND it actually
    // differs from the leaf set (i.e. at least one parent exists). Otherwise the
    // switcher would be a no-op, so we hide it.
    const canGroup = !!dataGrouped && dataGrouped.length !== data.length
    const data_ = canGroup && groupMode === "group" ? dataGrouped! : data

    // Totals are ALWAYS computed across every row of the selected view so
    // "Total Won" and the per-row % are honest and reconcile with the Won
    // Revenue KPI — never relative to just the visible slice.
    const totalRevenue = data_.reduce((s, c) => s + c.revenue, 0)
    const maxRevenue = data_.length > 0 ? data_[0].revenue : 1

    const limit = SHOW_LIMIT[showMode]
    const visible = data_.slice(0, limit)
    const hidden = data_.slice(limit)
    const hiddenCount = hidden.length
    const hiddenRevenue = hidden.reduce((s, c) => s + c.revenue, 0)
    const hiddenShare = totalRevenue > 0 ? (hiddenRevenue / totalRevenue) * 100 : 0

    return (
        <SectionCard>
            <div className="flex items-start justify-between mb-1 gap-2">
                <div className="min-w-0">
                    <SectionTitle>Top Revenue Generators</SectionTitle>
                    <SectionSub>{groupMode === "group" ? "By parent / group company" : "Client companies by contribution"}</SectionSub>
                </div>
                <div className="flex items-end gap-2.5 shrink-0">
                    {canGroup && (
                        <MiniSelect
                            label="Level"
                            value={groupMode}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setGroupMode(e.target.value as GroupMode)}
                            className="text-[10px]"
                        >
                            {(Object.keys(GROUP_LABELS) as GroupMode[]).map(mode => (
                                <option key={mode} value={mode}>{GROUP_LABELS[mode]}</option>
                            ))}
                        </MiniSelect>
                    )}
                    {data_.length > 10 && (
                        <MiniSelect
                            label="Show"
                            value={showMode}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setShowMode(e.target.value as ShowMode)}
                            className="text-[10px]"
                        >
                            {(Object.keys(SHOW_LABELS) as ShowMode[]).map(mode => (
                                <option key={mode} value={mode}>{SHOW_LABELS[mode]}</option>
                            ))}
                        </MiniSelect>
                    )}
                    {totalRevenue > 0 && (
                        <div className="text-right">
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Total won</div>
                            <div className="text-[15px] font-bold tabular-nums tracking-tight text-[#292D30]">
                                {fmtAxis(totalRevenue)}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto thin-scrollbar">
                {visible.map((company, idx) => {
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
                            <div className="h-[7px] bg-[#eef2f7] rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full"
                                    style={{
                                        width: `${barWidth}%`,
                                        background: isUnknown
                                            ? "#d1d5db"
                                            : isTop3
                                                ? "linear-gradient(90deg, #2069B4 0%, #02378D 100%)"
                                                : "linear-gradient(90deg, #8AD3F5 0%, #5EC5F2 100%)",
                                        opacity: isTop3 ? 1 : 0.75,
                                        transition: "width 500ms cubic-bezier(0.23,1,0.32,1)",
                                    }}
                                />
                            </div>
                        </div>
                    )
                })}

                {/* Long-tail rollup — keeps totals reconciling without flooding
                    the leaderboard with near-0% bars. */}
                {hiddenCount > 0 && (
                    <div className="flex items-baseline justify-between py-[7px] px-1 mt-0.5 border-t border-dashed border-border/60">
                        <span className="text-[11px] font-medium text-muted-foreground italic truncate mr-2">
                            + {hiddenCount} more {hiddenCount === 1 ? "company" : "companies"}
                        </span>
                        <div className="flex items-baseline gap-1.5 shrink-0 tabular-nums">
                            <span className="text-[11px] font-semibold text-muted-foreground">{fmtAxis(hiddenRevenue)}</span>
                            <span className="text-[9px] text-muted-foreground/60">{hiddenShare.toFixed(0)}%</span>
                        </div>
                    </div>
                )}
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
