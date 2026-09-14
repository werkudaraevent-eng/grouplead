import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { listReportRecords } from "@/lib/reporting/report-queries"
import { currentMonthRange, filterByRange, toCsv, toCsvRows } from "@/lib/reporting/kpi"

export const dynamic = "force-dynamic"

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * CSV export of visit reports for a date range.
 *
 * Tenant-scoped through the same access check as every page — an export is a
 * bulk read, which makes it exactly the wrong place to trust a query parameter
 * about whose data to return.
 */
export async function GET(request: Request) {
  const access = await getSalesMissionAccess()
  if (!access) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 })
  }

  // The app gate alone is not enough here. This URL downloads every submitted
  // visit report in the tenant, so it needs the same reporting grant as the
  // screen that links to it — otherwise revoking Laporan hides the button and
  // leaves the data one address away.
  if (!(await canPerform(access, "sales_mission_result", "read"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const url = new URL(request.url)
  const fallback = currentMonthRange(new Date())
  const from = url.searchParams.get("from")
  const to = url.searchParams.get("to")

  const range = {
    from: from && DATE_PATTERN.test(from) ? from : fallback.from,
    to: to && DATE_PATTERN.test(to) ? to : fallback.to,
  }

  const records = filterByRange(await listReportRecords(access), range)
  const rows = toCsvRows(records)

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
        "Content-Disposition": `attachment; filename="sales-mission-${range.from}_${range.to}.xlsx"`,
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
      "Content-Disposition": `attachment; filename="sales-mission-${range.from}_${range.to}.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
