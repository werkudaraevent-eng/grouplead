"use client"

import type { WidgetView } from "@/lib/reporting/widget-view"
import { DayBars, Lines } from "./charts/bars-and-lines"
import { Donut } from "./charts/donut"
import { DailyReportList, DataTable, FunnelBody, KpiStrip, ListBars, NumberTile } from "./charts/plain"
import { InsightWidget } from "./insight-widget"

/** One card body for one view. */
export function WidgetCard({
  view,
  range,
  sales,
  editing,
  canRegenerate,
}: {
  view: WidgetView
  range: { from: string; to: string }
  sales: string[]
  editing: boolean
  /** Pengaturan → ubah: may ask the model for today's insight again. */
  canRegenerate: boolean
}) {
  switch (view.type) {
    case "day_bars":
      return <DayBars categories={view.categories} series={view.series} values={view.values} unit={view.unit} stacked={view.stacked} horizontal={view.horizontal} />
    case "lines":
      return <Lines categories={view.categories} series={view.series} values={view.values} unit={view.unit} area={view.area} />
    case "donut":
      return <Donut slices={view.slices} total={view.total} unit={view.unit} ring={view.ring} />
    case "list_bars":
      return <ListBars rows={view.rows} all={view.all} unit={view.unit} drill={view.drill} range={range} sales={sales} />
    case "number":
      return <NumberTile value={view.value} unit={view.unit} hint={view.hint} spark={view.spark} />
    case "table":
      return <DataTable columns={view.columns} rows={view.rows} />
    case "daily":
      return <DailyReportList day={view.day} items={view.items} total={view.total} range={range} sales={sales} editing={editing} />
    case "funnel":
      return <FunnelBody counts={view.counts} />
    case "kpi_strip":
      return <KpiStrip summary={view.summary} />
    case "insight":
      return <InsightWidget initial={view.insight} canRegenerate={canRegenerate} scopeNote={view.scopeNote} />
    case "empty":
      return <p className="text-sm text-muted-foreground">{view.text}</p>
  }
}
