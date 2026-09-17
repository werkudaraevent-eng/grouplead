"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { ExternalLink } from "@/components/icons"
import { PersonAvatar } from "@/components/person-avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { buildFunnelSteps } from "@/lib/prospects/prospect-funnel"
import type { ProspectFunnel } from "@/lib/prospects/prospect-page-queries"
import type { KpiSummary } from "@/lib/reporting/kpi"
import { formatValue, type DailyReportRow, type WidgetView } from "@/lib/reporting/widget-view"
import { ON_TIME_GRACE_MINUTES } from "@/lib/missions/visit-time"
import { paths } from "@/lib/paths"
import { cn } from "@/lib/utils"

/**
 * The card bodies that are not charts: a list with bars, one number, a
 * table, the day's reports, the prospect funnel, and the four old
 * metrics. Hand-drawn, in the house style, because they read better on
 * a phone than an axis.
 */

export function ListBars({ rows, unit }: { rows: Array<{ key: string; label: string; value: number; share: number }>; unit: WidgetView extends { unit: infer U } ? U : "count" | "currency" }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Belum ada data pada periode ini.</p>
  const max = rows.reduce((highest, row) => Math.max(highest, row.value), 0)
  return (
    <ol className="h-full space-y-2.5 overflow-y-auto pr-1">
      {rows.map((row) => (
        <li key={row.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 flex-1 truncate text-foreground">{row.label}</span>
            <span className="shrink-0 tabular-nums text-foreground">{formatValue(row.value, unit)}</span>
            <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">{row.share}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div className="h-full rounded-full bg-primary" style={{ width: `${max === 0 ? 0 : (row.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ol>
  )
}

export function NumberTile({ value, unit, hint }: { value: number; unit: "count" | "currency"; hint?: string }) {
  return (
    <div className="flex h-full flex-col justify-end">
      <p className="text-3xl font-semibold tracking-tight text-foreground tabular-nums @[200px]:text-4xl">{formatValue(value, unit)}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
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
