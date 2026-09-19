"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { ExternalLink } from "@/components/icons"
import { PersonAvatar } from "@/components/person-avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { buildFunnelSteps } from "@/lib/prospects/prospect-funnel"
import type { ProspectFunnel } from "@/lib/prospects/prospect-page-queries"
import type { KpiSummary } from "@/lib/reporting/kpi"
import { formatValue, type DailyReportRow, type ListDrill, type ListRow, type WidgetView } from "@/lib/reporting/widget-view"
import { INDUSTRY_NONE } from "@/lib/missions/mission-filter"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useCompact } from "@/hooks/use-compact"
import { ON_TIME_GRACE_MINUTES } from "@/lib/missions/visit-time"
import { paths } from "@/lib/paths"
import { cn } from "@/lib/utils"

/**
 * The card bodies that are not charts: a list with bars, one number, a
 * table, the day's reports, the prospect funnel, and the four old
 * metrics. Hand-drawn, in the house style, because they read better on
 * a phone than an axis.
 */

/**
 * A bar list: label, value and share on one line, the bar under it.
 *
 * Google Analytics, Plausible and Vercel Analytics use this shape for
 * "top N by category" because the numbers read without a tooltip and a
 * phone fits a dozen rows. The bar is a bar, not a progress indicator:
 * 8dp tall, 2dp corners, no track behind it (a full-width track means
 * "of 100%", which is a meter's message, not a count's), its length
 * relative to the longest row and its colour the measure's own token, so
 * a card about Aktivitas is the same green as the chart above it. The top
 * rows stay, the rest fold into a muted "Lainnya" row, and "Lihat semua"
 * opens the full list in a sheet (a dialog on a desk). A row that a list
 * can answer ("which activities?") is a link into that list, narrowed to
 * the row and the period.
 */
