"use client"

import type { ComponentProps } from "react"
import Link from "next/link"
import { ViewLink } from "@/components/remember-view"
import { ClipboardList, Send } from "@/components/icons"
import { MissionPagination } from "@/app/workspace/activities/mission-pagination"
import { SortHeader } from "@/components/sort-header"
import { DEFAULT_REPORT_SORT, nextReportSort, reportSortParts, type ReportSort, type ReportSortColumn } from "@/lib/reporting/report-paging"
import { REPORT_STATUS_LABELS } from "@/lib/reporting/report-filter"
import type { ReportListItem } from "@/lib/reporting/report-list-queries"
import { FOLLOW_UP_STATE_LABELS, followUpState } from "@/lib/missions/follow-ups"
import { formatVisitWindow } from "@/lib/missions/visit-time"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"
import { formatNumber } from "@/lib/format/number"
import { EmptyState } from "@/app/workspace/workspace-page"
import { PersonAvatar } from "@/components/person-avatar"
import { Button } from "@/components/ui/button"
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CellBox, CellText, LIST_CELL, ListTableFrame, edgeProps, frozen } from "@/components/list-table"
import { useDrawnColumns } from "@/components/list-view/list-view-provider"
import { cn } from "@/lib/utils"
import { paths } from "@/lib/paths"
import { useRowLink } from "@/components/row-link"

/**
 * The report list: the mission table's shape (cards on a phone, from md up
 * a table whose company column is frozen while the rest scroll sideways,
 * one line per cell), every row opening the mission's detail at its report
 * card, so there is no action column. Status is a dot and a label, never a
 * pill; the one filled thing on the page is "Ekspor" in the header.
 */

const STATUS_DOT: Record<string, string> = {
  SUBMITTED: "bg-[var(--success-foreground)]",
  DRAFT: "bg-muted-foreground",
  NEEDS_CLARIFICATION: "bg-[var(--warning-foreground)]",
}

function Sort({
  column,
  label,
  sort,
  align,
  head,
}: {
  column: ReportSortColumn
  label: string
  sort: ReportSort
  align?: "left" | "right"
  head?: ComponentProps<typeof SortHeader>["head"]
}) {
  return (
    <SortHeader
      column={column}
      label={label}
      sort={sort}
      parts={reportSortParts}
      next={nextReportSort}
      defaultSort={DEFAULT_REPORT_SORT}
      defaultHint={{ column: "submitted", text: "terbaru dulu" }}
      align={align}
      head={head}
    />
  )
}

function StatusLabel({ report }: { report: ReportListItem }) {
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-2 text-sm text-foreground">
      <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_DOT[report.status] ?? "bg-muted-foreground")} />
      <span className="truncate">{REPORT_STATUS_LABELS[report.status]}</span>
    </span>
  )
}

const day = (iso: string | null) => (iso ? new Intl.DateTimeFormat("id-ID", { timeZone: MISSION_TIME_ZONE, day: "numeric", month: "short" }).format(new Date(iso)) : null)
const dayOf = (date: string) => new Intl.DateTimeFormat("id-ID", { timeZone: MISSION_TIME_ZONE, weekday: "short", day: "numeric", month: "short" }).format(new Date(`${date}T00:00:00+07:00`))

/** When the visit happened: the reported window, else the appointment. */
function visitWhen(report: ReportListItem): string {
  if (report.actualStart) return formatVisitWindow(report.actualStart, report.actualEnd)
  if (report.scheduledStart) return `${day(report.scheduledStart)} · jadwal`
  return "Belum dijadwalkan"
}

/** Where the next action stands: open or late with its day and owner, or how it ended. */
function followUpLine(report: ReportListItem, today: string): { text: string; late: boolean } | null {
  // A tracked follow-up speaks for itself.
  if (report.followUp) {
    const item = report.followUp
    const state = followUpState(item, today)
    const label = FOLLOW_UP_STATE_LABELS[state]
    const text =
      state === "done"
        ? `${label}${item.outcomeLabel ? ` · ${item.outcomeLabel.toLowerCase()}` : ""}${item.closedAt ? ` · ${day(item.closedAt)}` : ""}`
        : state === "cancelled"
          ? label
          : `${label}${item.dueDate ? ` · ${dayOf(item.dueDate)}` : ""}${item.ownerName ? ` · ${item.ownerName}` : ""}`
    return { text: `${text}${item.count > 1 ? ` · ${item.count} langkah` : ""}`, late: state === "late" }
  }
  if (!report.followUpDate) return null
  const late = report.followUpDate < today && report.status !== "DRAFT"
  return { text: `${late ? "Lewat" : "Follow-up"} ${dayOf(report.followUpDate)}${report.nextActionOwnerName ? ` · ${report.nextActionOwnerName}` : ""}`, late }
}

