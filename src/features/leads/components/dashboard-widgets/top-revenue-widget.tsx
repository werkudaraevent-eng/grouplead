"use client"

import {
    BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip,
    ResponsiveContainer, Cell, LabelList,
} from "recharts"
import { useHasMounted } from "@/hooks/use-has-mounted"
import { useCurrency } from "@/contexts/currency-context"
import { SectionCard, SectionTitle, SectionSub, InsightCallout, TOOLTIP_STYLE, WidgetSkeleton } from "./shared"

interface TopCompany {
    name: string
    revenue: number
}

interface TopRevenueWidgetProps {
    data: TopCompany[]
}

function RevenueTooltip({ active, payload, fmt }: any) {
    if (!active || !payload?.[0]) return null
    const d = payload[0].payload as TopCompany
    return (
        <div style={{ ...TOOLTIP_STYLE }}>
            <div style={{ fontWeight: 700, marginBottom: 1 }}>{d.name}</div>
            <div>Revenue: {fmt(d.revenue)}</div>
        </div>
    )
}

function RankedTick({ x, y, payload, visibleLines = 2 }: any) {
    const index: number = payload.index
    const name: string = payload.value ?? ""
    const isTop3 = index < 3
    const color = isTop3 ? "#02378D" : "#64748b"
    const rankColor = isTop3 ? "#02378D" : "#94a3b8"

    const maxPerLine = 18
    let line1 = name
    let line2 = ""

    if (name.length > maxPerLine) {
        const breakIdx = name.lastIndexOf(" ", maxPerLine)
        if (breakIdx > 6) {
            line1 = name.slice(0, breakIdx)
            line2 = name.slice(breakIdx + 1)
            if (line2.length > maxPerLine) {
                line2 = line2.slice(0, maxPerLine - 1) + "…"
            }
        } else {
            line1 = name.slice(0, maxPerLine - 1) + "…"
        }
    }

    const hasTwo = line2.length > 0
    const yOffset = hasTwo ? -4 : 3.5

    return (
        <g transform={`translate(${x},${y})`}>
            <title>{name}</title>
            <text x={0} y={0} dy={yOffset} textAnchor="end" fontSize={9.5} fontWeight={500} fill={color}>
                <tspan fontWeight={700} fill={rankColor}>#{index + 1} </tspan>
                {line1}
            </text>
            {hasTwo && (
                <text x={0} y={0} dy={yOffset + 12} textAnchor="end" fontSize={9} fontWeight={400} fill="#94a3b8">
                    {line2}
                </text>
            )}
        </g>
    )
}

export function TopRevenueWidget({ data }: TopRevenueWidgetProps) {
    const { fmt, fmtAxis } = useCurrency()
    const hasMounted = useHasMounted()

    const totalRevenue = data.reduce((s, c) => s + c.revenue, 0)

    return (
        <SectionCard>
            <SectionTitle>Top Revenue Generators</SectionTitle>
            <SectionSub>Client companies by contribution</SectionSub>
            <div className="thin-scrollbar flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
                {hasMounted ? (
                    <div style={{ width: "100%", height: Math.max(data.length * 42, 80) }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={data}
                                layout="vertical"
                                margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
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
                                    width={130}
                                    tick={<RankedTick />}
                                />
                                <RechartsTooltip
                                    content={<RevenueTooltip fmt={fmt} />}
                                    cursor={{ fill: "rgba(99,102,241,0.04)" }}
                                />
                                <Bar dataKey="revenue" radius={[0, 3, 3, 0]} barSize={16}>
                                    {data.map((entry) => (
                                        <Cell
                                            key={entry.name}
                                            fill={entry.name === "Unknown Company" ? "#e2e5ea" : "#02378D"}
                                        />
                                    ))}
                                    <LabelList dataKey="revenue" position="right" formatter={((v: unknown) => fmt(Number(v))) as (label: unknown) => string} style={{ fontSize: 9, fontWeight: 600, fill: "#64748b" }} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <WidgetSkeleton />
                )}
            </div>
            {/* Summary footer */}
            <div className="mt-1.5 pt-1.5 border-t border-border/50 text-[10px] text-muted-foreground shrink-0">
                Total Won Revenue: <span className="font-bold text-foreground">{fmt(totalRevenue)}</span> from {data.length} {data.length === 1 ? "company" : "companies"}
            </div>
            {/* Insight */}
            {(() => {
                if (data.length > 0 && totalRevenue > 0 && (data[0].revenue / totalRevenue) > 0.5) {
                    return <InsightCallout icon="⚠" text={`High client concentration — ${data[0].name} is ${((data[0].revenue / totalRevenue) * 100).toFixed(0)}% of revenue`} />
                }
                if (data.length >= 5) return <InsightCallout icon="💡" text={`Healthy diversification across ${data.length} clients`} />
                return null
            })()}
        </SectionCard>
    )
}
