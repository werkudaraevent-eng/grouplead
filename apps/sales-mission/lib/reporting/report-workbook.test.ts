import { describe, expect, it } from "vitest"
import * as XLSX from "xlsx"
import type { ReportExportSheets } from "./report-export"
import { reportCsv, reportWorkbook } from "./report-workbook"

const PHOTO = "https://mission.example/workspace/lampiran?jenis=foto&berkas=a/b/c.jpg"
const REPORT = "https://mission.example/workspace/activities/m1?fokus=laporan"

function sheets(): ReportExportSheets {
  return {
    laporan: [
      ["Perusahaan", "Estimasi nilai", "Foto bukti kunjungan 1", "Tautan laporan"],
      ["PT Arunika", "15000000", "depan-kantor.jpg", REPORT],
    ],
    laporanLinks: [
      [null, null, null, null],
      [null, null, { target: PHOTO, tooltip: "Buka foto (perlu masuk ke Sales Activity)" }, { target: REPORT, tooltip: "Buka laporan" }],
    ],
    kontak: [["Nama"]],
    catatan: [["Catatan"]],
    numericColumns: new Set(["Estimasi nilai"]),
  }
}

/**
 * A link target as read back. The file holds correct XML (`&` written once as
 * `&amp;`, which Excel decodes), but SheetJS's reader does not decode a
 * relationship's Target, so the test does.
 */
const target = (cell: XLSX.CellObject) => cell.l?.Target.replaceAll("&amp;", "&")

describe("reportWorkbook", () => {
  it("writes linked cells as real hyperlinks that survive a round trip, text unchanged", () => {
    const book = XLSX.read(reportWorkbook(sheets()), { type: "buffer" })
    const laporan = book.Sheets["Laporan"]
    expect(laporan["C2"].v).toBe("depan-kantor.jpg")
    expect(target(laporan["C2"])).toBe(PHOTO)
    expect(laporan["C2"].l?.Tooltip).toBe("Buka foto (perlu masuk ke Sales Activity)")
    expect(laporan["D2"].v).toBe(REPORT)
    expect(target(laporan["D2"])).toBe(REPORT)
    expect(laporan["A2"].l).toBeUndefined()
    expect(laporan["C1"].l).toBeUndefined()
  })

  it("still types a numeric column as a number", () => {
    const book = XLSX.read(reportWorkbook(sheets()), { type: "buffer" })
    expect(book.Sheets["Laporan"]["B2"]).toMatchObject({ t: "n", v: 15000000 })
  })

  it("leaves Catatan pendukung out when nobody wrote a note", () => {
    const book = XLSX.read(reportWorkbook(sheets()), { type: "buffer" })
    expect(book.SheetNames).toEqual(["Laporan", "Kontak"])
  })
})

describe("reportCsv", () => {
  it("writes the link after the name, and a cell that is its own link once", () => {
    const csv = reportCsv(sheets())
    expect(csv.split("\r\n")[1]).toBe(`"PT Arunika","15000000","depan-kantor.jpg · ${PHOTO}","${REPORT}"`)
  })
})
