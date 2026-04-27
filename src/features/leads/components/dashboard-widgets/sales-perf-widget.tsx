"use client"

import {
    BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip,
    ResponsiveContainer, Cell, LabelList,
} from "recharts"
import { useHasMounted } from "@/hooks/use-has-mounted"
import { useCurrency } from "@/contexts/currency-context"
import { SectionCard, SectionTitle, SectionSub, InsightCallout, EllipsisTick } from "./shared"
import { EmptyState, NoTargetBadge } from "@/components/shared/empty-state"
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

function getBarColor(rep: SalesRep): string {
    if (rep.target <= 0) return "#94a3b8"
    const pct = (rep.actual / rep.target) * 100
    if (pct >= 100) return "#10b981"
    if (pct >= 70) return "#6366f1"
    return "#ef4444"
}

function SalesPerfTooltip({ active, payload, fmt }: any) {
    if (!active || !payload?.[0]) return null
    const d = payload[0].payload as SalesRep
    const hasTarget = d.target > 0
    const pct = hasTarget ? (d.actual / d.target) * 100 : 0
    return (
        <div style={{
            background: "#0f1729", color: "#fff", padding: "8px 11px", borderRadius: 8,
            fontSize: 11, lineHeight: 1.6, boxShadow: "0 3px 12px rgba(0,0,0,.2)",
        }}>
            <div style={{ fontWeight: 700, marginBottom: 1 }}>{d.name}</div>
            <div>Actual: {fmt(d.actual)}</div>
            {hasTarget ? (
                <>
                    <div>Target: {fmt(d.target)}</div>
                    <div style={{
                        fontWeight: 600,
                        color: pct >= 100 ? "#6ee7b7" : pct >= 70 ? "#a5b4fc" : "#fca5a5",
                    }}>
                        Achievement: {pct.toFixed(0)}%
                    </div>
                </>
            ) : (
                <div style={{ opacity: 0.7 }}>No target set</div>
            )}
        </div>
    )
}

export function SalesPerfWidget({ data }: SalesPerfWidgetProps) {
    const { fmt, fmtAxis } = useCurrency()
    const hasMounted = useHasMounted()

    if (data.length === 0) {
        return (
            <SectionCard>
                <SectionTitle>Sales Performance vs Target</SectionTitle>
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

    return (
        <SectionCard>
            <SectionTitle>Sales Performance vs Target</SectionTitle>
            <SectionSub>Revenue achievement per sales rep</SectionSub>
            <div className="thin-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden" }}>
                {hasMounted ? (
                    <div style={{ width: "100%", height: Math.max(data.length * 40, 80) }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={data}
                                layout="vertical"
                                margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
                                maxBarSize={14}
                            >
                                <XAxis
                                    type="number"
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={fmtAxis}
                                    tick={{ fontSize: 9, fill: "#b0b8c8", fontWeight: 500 }}
                                />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={<EllipsisTick width={120} fontSize={10} />}
                                    width={120}
                                />
                                <RechartsTooltip
                                    content={<SalesPerfTooltip fmt={fmt} />}
                                    cursor={{ fill: "rgba(99,102,241,0.04)" }}
                                />
                                <Bar dataKey="target" name="Target" fill="#e2e8f0" radius={[0, 3, 3, 0]} barSize={12} />
                                <Bar dataKey="actual" name="Actual" radius={[0, 3, 3, 0]} barSize={12}>
                                    {data.map((rep) => (
                                        <Cell key={rep.name} fill={getBarColor(rep)} />
                                    ))}
                                    <LabelList dataKey="actual" position="right" formatter={fmt} style={{ fontSize: 9, fontWeight: 600, fill: "#64748b" }} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div style={{
                        height: "100%",
                        borderRadius: 8,
                        background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
                        border: "1px solid #eef2f7",
                    }} />
                )}
            </div>
            {/* Legend */}
            <div style={{ display: "flex", gap: 10, marginTop: 6, paddingTop: 6, borderTop: "1px solid #f1f3f5", flexShrink: 0 }}>
                {[{ color: "#10b981", label: "Above Target" }, { color: "#6366f1", label: "On Track" }, { color: "#ef4444", label: "Below Target" }].map(l => (
                    <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 9, color: "#94a3b8" }}>
                        <div style={{ width: 6, height: 6, borderRadius: 2, background: l.color }} />{l.label}
                    </div>
                ))}
            </div>
            {/* Insight callout */}
            {(() => {
                const noTargets = data.filter(r => r.target <= 0).length
                if (noTargets > 0) return <InsightCallout icon="⚠" text={`${noTargets} sales rep${noTargets > 1 ? 's' : ''} without targets — set targets in goal settings`} />

                const lowPerf = data.find(r => r.target > 0 && (r.actual / r.target) < 0.5)
                if (lowPerf) return <InsightCallout icon="⚠" text={`${lowPerf.name} at ${((lowPerf.actual / lowPerf.target) * 100).toFixed(0)}% — schedule performance review`} />

                if (data.every(r => r.target <= 0 || (r.actual / r.target) >= 0.8)) return <InsightCallout icon="💡" text="Team on track — consider raising targets" />
                return null
            })()}
        </SectionCard>
    )
}
