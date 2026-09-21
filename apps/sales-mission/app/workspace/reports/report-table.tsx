"use client"

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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { paths } from "@/lib/paths"
import { useRowLink } from "@/components/row-link"

/**
 * The report list: the mission table's shape (cards on a phone, a fixed
 * layout table from md up, one outlined action per row), every row opening
 * the mission's detail at its report card. Status is a dot and a label,
 * never a pill; the one filled thing on the page is "Ekspor" in the header.
 */

const STATUS_DOT: Record<string, string> = {
  SUBMITTED: "bg-[var(--success-foreground)]",
  DRAFT: "bg-muted-foreground",
  NEEDS_CLARIFICATION: "bg-[var(--warning-foreground)]",
}

function Sort({ column, label, sort, align }: { column: ReportSortColumn; label: string; sort: ReportSort; align?: "left" | "right" }) {
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
    />
  )
}

function StatusLabel({ report }: { report: ReportListItem }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-foreground">
      <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_DOT[report.status] ?? "bg-muted-foreground")} />
      {REPORT_STATUS_LABELS[report.status]}
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

function FollowUp({ report, today }: { report: ReportListItem; today: string }) {
  // A tracked follow-up speaks for itself: open or late with its day and owner, or how it ended.
  if (report.followUp) {
    const item = report.followUp
    const state = followUpState(item, today)
    const late = state === "late"
    const label = FOLLOW_UP_STATE_LABELS[state]
    return (
      <span className={cn("block text-xs", late ? "font-medium text-[var(--warning-foreground)]" : "text-muted-foreground")}>
        {state === "done"
          ? `${label}${item.outcomeLabel ? ` · ${item.outcomeLabel.toLowerCase()}` : ""}${item.closedAt ? ` · ${day(item.closedAt)}` : ""}`
          : state === "cancelled"
            ? label
            : `${label}${item.dueDate ? ` · ${dayOf(item.dueDate)}` : ""}${item.ownerName ? ` · ${item.ownerName}` : ""}`}
        {item.count > 1 ? ` · ${item.count} langkah` : ""}
      </span>
    )
  }
  if (!report.followUpDate) return null
  const late = report.followUpDate < today && report.status !== "DRAFT"
  return (
    <span className={cn("block text-xs", late ? "font-medium text-[var(--warning-foreground)]" : "text-muted-foreground")}>
      {late ? "Lewat" : "Follow-up"} {dayOf(report.followUpDate)}{report.nextActionOwnerName ? ` · ${report.nextActionOwnerName}` : ""}
    </span>
  )
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

      <div className="hidden rounded-xl border bg-card md:block">
        <div className="data-table-scroll overflow-x-auto rounded-xl">
          <Table className="min-w-[960px] table-fixed">
            <colgroup>
              <col />
              <col className="hidden w-[190px] xl:table-column" />
              <col className="w-[220px]" />
              <col className="hidden w-[140px] 2xl:table-column" />
              <col className="w-[200px]" />
              <col className="w-[170px]" />
            </colgroup>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead><Sort column="client" label="Perusahaan" sort={pagination.sort} /></TableHead>
                <TableHead className="hidden xl:table-cell"><Sort column="sales" label="Sales utama" sort={pagination.sort} /></TableHead>
                <TableHead><Sort column="outcome" label="Hasil" sort={pagination.sort} /></TableHead>
                <TableHead className="hidden 2xl:table-cell"><Sort column="value" label="Peluang" sort={pagination.sort} /></TableHead>
                <TableHead><Sort column="follow_up" label="Next action" sort={pagination.sort} /></TableHead>
                <TableHead><Sort column="submitted" label="Status" sort={pagination.sort} /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((report) => (
                <TableRow key={report.reportId} onClick={rowLink(href(report))} className="cursor-pointer">
                  <TableCell>
                    <Link href={href(report)} className="block truncate font-semibold text-foreground hover:underline" title={report.clientCompanyName}>{report.clientCompanyName}</Link>
                    <span className="block truncate text-xs text-muted-foreground">{report.missionType} · {visitWhen(report)}</span>
                  </TableCell>
                  <TableCell className="hidden text-sm xl:table-cell">
                    {report.primarySalesName ? (
                      <span className="flex items-center gap-2"><PersonAvatar name={report.primarySalesName} avatarUrl={report.primarySalesAvatarUrl} size="sm" /><span className="truncate" title={report.primarySalesName}>{report.primarySalesName}</span></span>
                    ) : (
                      <span className="text-muted-foreground">Tanpa sales utama</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    <span className="block truncate text-foreground">{report.visitOutcomeLabel ?? <span className="text-muted-foreground">Belum diisi</span>}</span>
                    {report.interestLevelLabel && <span className="block truncate text-xs text-muted-foreground">{report.interestLevelLabel}</span>}
                  </TableCell>
                  <TableCell className="hidden text-sm 2xl:table-cell">
                    {report.opportunityExists ? (
                      <span className="block tabular-nums text-foreground">{report.estimatedValue ? `Rp ${formatNumber(report.estimatedValue)}` : "Ada"}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    <span className="block truncate text-foreground">{report.followUp?.actionLabel ?? report.nextActionLabel}</span>
                    <FollowUp report={report} today={today} />
                  </TableCell>
                  <TableCell>
                    <StatusLabel report={report} />
                    <span className="block text-xs text-muted-foreground">
                      {report.pushedLeadId ? <span className="inline-flex items-center gap-1"><Send className="h-3 w-3" /> Lead #{report.pushedLeadId}</span> : report.submittedAt ? `Dikirim ${day(report.submittedAt)}` : `Diubah ${day(report.updatedAt)}`}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <MissionPagination page={pagination.page} size={pagination.size} total={pagination.total} />
      </div>
      <div className="mt-3 overflow-hidden rounded-xl border bg-card md:hidden">
        <MissionPagination page={pagination.page} size={pagination.size} total={pagination.total} />
      </div>
    </>
  )
}
