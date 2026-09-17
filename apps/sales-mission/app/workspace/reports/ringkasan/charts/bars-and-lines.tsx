"use client"

import { useContainerWidth } from "react-grid-layout"
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
  /**
   * Names on the category axis lie the bars down: the label then has the
   * row's width to itself instead of a slot between its neighbours, which
   * is Material's data-visualisation rule (never rotate a label; turn the
   * chart) and Datawrapper's.
   */
  horizontal?: boolean
}

const LABEL_CHARS = 16
const truncate = (text: string) => (text.length > LABEL_CHARS ? `${text.slice(0, LABEL_CHARS - 1)}…` : text)

/** A category tick with an ellipsis; the full name is in the tooltip. */
function NameTick({ x, y, payload }: { x?: number; y?: number; payload?: { value?: string } }) {
  const text = String(payload?.value ?? "")
  return (
    <text x={x} y={y} dy={3} textAnchor="end" fontSize={10} fill="var(--muted-foreground)">
      <title>{text}</title>
      {truncate(text)}
    </text>
  )
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
  // The bar width is set by hand from the measured plot: recharts' own
  // share of the category band came out as hairlines on a month of days.
  const { width, containerRef } = useContainerWidth()
  const plot = Math.max(0, width - 56)
  const barSize = Math.max(4, Math.min(28, Math.floor(((plot / Math.max(1, props.categories.length)) * 0.72) / Math.max(1, props.series.length))))
  if (props.horizontal) {
    // Rows: one per name, the label on the left, the bar to its right.
    const rowSize = Math.max(4, Math.min(22, Math.floor(22 / Math.max(1, props.stacked ? 1 : props.series.length))))
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div ref={containerRef} className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ top: 2, right: 8, bottom: 0, left: 0 }} barGap={2} barCategoryGap="22%" accessibilityLayer>
              <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis type="number" tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} tickFormatter={(value: number) => formatCompact(value, props.unit)} />
              <YAxis type="category" dataKey="name" width={96} tickLine={false} axisLine={false} interval={0} tick={<NameTick />} />
              <Tooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltip series={props.series} unit={props.unit} />} />
              {props.series.map((item) => (
                <Bar key={item.key} dataKey={item.key} fill={item.color} stackId={props.stacked ? "all" : undefined} radius={props.stacked ? 0 : [0, 3, 3, 0]} isAnimationActive={false} barSize={rowSize} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <Legend series={props.series} />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={containerRef} className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -18 }} barGap={2} barCategoryGap={dense ? "12%" : "24%"} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={axisStyle} tickLine={false} axisLine={false} interval={dense ? "preserveStartEnd" : 0} minTickGap={12} />
            <YAxis tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} tickFormatter={(value: number) => formatCompact(value, props.unit)} width={46} />
            <Tooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltip series={props.series} unit={props.unit} />} />
            {props.series.map((item) => (
              <Bar key={item.key} dataKey={item.key} fill={item.color} stackId={props.stacked ? "all" : undefined} radius={props.stacked ? 0 : [3, 3, 0, 0]} isAnimationActive={false} barSize={props.stacked ? Math.min(28, barSize * props.series.length) : barSize} />
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
