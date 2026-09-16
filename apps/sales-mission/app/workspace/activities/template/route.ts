import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { listFormFields } from "@/lib/missions/form-field-queries"
import { listTenantSales } from "@/lib/missions/mission-queries"
import { buildImportColumns, SALES_EMAIL_COLUMN, SUPPORTING_EMAILS_COLUMN } from "@/lib/missions/mission-io"

export const dynamic = "force-dynamic"

/**
 * The import template, built from this tenant's own field configuration.
 *
 * Not a static file. An admin can rename a field, reorder it, make it required,
 * change the mission types, or add fields of their own, and a template that did
 * not follow would teach a format the importer then rejects.
 *
 * Guarded on mission `create`: the sheet lists every colleague's email and every
 * configured option, which is the tenant's directory in a downloadable file.
 */
export async function GET() {
  const access = await getSalesMissionAccess()
  if (!access) return NextResponse.json({ error: "Not authorised" }, { status: 401 })

  if (!(await canPerform(access, "sales_mission_mission", "create"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const [fields, sales] = await Promise.all([
    listFormFields(access, "mission"),
    listTenantSales(access),
  ])

  const columns = buildImportColumns(fields)
  const book = XLSX.utils.book_new()

  // ── Sheet 1: the grid people actually fill in ──
  const sheet = XLSX.utils.aoa_to_sheet([
    columns.map((column) => (column.required ? `${column.header} *` : column.header)),
    columns.map((column) => column.example),
  ])
  sheet["!cols"] = columns.map((column) => ({
    wch: Math.max(column.header.length + 2, column.example.length, 18),
  }))
  XLSX.utils.book_append_sheet(book, sheet, "Aktivitas")

  // ── Sheet 2: the values the importer will accept ──
  // Copy-paste beats guessing, and it keeps this list honest: it is read from
  // the same configuration the parser validates against.
  const optionRows: string[][] = [["Kolom", "Nilai yang diterima"]]
  for (const column of columns) {
    if (!column.options) continue
    for (const option of column.options) optionRows.push([column.header, option])
  }
  optionRows.push([])
  optionRows.push([SALES_EMAIL_COLUMN, "Email anggota unit bisnis ini:"])
  for (const person of sales) optionRows.push(["", person.email ?? person.name])

  const optionSheet = XLSX.utils.aoa_to_sheet(optionRows)
  optionSheet["!cols"] = [{ wch: 28 }, { wch: 44 }]
  XLSX.utils.book_append_sheet(book, optionSheet, "Pilihan")

  // ── Sheet 3: how the parser actually reads each cell ──
  const requiredList = columns.filter((c) => c.required).map((c) => `  - ${c.header}`)
  const guide: string[][] = [
    ["Cara mengisi template import aktivitas"],
    [""],
    ["UMUM"],
    ["  Baris 1 adalah judul kolom. Jangan diubah atau dihapus."],
    ["  Baris 2 adalah contoh. Ganti dengan data asli, atau hapus barisnya."],
    ["  Satu aktivitas per baris. Kosongkan sel yang tidak Anda punya."],
    ["  Tanda * pada judul kolom berarti kolom itu wajib diisi."],
    [""],
    ["KOLOM WAJIB"],
    ...requiredList.map((line) => [line]),
    [""],
    ["TANGGAL"],
    ["  Format terbaik: 2026-09-15."],
    ["  Sel tanggal Excel biasa juga diterima."],
    ["  15/09/2026 juga dibaca sebagai 15 September 2026."],
    [""],
    ["JAM"],
    ["  Format terbaik: 09:30. 9:30 dan 09.30 juga diterima."],
    ["  Jam selesai harus lebih malam dari jam mulai."],
    [""],
    ["SALES"],
    ["  Diisi EMAIL, bukan nama, karena nama bisa kembar."],
    ["  Email harus milik anggota unit bisnis ini. Lihat sheet Pilihan."],
    ["  Sales pendukung boleh lebih dari satu, pisahkan dengan koma."],
    ["  Sales utama tidak boleh ikut jadi sales pendukung."],
    [""],
    ["PERUSAHAAN KLIEN"],
    ["  Cukup ketik namanya. Kalau namanya persis sama dengan perusahaan"],
    ["  di LeadEngine, aktivitas akan otomatis tertaut ke sana."],
    ["  Import tidak pernah membuat perusahaan baru di CRM."],
    [""],
    ["PILIHAN GANDA"],
    ["  Pisahkan dengan koma: Email, Telepon"],
    ["  Nilai di luar daftar akan ditolak. Lihat sheet Pilihan."],
    [""],
    ["YA / TIDAK"],
    ["  Tulis: ya, yes, true, atau 1. Selain itu dianggap tidak."],
    [""],
    ["SEBELUM IMPORT"],
    ["  File dicek dulu seluruhnya. Baris yang bermasalah ditampilkan"],
    ["  beserta alasannya, dan hanya baris yang lolos yang akan dibuat."],
  ]

  const guideSheet = XLSX.utils.aoa_to_sheet(guide)
  guideSheet["!cols"] = [{ wch: 78 }]
  XLSX.utils.book_append_sheet(book, guideSheet, "Petunjuk")

  const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="template-import-aktivitas.xlsx"',
      "Cache-Control": "no-store",
    },
  })
}
