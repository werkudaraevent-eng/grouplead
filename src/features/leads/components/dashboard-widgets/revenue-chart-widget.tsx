"use client"

import {
    ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
} from "recharts"
import { SectionCard, SectionTitle, SectionSub, DarkTooltip, formatCur, miniSelectStyle } from "./shared"

interface RevenueDataPoint {
    month: string
    actual: number
    target: number
    prevYear: number
    overUnder: number
    vsLastYear: number | null
}

interface RevenueChartWidgetProps {
    data: RevenueDataPoint[]
    trendYear: number
    setTrendYear: (year: number) => void
    availableYears: number[]
    hasMounted: boolean
}

export function RevenueChartWidget({ data, trendYear, setTrendYear, availableYears, hasMounted }: RevenueChartWidgetProps) {
    return (
        <SectionCard style={{ alignSelf: "stretch" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                    <SectionTitle>Monthly Revenue vs Target</SectionTitle>
                    <SectionSub>Actual vs Target vs Last Year</SectionSub>
                </div>
                <select style={miniSelectStyle} value={trendYear} onChange={e => setTrendYear(Number(e.target.value))}>
                    {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>
            <div style={{ flex: 1, minHeight: 0, width: "100%" }}>
                {hasMounted ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f3f5" />
                            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 500 }} dy={8} />
                            <YAxis yAxisId="left" tickFormatter={formatCur} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#b0b8c8', fontWeight: 500 }} dx={-5} width={55} />
                            <RechartsTooltip content={<DarkTooltip />} />
                            <Legend wrapperStyle={{ paddingTop: '6px', fontSize: '9.5px', fontWeight: 500 }} />
                            <Bar yAxisId="left" dataKey="actual" name={`Actual ${trendYear}`} barSize={20} fill="#6366f1" radius={[3, 3, 0, 0]} />
                            <Bar yAxisId="left" dataKey="prevYear" name={`Last Year`} barSize={12} fill="#ddd6fe" radius={[3, 3, 0, 0]} />
                            <Line yAxisId="left" type="step" dataKey="target" name="Target" stroke="#c0c7d2" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                        </ComposedChart>
                    </ResponsiveContainer>
                ) : (
                    <div style={{
                        height: "100%",
                        borderRadius: 8,
                        background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
                        border: "1px solid #eef2f7",
                    }} />
                )}
            </div>
        </SectionCard>
    )
}