/** The follow-up as the card's line. */
function FollowUp({ report, today }: { report: ReportListItem; today: string }) {
  const line = followUpLine(report, today)
  if (!line) return null
  return <span className={cn("block text-xs", line.late ? "font-medium text-[var(--warning-foreground)]" : "text-muted-foreground")}>{line.text}</span>
}

const rupiah = (report: ReportListItem) => (report.opportunityExists ? (report.estimatedValue ? `Rp ${formatNumber(report.estimatedValue)}` : "Ada") : null)
const sentWhen = (report: ReportListItem) => (report.submittedAt ? `Dikirim ${day(report.submittedAt)}` : `Diubah ${day(report.updatedAt)}`)
const nextActionOf = (report: ReportListItem) => report.followUp?.actionLabel ?? report.nextActionLabel
const none = <span className="text-muted-foreground">—</span>

/** One desk cell of a report row, by column (see REPORT_COLUMNS). */
function ReportCell({ column, report, today, href }: { column: string; report: ReportListItem; today: string; href: string }) {
  switch (column) {
    case "client":
      return (
        <Link href={href} className="block truncate font-semibold text-foreground hover:underline">
          {report.clientCompanyName}
        </Link>
      )
    case "visit":
      return <CellText>{visitWhen(report)}</CellText>
    case "type":
      return report.missionType ? <CellText>{report.missionType}</CellText> : none
    case "sales":
      return report.primarySalesName ? (
        <span className="flex min-w-0 items-center gap-2">
          <PersonAvatar name={report.primarySalesName} avatarUrl={report.primarySalesAvatarUrl} size="sm" />
          <span className="truncate">{report.primarySalesName}</span>
        </span>
      ) : (
        <CellText className="text-muted-foreground">Tanpa sales utama</CellText>
      )
    case "outcome":
      return report.visitOutcomeLabel ? <CellText>{report.visitOutcomeLabel}</CellText> : <CellText className="text-muted-foreground">Belum diisi</CellText>
    case "interest":
      return report.interestLevelLabel ? <CellText>{report.interestLevelLabel}</CellText> : none
    case "value":
      return rupiah(report) ? <CellText className="tabular-nums">{rupiah(report)}</CellText> : none
    case "next_action": {
      // A late follow-up tints its action, so the lateness shows while the Tindak lanjut column is hidden.
      const late = followUpLine(report, today)?.late === true
      return <CellText className={late ? "font-medium text-[var(--warning-foreground)]" : undefined}>{nextActionOf(report)}</CellText>
    }
    case "follow_up": {
      const line = followUpLine(report, today)
      if (!line) return none
      return <CellText className={line.late ? "font-medium text-[var(--warning-foreground)]" : "text-muted-foreground"}>{line.text}</CellText>
    }
    case "status":
      return <StatusLabel report={report} />
    case "lead":
      return report.pushedLeadId ? (
        <span className="inline-flex min-w-0 items-center gap-1">
          <Send className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="truncate">Lead #{report.pushedLeadId}</span>
        </span>
      ) : (
        none
      )
    default:
      return null
  }
}

/** The full text of a one-line cell, on hover; the company's carries the kind and time of the visit. */
function reportCellTitle(column: string, report: ReportListItem, today: string): string | undefined {
  const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ") || undefined
  switch (column) {
    case "client":
      return join(report.clientCompanyName, report.missionType, visitWhen(report))
    case "visit":
      return visitWhen(report)
    case "type":
      return report.missionType || undefined
    case "sales":
      return report.primarySalesName ?? undefined
    case "outcome":
      return join(report.visitOutcomeLabel, report.interestLevelLabel)
    case "interest":
      return report.interestLevelLabel ?? undefined
    case "value":
      return rupiah(report) ?? undefined
    case "next_action":
    case "follow_up":
      return join(nextActionOf(report), followUpLine(report, today)?.text)
    case "status":
      return join(REPORT_STATUS_LABELS[report.status], sentWhen(report), report.pushedLeadId ? `Lead #${report.pushedLeadId}` : null)
    case "lead":
      return report.pushedLeadId ? `Lead #${report.pushedLeadId}` : undefined
    default:
      return undefined
  }
}

