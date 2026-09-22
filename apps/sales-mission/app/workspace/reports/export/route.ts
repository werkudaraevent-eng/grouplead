import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { signAudioUrls } from "@/lib/audio/audio-storage"
import { listFormFields } from "@/lib/missions/form-field-queries"
import { missionDayKey } from "@/lib/missions/mission-calendar"
import { listReportChoices } from "@/lib/missions/report-choice-queries"
import { signPhotoUrls } from "@/lib/photos/photo-storage"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { currentMonthRange, toCsv } from "@/lib/reporting/kpi"
import { parseReportQuery } from "@/lib/reporting/report-filter"
import { parseReportPageParams } from "@/lib/reporting/report-paging"
import { buildReportExport, collectAttachmentPaths, EXPORT_LINK_SECONDS } from "@/lib/reporting/report-export"
import { loadReportExport } from "@/lib/reporting/report-export-queries"
import { listMatchingReportIds } from "@/lib/reporting/report-list-queries"

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

  // Every attachment of the whole export signed in one pass, a week long: the
  // bucket is private, and the file is read days after it was downloaded.
  const { photoPaths, audioPaths } = collectAttachmentPaths(rows, fields)
  const [photoUrls, audioUrls] = await Promise.all([
    signPhotoUrls(access, photoPaths, EXPORT_LINK_SECONDS),
    signAudioUrls(access, audioPaths, EXPORT_LINK_SECONDS),
  ])

  const sheets = buildReportExport(rows, fields, choices, {
    origin: url.origin,
    signedUrls: new Map([...photoUrls, ...audioUrls]),
    today: missionDayKey(now),
  })

  const stamp = query.date === "custom" && query.from && query.to ? `${query.from}_${query.to}` : missionDayKey(now)

  // Excel is what the file is opened in; CSV stays for anything that reads
  // it by machine. Same report rows either way, so the two never disagree.
  if (url.searchParams.get("format") === "xlsx") {
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, toSheet(sheets.laporan, sheets.numericColumns), "Laporan")
    XLSX.utils.book_append_sheet(book, toSheet(sheets.kontak), "Kontak")
    // Only when there is something to say: an empty third sheet reads as a
    // feature that failed rather than a team that wrote no notes.
    if (sheets.catatan.length > 1) {
      XLSX.utils.book_append_sheet(book, toSheet(sheets.catatan), "Catatan pendukung")
    }
    const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="sales-activity-${stamp}.xlsx"`,
        "Cache-Control": "no-store",
      },
    })
  }

  const csv = toCsv(sheets.laporan)

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

/**
 * One sheet: the header frozen, columns wide enough to read without being
 * dragged, and the numeric columns typed as numbers so a total is a total
 * rather than a concatenation. A cell that only looks like a number (a phone
 * number in a renamed column) is left as text.
 */
function toSheet(rows: string[][], numericColumns: Set<string> = new Set()): XLSX.WorkSheet {
  const [header, ...body] = rows
  const numericIndexes = new Set(
    header.map((name, index) => (numericColumns.has(name) ? index : -1)).filter((index) => index >= 0)
  )

  const typed = body.map((row) =>
    row.map((cell, index) => {
      if (!numericIndexes.has(index) || cell === "") return cell
      const value = Number(cell)
      return Number.isFinite(value) ? value : cell
    })
  )

  const sheet = XLSX.utils.aoa_to_sheet([header, ...typed])
  sheet["!cols"] = header.map((name) => ({ wch: Math.min(Math.max(name.length + 2, 16), 48) }))
  sheet["!freeze"] = { xSplit: 0, ySplit: 1 }
  return sheet
}
