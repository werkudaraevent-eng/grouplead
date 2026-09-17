"use client"

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { Category, Series } from "@/lib/reporting/widget-view"
import { formatCompact, formatValue } from "@/lib/reporting/widget-view"
import type { Unit } from "@/lib/reporting/cube"

/**
 * The two axis charts, on recharts, with every colour a token and every
 * animation off (the card is read, not watched). The legend is ours: a
 * row of dots under the plot, hidden in a small cell where the plot needs
 * the room.
 */

interface AxisChartProps {
  categories: Category[]
  series: Series[]
  values: number[][]
  unit: Unit
  stacked?: boolean
}

function toRows({ categories, series, values }: AxisChartProps) {
  return categories.map((item, index) => {
    const row: Record<string, string | number> = { name: item.label, long: item.long ?? item.label }
    series.forEach((entry, j) => {
      row[entry.key] = values[index]?.[j] ?? 0
    })
    return row
  })
}

function ChartTooltip({ active, payload, series, unit }: { active?: boolean; payload?: Array<{ dataKey?: string | number; value?: number | string; payload?: Record<string, string | number> }>; series: Series[]; unit: Unit }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-foreground">{row?.long ?? row?.name}</p>
      {payload.map((entry) => {
        const meta = series.find((item) => item.key === entry.dataKey)
        return (
          <p key={String(entry.dataKey)} className="flex items-center gap-2 text-muted-foreground">
            <span className="h-2 w-2 rounded-full" style={{ background: meta?.color }} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{meta?.label ?? entry.dataKey}</span>
            <span className="tabular-nums text-foreground">{formatValue(Number(entry.value ?? 0), unit)}</span>
          </p>
        )
      })}
    </div>
  )
}

function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null
  return (
    <ul className="mt-1 hidden flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground @[260px]:flex" aria-label="Keterangan">
      {series.map((item) => (
        <li key={item.key} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: item.color }} aria-hidden="true" />
          <span className="truncate">{item.label}</span>
        </li>
      ))}
    </ul>
  )
}

const axisStyle = { fontSize: 10, fill: "var(--muted-foreground)" }

export function DayBars(props: AxisChartProps) {
  const rows = toRows(props)
  const dense = props.categories.length > 14
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -18 }} barCategoryGap={dense ? "20%" : "30%"} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={axisStyle} tickLine={false} axisLine={false} interval={dense ? "preserveStartEnd" : 0} minTickGap={12} />
            <YAxis tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} tickFormatter={(value: number) => formatCompact(value, props.unit)} width={46} />
            <Tooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltip series={props.series} unit={props.unit} />} />
            {props.series.map((item) => (
              <Bar key={item.key} dataKey={item.key} fill={item.color} stackId={props.stacked ? "all" : undefined} radius={props.stacked ? 0 : [3, 3, 0, 0]} isAnimationActive={false} maxBarSize={28} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Legend series={props.series} />
    </div>
  )
}

export function Lines(props: AxisChartProps) {
  const rows = toRows(props)
  const dense = props.categories.length > 14
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 6, right: 6, bottom: 0, left: -18 }} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={axisStyle} tickLine={false} axisLine={false} interval={dense ? "preserveStartEnd" : 0} minTickGap={12} />
            <YAxis tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} tickFormatter={(value: number) => formatCompact(value, props.unit)} width={46} />
            <Tooltip cursor={{ stroke: "var(--border)" }} content={<ChartTooltip series={props.series} unit={props.unit} />} />
            {props.series.map((item) => (
              <Line key={item.key} type="monotone" dataKey={item.key} stroke={item.color} strokeWidth={2} dot={rows.length <= 14} activeDot={{ r: 4 }} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <Legend series={props.series} />
    </div>
  )
}
