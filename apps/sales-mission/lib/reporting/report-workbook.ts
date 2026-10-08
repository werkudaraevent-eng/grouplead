import * as XLSX from "xlsx"
import { toCsv } from "@/lib/reporting/kpi"
import { csvRows, type ExportLink, type ReportExportSheets } from "@/lib/reporting/report-export"

/**
 * The visit-report export written as files: the workbook people open in
 * Excel, and the CSV a machine reads. Kept apart from the route so the bytes
 * that land on someone's desk can be produced and read back by a script or a
 * test without a request.
 */

/**
 * The workbook: Laporan, Kontak and — only when there is something to say —
 * Catatan pendukung. An empty third sheet reads as a feature that failed
 * rather than a team that wrote no notes.
 */
export function reportWorkbook(sheets: ReportExportSheets): Buffer {
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, toSheet(sheets.laporan, sheets.numericColumns, sheets.laporanLinks), "Laporan")
  XLSX.utils.book_append_sheet(book, toSheet(sheets.kontak), "Kontak")
  if (sheets.catatan.length > 1) {
    XLSX.utils.book_append_sheet(book, toSheet(sheets.catatan), "Catatan pendukung")
  }
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer
}

/**
 * The CSV: sheet one alone, since CSV has no second sheet, with each link
 * written after its cell's text (`csvRows`). The BOM is the caller's, so
 * Excel reads the UTF-8.
 */
export function reportCsv(sheets: ReportExportSheets): string {
  return toCsv(csvRows(sheets.laporan, sheets.laporanLinks))
}

/**
 * One sheet: columns wide enough to read without being dragged, the numeric
 * columns typed as numbers so a total is a total rather than a concatenation,
 * and every linked cell a real hyperlink (`cell.l`), which the community
 * edition of SheetJS writes. It does not write cell styles, so a link is not
 * painted blue; its tooltip says what it opens. A cell that only looks like a
 * number (a phone number in a renamed column) is left as text.
 *
 * `!freeze` asks for the header row to stay put while scrolling; SheetJS
 * 0.18.5 community does not write panes, so today Excel opens the file
 * unfrozen.
 */
function toSheet(
  rows: string[][],
  numericColumns: Set<string> = new Set(),
  links: (ExportLink | null)[][] = []
): XLSX.WorkSheet {
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
  links.forEach((row, r) =>
    row.forEach((link, c) => {
      const cell = link ? sheet[XLSX.utils.encode_cell({ r, c })] : undefined
      if (link && cell) cell.l = { Target: link.target, Tooltip: link.tooltip }
    })
  )
  sheet["!cols"] = header.map((name) => ({ wch: Math.min(Math.max(name.length + 2, 16), 48) }))
  sheet["!freeze"] = { xSplit: 0, ySplit: 1 }
  return sheet
}
