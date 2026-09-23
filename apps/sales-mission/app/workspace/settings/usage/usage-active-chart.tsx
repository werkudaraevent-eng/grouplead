"use client"

import { DayBars } from "@/app/workspace/reports/ringkasan/charts/bars-and-lines"
import type { Category, Series } from "@/lib/reporting/widget-view"
import type { DailyActive } from "@/lib/usage/usage-stats"

/**
 * Pengguna aktif per hari: a bar per WIB day of the period, the people who
 * opened the app that day. Ringkasan's own `DayBars`, so the axis, the
 * integer ticks, the compact labels, the tooltip box and the phone sizing
 * are the board's. Weekday and weekend are two stacked series of which a
 * day fills only one, which is how a bar takes the weekend's muted ink
 * while the board's legend names both under the plot. Labels arrive
 * formatted from the server, as the board's do, so every browser shows the
 * same "22 Sep" whatever its locale data.
 */

/** A day of the series with its axis label ("22 Sep") and tooltip label ("Sel 22 Sep"). */
export type DailyActiveBar = DailyActive & { label: string; long: string }

const SERIES: Series[] = [
  { key: "weekday", label: "Hari kerja", color: "var(--chart-1)" },
  { key: "weekend", label: "Akhir pekan", color: "var(--muted-foreground)" },
]

const number = new Intl.NumberFormat("id-ID")
const tooltipLine = (label: string, total: number) => `${label} · ${number.format(total)} orang`

export function UsageActiveChart({ days }: { days: DailyActiveBar[] }) {
  const categories: Category[] = days.map((entry) => ({ key: entry.day, label: entry.label, long: entry.long }))
  const values = days.map((entry) => (entry.weekend ? [0, entry.active] : [entry.active, 0]))
  return (
    <div className="@container h-56">
      <DayBars categories={categories} series={SERIES} values={values} unit="count" stacked tooltipLine={tooltipLine} />
    </div>
  )
}
