import { NextResponse } from "next/server"
import { listFormFields } from "@/lib/missions/form-field-queries"
import { missionDayKey } from "@/lib/missions/mission-calendar"
import { listReportChoices } from "@/lib/missions/report-choice-queries"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { currentMonthRange } from "@/lib/reporting/kpi"
import { parseReportQuery } from "@/lib/reporting/report-filter"
import { parseReportPageParams } from "@/lib/reporting/report-paging"
import { buildReportExport } from "@/lib/reporting/report-export"
import { loadReportExport } from "@/lib/reporting/report-export-queries"
import { listMatchingReportIds } from "@/lib/reporting/report-list-queries"
import { reportCsv, reportWorkbook } from "@/lib/reporting/report-workbook"

export const dynamic = "force-dynamic"

/**
 * Export of visit reports: what the list shows, under the same filters, with
 * everything the rep actually reported.
 *
 * Tenant-scoped through the same access check as every page — an export is a
 * bulk read, which makes it exactly the wrong place to trust a query parameter
 * about whose data to return.
 *
 * The date range is the visit day (the reported start, else the day it was
 * sent, else the appointment), the same day the list filters on.
 *
 * Three sheets, because a report is not one row: "Laporan" is the report and
 * its form, "Kontak" the people met, "Catatan pendukung" what the rest of the
 * team wrote. CSV, which has no second sheet, is the first one — the machine
 * reading it wants the report grid, and the other two are legible only in a
 * workbook.
 *
 * Nothing is signed here. Each photo and recording is a link through the app
 * (`/workspace/lampiran`), which signs the file when it is clicked, for the
 * person clicking; the file therefore carries no storage address that works
 * without a login, and its links do not expire.
 */
export async function GET(request: Request) {
  const access = await getSalesMissionAccess()
  if (!access) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 })
  }

  // The app gate alone is not enough here. This URL downloads every visit
  // report in the tenant, so it needs the same reporting grant as the screen
  // that links to it — otherwise revoking Laporan hides the button and
  // leaves the data one address away.
  if (!(await canPerform(access, "sales_mission_result", "read"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const url = new URL(request.url)
  const params = Object.fromEntries(url.searchParams)
  const now = new Date()
  let query = parseReportQuery(params)
  const { sort } = parseReportPageParams(params)

  // The summary's links carry only from/to (or nothing) and mean "sent
  // reports in that range, this month by default". Keep that meaning when
  // nothing newer is asked for, so a bookmarked export keeps producing the
  // same file.
  const legacy = !url.searchParams.has("status") && !url.searchParams.has("date")
  if (legacy) {
    const fallback = currentMonthRange(now)
    query = {
      ...query,
      status: ["SUBMITTED", "NEEDS_CLARIFICATION"],
      date: "custom",
      from: query.from ?? fallback.from,
      to: query.to ?? fallback.to,
    }
  }

  // The tenant's own report form and vocabularies: the headers are their
  // labels, the cells their choice labels, so the file speaks the language
  // the screen does.
  const [choices, fields] = await Promise.all([
    listReportChoices(access),
    listFormFields(access, "visit_report"),
  ])
  const { ids } = await listMatchingReportIds(access, { query, sort, now })
  const rows = await loadReportExport(access, ids, choices)

  const sheets = buildReportExport(rows, fields, choices, {
    origin: url.origin,
    today: missionDayKey(now),
  })

  const stamp = query.date === "custom" && query.from && query.to ? `${query.from}_${query.to}` : missionDayKey(now)

  // Excel is what the file is opened in; CSV stays for anything that reads
  // it by machine. Same report rows either way, so the two never disagree.
  if (url.searchParams.get("format") === "xlsx") {
    const buffer = reportWorkbook(sheets)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="sales-activity-${stamp}.xlsx"`,
        "Cache-Control": "no-store",
      },
    })
  }

  const csv = reportCsv(sheets)

  // BOM so Excel opens UTF-8 correctly — without it Indonesian names with
  // accents arrive mangled, and the first thing anyone does with this file is
  // open it in Excel.
  return new NextResponse(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sales-activity-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
