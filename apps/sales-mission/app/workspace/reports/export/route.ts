import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { listReportChoices } from "@/lib/missions/report-choice-queries"
import { missionDayKey } from "@/lib/missions/mission-calendar"
import { currentMonthRange, toCsv, toCsvRows } from "@/lib/reporting/kpi"
import { parseReportQuery } from "@/lib/reporting/report-filter"
import { parseReportPageParams } from "@/lib/reporting/report-paging"
import { listMatchingReportIds, listReportsByIds, toReportRecord } from "@/lib/reporting/report-list-queries"

export const dynamic = "force-dynamic"

/**
 * Export of visit reports: what the list shows, under the same filters.
 *
 * Tenant-scoped through the same access check as every page — an export is a
 * bulk read, which makes it exactly the wrong place to trust a query parameter
 * about whose data to return.
 *
 * The date range is the visit day (the reported start, else the day it was
 * sent, else the appointment), the same day the list filters on.
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

  const choices = await listReportChoices(access)
  const { ids } = await listMatchingReportIds(access, { query, sort, now })
  const items = await listReportsByIds(access, ids, choices)
  const rows = toCsvRows(items.map(toReportRecord))
  const stamp = query.date === "custom" && query.from && query.to ? `${query.from}_${query.to}` : missionDayKey(now)

  // Excel is what the file is opened in; CSV stays for anything that reads
  // it by machine. Same rows either way, so the two never disagree.
  if (url.searchParams.get("format") === "xlsx") {
    const [header, ...body] = rows
    const numeric = new Set(["estimated_value", "contacts_met"])
    const typed = body.map((row) => row.map((cell, index) => (numeric.has(header[index]) && cell !== "" ? Number(cell) : cell)))
    const sheet = XLSX.utils.aoa_to_sheet([header, ...typed])
    sheet["!cols"] = header.map((name) => ({ wch: Math.max(name.length + 2, 16) }))
    sheet["!freeze"] = { xSplit: 0, ySplit: 1 }
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, sheet, "Laporan kunjungan")
    const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="sales-activity-${stamp}.xlsx"`,
        "Cache-Control": "no-store",
      },
    })
  }

  const csv = toCsv(rows)

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
