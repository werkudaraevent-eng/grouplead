import { NextResponse } from "next/server"
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
  const csv = toCsv(toCsvRows(records))

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