export function ListBars({
  rows,
  all,
  unit,
  drill,
  range,
  sales,
}: {
  rows: ListRow[]
  all: ListRow[]
  unit: WidgetView extends { unit: infer U } ? U : "count" | "currency"
  drill: ListDrill | null
  range: { from: string; to: string }
  sales: string[]
}) {
  const [open, setOpen] = useState(false)
  const compact = useCompact()
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Belum ada data pada periode ini.</p>
  const max = all.reduce((highest, row) => Math.max(highest, row.value), 0)
  const hidden = all.length - rows.filter((row) => !row.folded).length
  const list = (items: ListRow[]) => (
    <ol className="space-y-1">
      {items.map((row) => (
        <BarRow key={row.key} row={row} max={max} unit={unit} href={rowHref(row, drill, range, sales)} />
      ))}
    </ol>
  )
  const title = "Semua baris"
  const description = `${all.length} baris pada periode ini`
  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* The scroller is widened by the row inset, so a hovered row reaches the card's padding without any negative margin inside the scroll box. */}
      <div className="thin-scrollbar -mx-2 min-h-0 flex-1 overflow-y-auto px-2">{list(rows)}</div>
      {hidden > 0 && (
        <div className="-mb-1 shrink-0 pt-1">
          <Button type="button" variant="ghost" size="sm" className="-ml-2 h-9 md:h-9" onClick={() => setOpen(true)}>
            Lihat semua ({all.length})
          </Button>
          {compact ? (
            <BottomSheet open={open} onOpenChange={setOpen} title={title} description={description}>
              {list(all)}
            </BottomSheet>
          ) : (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogContent className="sm:max-w-[28rem]">
                <DialogHeader>
                  <DialogTitle>{title}</DialogTitle>
                  <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <div className="thin-scrollbar -mx-2 max-h-[60dvh] overflow-y-auto px-2">{list(all)}</div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      )}
    </div>
  )
}

/** The list a row opens, narrowed to the row and the card's period and people; null when no list can. */
function rowHref(row: ListRow, drill: ListDrill | null, range: { from: string; to: string }, sales: string[]): string | null {
  if (!drill || row.folded) return null
  const period = { date: "custom", from: range.from, to: range.to }
  if (drill.list === "reports") {
    return row.key ? paths.reportList({ ...period, sales: row.key }) : null
  }
  const people = sales.length ? sales.join(",") : undefined
  switch (drill.dimension) {
    case "industry":
      return paths.activities({ ...period, sales: people, industry: row.key || INDUSTRY_NONE })
    case "mission_type":
      return row.key ? paths.activities({ ...period, sales: people, type: row.key }) : null
    case "sales":
      return row.key ? paths.activities({ ...period, sales: row.key }) : null
  }
}

function BarRow({ row, max, unit, href }: { row: ListRow; max: number; unit: "count" | "currency"; href: string | null }) {
  const body = (
    <>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className={cn("min-w-0 flex-1 truncate", row.folded ? "text-muted-foreground" : "text-foreground")}>{row.label}</span>
        <span className="shrink-0 tabular-nums text-foreground">{formatValue(row.value, unit)}</span>
        <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">{row.share}%</span>
      </div>
      <div className="mt-1 h-2" aria-hidden="true">
        <div className="h-full rounded-[2px]" style={{ width: `${max === 0 ? 0 : Math.max((row.value / max) * 100, row.value > 0 ? 1.5 : 0)}%`, background: row.color }} />
      </div>
    </>
  )
  const rowClass = "block rounded-md px-2 py-1.5"
  return (
    <li>
      {href ? (
        <Link href={href} className={cn(rowClass, "transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none")} title="Buka daftarnya">
          {body}
        </Link>
      ) : (
        <div className={rowClass}>{body}</div>
      )}
    </li>
  )
}

export function NumberTile({ value, unit, hint, spark }: { value: number; unit: "count" | "currency"; hint?: string; spark?: number[] }) {
  return (
    <div className="flex h-full flex-col justify-end">
      <p className="text-3xl font-semibold tracking-tight text-foreground tabular-nums @[200px]:text-4xl">{formatValue(value, unit)}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {spark && spark.length > 1 && <Sparkline values={spark} />}
    </div>
  )
}

/** The period day by day, as one quiet line: the shape of the number, not a second chart. */
function Sparkline({ values }: { values: number[] }) {
  const width = 100
  const height = 28
  const max = Math.max(1, ...values)
  const step = width / (values.length - 1)
  const points = values.map((value, index) => `${(index * step).toFixed(1)},${(height - (value / max) * (height - 2) - 1).toFixed(1)}`)
  const area = `M0,${height} L${points.join(" L")} L${width},${height} Z`
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="mt-3 h-7 w-full" aria-label={`Tren harian, tertinggi ${max}`} role="img">
      <path d={area} fill="var(--chart-1)" fillOpacity="0.12" />
      <polyline points={points.join(" ")} fill="none" stroke="var(--chart-1)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}

export function DataTable({ columns, rows }: { columns: Array<{ key: string; label: string; unit: "count" | "currency" | "percent" }>; rows: Array<{ label: string; cells: Array<number | null> }> }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Belum ada data pada periode ini.</p>
  return (
    <div className="h-full overflow-auto">
      <Table className="text-xs">
        <TableHeader>
          <TableRow>
            <TableHead className="h-8 px-2">&nbsp;</TableHead>
            {columns.map((column) => (
              <TableHead key={column.key} className="h-8 px-2 text-right">
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.label} className="h-9">
              <TableCell className="max-w-[10rem] truncate px-2 py-1.5 text-foreground">{row.label}</TableCell>
              {row.cells.map((cell, index) => (
                <TableCell key={columns[index]?.key ?? index} className="px-2 py-1.5 text-right tabular-nums text-foreground">
                  {formatValue(cell, columns[index]?.unit ?? "count")}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

const dayLabel = (day: string) => new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${day}T00:00:00Z`))

export function DailyReportList({
  day,
  items,
  total,
  range,
  sales,
  editing,
}: {
  day: string
  items: DailyReportRow[]
  total: number
  range: { from: string; to: string }
  sales: string[]
  editing: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const change = (next: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next)) return
    const params = new URLSearchParams(window.location.search)
    params.set("day", next)
    startTransition(() => router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false }))
  }
  const listHref = paths.reportList({ date: "custom", from: day, to: day, sales: sales.length ? sales.join(",") : undefined })

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2" onPointerDown={(event) => event.stopPropagation()}>
        <input
          type="date"
          aria-label="Tanggal laporan harian"
          value={day}
          min={range.from}
          max={range.to}
          disabled={editing}
          onChange={(event) => change(event.target.value)}
          className="h-9 rounded-md border border-input bg-field px-2.5 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
        />
        <span className={cn("text-xs text-muted-foreground", pending && "opacity-60")}>
          {total} laporan · {dayLabel(day)}
        </span>
        {total > items.length && (
          <Link href={listHref} className="ml-auto hidden text-xs font-medium text-primary hover:underline @[320px]:inline">
            Lihat semua
          </Link>
        )}
      </div>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Tidak ada laporan pada hari ini.</p>
      ) : (
        <ol className="mt-3 min-h-0 flex-1 divide-y overflow-y-auto pr-1">
          {items.map((item) => (
            <li key={item.missionId}>
              <Link
                href={paths.activity(item.missionId, { fokus: "laporan" })}
                className="flex items-center gap-3 py-2 text-sm transition-colors hover:bg-muted/50"
              >
                <span className="w-11 shrink-0 text-xs tabular-nums text-muted-foreground">{item.time ?? "—"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-foreground">{item.client}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[item.outcome, item.interest, item.opportunity ? "Peluang" : null].filter(Boolean).join(" · ") || "Belum ada hasil"}
                  </span>
                </span>
                {item.salesName && (
                  <span className="hidden items-center gap-1.5 text-xs text-muted-foreground @[420px]:flex">
                    <PersonAvatar name={item.salesName} avatarUrl={item.salesAvatarUrl} size="sm" />
                    <span className="max-w-[7rem] truncate">{item.salesName}</span>
                  </span>
                )}
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

export function FunnelBody({ counts }: { counts: ProspectFunnel }) {
  const steps = buildFunnelSteps(counts)
  if (counts.total === 0) return <p className="text-sm text-muted-foreground">Belum ada prospek pada periode ini.</p>
  return (
    <ol className="h-full space-y-2.5 overflow-y-auto pr-1">
      {steps.map((step) => (
        <li key={step.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 flex-1 truncate text-foreground">{step.label}</span>
            <span className="tabular-nums text-foreground">{step.value}</span>
            {step.pctOfPrevious !== null && <span className="w-9 text-right text-[11px] tabular-nums text-muted-foreground">{step.pctOfPrevious}%</span>}
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(step.pctOfTotal, step.value > 0 ? 2 : 0)}%` }} />
          </div>
        </li>
      ))}
    </ol>
  )
}

export function KpiStrip({ summary }: { summary: KpiSummary }) {
  const cells = [
    { label: "Next action terbuka", value: String(summary.openNextActions), hint: summary.overdueNextActions > 0 ? `${summary.overdueNextActions} lewat tenggat` : undefined },
    { label: "Kontak ditemukan", value: String(summary.contactsDiscovered) },
    { label: "Tepat waktu", value: summary.onTimeRate === null ? "—" : `${summary.onTimeRate}%`, hint: `toleransi ${ON_TIME_GRACE_MINUTES} menit` },
    { label: "Perlu klarifikasi", value: String(summary.needsClarification) },
  ]
  return (
    <dl className="grid h-full grid-cols-2 gap-x-4 gap-y-3">
      {cells.map((cell) => (
        <div key={cell.label} className="flex flex-col justify-end">
          <dt className="text-xs text-muted-foreground">{cell.label}</dt>
          <dd className="text-2xl font-semibold tabular-nums text-foreground">{cell.value}</dd>
          {cell.hint && <dd className="text-[11px] text-muted-foreground">{cell.hint}</dd>}
        </div>
      ))}
    </dl>
  )
}
