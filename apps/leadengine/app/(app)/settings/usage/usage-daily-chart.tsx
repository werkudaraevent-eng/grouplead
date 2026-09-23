"use client"

import { useState } from "react"
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { usageBarSize, type DailyActive } from "@/lib/usage/usage-stats"

/**
 * Daily active users: a bar per WIB day of the period, the people who
 * opened LeadEngine that day. Every colour is a token and the animation is
 * off (the card is read, not watched). Weekdays are in the primary, the ink
 * LeadEngine's own charts give a measure, and weekends in the muted ink, so
 * the weekly rhythm shows at a glance; the legend under the plot names both
 * (Sales Activity's Pemakaian draws the same chart). Labels arrive
 * formatted from the server, so every browser shows the same "22 Sep".
 *
 * The bar width is set by hand from the measured plot: never wider than a
 * day's slot, so ninety days on a phone are thin bars side by side and not
 * a band of bars laid over each other, and never wider than 28px, so seven
 * days on a desk are still bars and not blocks.
 */

/** A day of the series with its axis label ("22 Sep") and tooltip label ("Tue 22 Sep"). */
export type DailyActiveBar = DailyActive & { label: string; long: string }

const WEEKDAY = "var(--primary)"
const WEEKEND = "var(--muted-foreground)"
const number = new Intl.NumberFormat("en-US")
const axisStyle = { fontSize: 10, fill: "var(--muted-foreground)" }

function OneLineTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: DailyActiveBar }> }) {
  const day = payload?.[0]?.payload
  if (!active || !day) return null
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium tabular-nums text-foreground">
        {day.long} · {number.format(day.active)} {day.active === 1 ? "person" : "people"}
      </p>
    </div>
  )
}

export function UsageDailyChart({ days }: { days: DailyActiveBar[] }) {
  const [width, setWidth] = useState(0)
  const barSize = usageBarSize(width, days.length)
  const dense = days.length > 14
  // The chart's reading for a screen reader: today and the busiest day.
  const peak = days.reduce<DailyActiveBar | null>((best, day) => (!best || day.active > best.active ? day : best), null)
  const today = days[days.length - 1]
  const summary = today
    ? `Daily active users, last ${days.length} days. Today ${number.format(today.active)}${peak && peak.active > 0 ? `; highest ${number.format(peak.active)} on ${peak.long}` : ""}.`
    : "Daily active users: no days to show."

  return (
    <figure className="m-0 flex h-56 min-w-0 flex-col" aria-label={summary}>
      <div className="min-h-0 min-w-0 flex-1">
        <ResponsiveContainer width="100%" height="100%" onResize={(next) => setWidth(next)}>
          <BarChart data={days} margin={{ top: 4, right: 4, bottom: 0, left: -18 }} barCategoryGap={dense ? "12%" : "24%"} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={false} interval={dense ? "preserveStartEnd" : 0} minTickGap={12} />
            <YAxis
              tick={axisStyle}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={46}
              // A period nobody came still draws its axis, 0 to 1, rather than an empty box.
              domain={[0, (dataMax: number) => Math.max(1, dataMax)]}
              tickFormatter={(value: number) => number.format(value)}
            />
            <Tooltip cursor={{ fill: "var(--muted)" }} content={<OneLineTooltip />} />
            <Bar dataKey="active" radius={[3, 3, 0, 0]} isAnimationActive={false} barSize={barSize}>
              {days.map((day) => (
                <Cell key={day.day} fill={day.weekend ? WEEKEND : WEEKDAY} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption>
        <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground" aria-label="Legend">
          <li className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: WEEKDAY }} aria-hidden="true" />
            Weekdays
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: WEEKEND }} aria-hidden="true" />
            Weekends
          </li>
        </ul>
      </figcaption>
    </figure>
  )
}
