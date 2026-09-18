"use client"

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"
import { formatValue } from "@/lib/reporting/widget-view"
import type { Unit } from "@/lib/reporting/cube"

/**
 * A donut with the total in the hole (or a pie, with the total in the
 * legend) and its legend as a list with shares, because a slice without
 * its number is a guess. The list sits beside the ring when the cell is
 * wide, under it when it is not.
 */
export function Donut({ slices, total, unit, ring = true }: { slices: Array<{ key: string; label: string; value: number; share: number; color: string }>; total: number; unit: Unit; ring?: boolean }) {
  if (total === 0) return <p className="text-sm text-muted-foreground">Belum ada data pada periode ini.</p>
  return (
    <div className="grid grid-cols-1 h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-2 @[380px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @[380px]:grid-rows-1">
      <div className="relative min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart accessibilityLayer>
            <Pie data={slices} dataKey="value" nameKey="label" innerRadius={ring ? "62%" : 0} outerRadius="90%" paddingAngle={ring ? 1.5 : 0.5} stroke="var(--card)" strokeWidth={2} isAnimationActive={false}>
              {slices.map((slice) => (
                <Cell key={slice.key} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                const slice = payload?.[0]?.payload as (typeof slices)[number] | undefined
                if (!active || !slice) return null
                return (
                  <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                    <p className="font-medium text-foreground">{slice.label}</p>
                    <p className="text-muted-foreground">
                      {formatValue(slice.value, unit)} · {slice.share}%
                    </p>
                  </div>
                )
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {ring && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="text-center">
              <span className="block text-2xl font-semibold tabular-nums text-foreground">{formatValue(total, unit)}</span>
              <span className="block text-[11px] text-muted-foreground">total</span>
            </span>
          </div>
        )}
      </div>
      <ul className="min-h-0 space-y-1 overflow-y-auto text-xs @[380px]:self-center" aria-label="Rincian">
        {!ring && (
          <li className="flex items-center gap-2 border-b pb-1 font-medium text-foreground">
            <span className="min-w-0 flex-1">Total</span>
            <span className="tabular-nums">{formatValue(total, unit)}</span>
            <span className="w-9" />
          </li>
        )}
        {slices.map((slice) => (
          <li key={slice.key} className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: slice.color }} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-foreground">{slice.label}</span>
            <span className="tabular-nums text-muted-foreground">{formatValue(slice.value, unit)}</span>
            <span className="w-9 text-right tabular-nums text-muted-foreground">{slice.share}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