export function ReportTable({
  reports,
  pagination,
  filtered,
  today,
}: {
  reports: ReportListItem[]
  pagination: { page: number; size: number; total: number; sort: ReportSort }
  filtered: boolean
  today: string
}) {
  const rowLink = useRowLink()
  const drawn = useDrawnColumns("reports")
  if (reports.length === 0) {
    return filtered ? (
      <EmptyState
        title="Belum ada laporan pada saringan ini"
        description="Longgarkan saringan, atau bersihkan semuanya."
        action={<Button asChild variant="outline"><ViewLink list="reports" href={paths.reports}>Bersihkan saringan</ViewLink></Button>}
      />
    ) : (
      <EmptyState
        title="Laporan muncul begitu sales mengirimnya"
        description="Setiap kunjungan yang selesai menghasilkan satu laporan: hasil, minat, kebutuhan, kontak, dan tindak lanjut."
        steps={[
          "Sales utama membuka aktivitasnya setelah kunjungan",
          "Mengisi laporan; draf tersimpan otomatis",
          "Kirim; laporan tampil di sini dan bisa didorong ke LeadEngine",
        ]}
        action={<Button asChild variant="outline"><Link href={paths.activities()}><ClipboardList className="h-4 w-4" /> Buka daftar aktivitas</Link></Button>}
        learnHref={paths.guideSection("laporan")}
      />
    )
  }

  const href = (report: ReportListItem) => paths.activity(report.missionId, { fokus: "laporan" })

  return (
    <>
      <ul className="space-y-3 md:hidden">
        {reports.map((report) => (
          <li key={report.reportId} className="rounded-xl border bg-card">
            <Link href={href(report)} className="block p-4 transition-colors hover:bg-muted/50">
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-foreground">{report.clientCompanyName}</span>
                  <span className="block truncate text-xs text-muted-foreground">{report.missionType} · {visitWhen(report)}</span>
                </span>
                <span className="text-right"><StatusLabel report={report} /></span>
              </div>
              <p className="mt-3 text-sm text-foreground">{report.visitOutcomeLabel ?? "Hasil belum diisi"}{report.interestLevelLabel ? ` · ${report.interestLevelLabel}` : ""}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {[report.primarySalesName ?? "Tanpa sales utama", report.opportunityExists ? `Peluang${report.estimatedValue ? ` Rp ${formatNumber(report.estimatedValue)}` : ""}` : null, report.pushedLeadId ? `Lead #${report.pushedLeadId}` : null].filter(Boolean).join(" · ")}
              </p>
              <span className="mt-2 block"><FollowUp report={report} today={today} /></span>
            </Link>
          </li>
        ))}
      </ul>

      {/* The desk's table: the company frozen at the leading edge, the
          columns the person chose from the columns menu scrolling beside it,
          one line per cell on a 52dp row. No action column: the row opens
          the report. */}
      <ListTableFrame columns={drawn} hasSelect={false} footer={<MissionPagination page={pagination.page} size={pagination.size} total={pagination.total} />}>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {drawn.map((column) => {
              const lead = column.locked ? frozen("name", false) : null
              const sortColumn = column.sort as ReportSortColumn | undefined
              const head = { className: lead?.className, style: lead?.style, ...edgeProps(lead?.edge) }
              return sortColumn ? (
                <Sort key={column.id} column={sortColumn} label={column.label} sort={pagination.sort} head={head} />
              ) : (
                <TableHead key={column.id} {...head}>{column.label}</TableHead>
              )
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {reports.map((report) => (
            <TableRow key={report.reportId} onClick={rowLink(href(report))} className="cursor-pointer">
              {drawn.map((column) => {
                const lead = column.locked ? frozen("name", false) : null
                return (
                  <TableCell
                    key={column.id}
                    className={cn(LIST_CELL, lead?.className)}
                    style={lead?.style}
                    title={reportCellTitle(column.id, report, today)}
                    {...edgeProps(lead?.edge)}
                  >
                    <CellBox column={column}>
                      <ReportCell column={column.id} report={report} today={today} href={href(report)} />
                    </CellBox>
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </ListTableFrame>
      <div className="mt-3 overflow-hidden rounded-xl border bg-card md:hidden">
        <MissionPagination page={pagination.page} size={pagination.size} total={pagination.total} />
      </div>
    </>
  )
}
