import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { listFormFields } from "@/lib/missions/form-field-queries"
import { listTenantSales } from "@/lib/missions/mission-queries"
import { DEFAULT_CONTACT_SALUTATIONS, configuredOptions } from "@/lib/missions/form-fields"
import { OWNER_EMAIL_COLUMN, buildProspectColumns } from "@/lib/prospects/prospect-io"

export const dynamic = "force-dynamic"

/**
 * The prospect import template, drawn from the tenant's prospect form so a
 * relabelled, tightened or added field is a column here the same day.
 * Guarded on prospect create: it lists the team's emails.
 */
export async function GET() {
  const access = await getSalesMissionAccess()
  if (!access) return NextResponse.json({ error: "Not authorised" }, { status: 401 })
  if (!(await canPerform(access, "sales_mission_prospect", "create"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const [missionFields, prospectFields, sales] = await Promise.all([
    listFormFields(access, "mission"),
    listFormFields(access, "prospect"),
    listTenantSales(access),
  ])
  const salutations = configuredOptions(missionFields, "contact_salutation", DEFAULT_CONTACT_SALUTATIONS)
  const columns = buildProspectColumns(prospectFields)
  const requiredHeaders = columns.filter((column) => column.required).map((column) => column.header)

  const book = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet([
    columns.map((column) => (column.required ? `${column.header} *` : column.header)),
    columns.map((column) => column.example),
  ])
  sheet["!cols"] = columns.map((column) => ({ wch: Math.max(column.header.length + 2, column.example.length, 18) }))
  XLSX.utils.book_append_sheet(book, sheet, "Prospek")

  const optionRows: string[][] = [["Kolom", "Nilai yang diterima"]]
  const salutationHeader = columns.find((column) => column.key === "contact_salutation")?.header ?? "Sapaan"
  for (const salutation of salutations) optionRows.push([salutationHeader, salutation])
  for (const column of columns) {
    if (!column.options || column.key === "contact_salutation") continue
    optionRows.push([])
    for (const option of column.options) optionRows.push([column.header, option])
  }
  optionRows.push([])
  optionRows.push([OWNER_EMAIL_COLUMN, "Email anggota unit bisnis ini:"])
  for (const person of sales) optionRows.push(["", person.email ?? person.name])
  const optionSheet = XLSX.utils.aoa_to_sheet(optionRows)
  optionSheet["!cols"] = [{ wch: 28 }, { wch: 44 }]
  XLSX.utils.book_append_sheet(book, optionSheet, "Pilihan")

  const guide: string[][] = [
    ["Cara mengisi template import prospek"],
    [""],
    ["UMUM"],
    ["  Baris 1 adalah judul kolom. Jangan diubah atau dihapus."],
    ["  Baris 2 adalah contoh. Ganti dengan data asli, atau hapus barisnya."],
    ["  Satu prospek per baris: satu perusahaan dan satu orang yang akan dihubungi."],
    [`  Kolom bertanda * wajib diisi: ${requiredHeaders.join(", ")}. Kosongkan sel lain yang tidak Anda punya.`],
    ["  Kolom mengikuti pengaturan Form prospek; unduh ulang template setelah admin mengubahnya."],
    [""],
    ["TELEPON"],
    ["  0812 3456 7890, +62 812-3456-7890, dan 081234567890 semuanya diterima."],
    ["  Disimpan dalam satu format, jadi nomor yang sama tidak masuk dua kali."],
    [""],
    ["PILIHAN"],
    ["  Kolom pilihan hanya menerima nilai di sheet Pilihan. Pilihan ganda dipisah koma atau titik koma."],
    ["  Kolom ya/tidak menerima ya, yes, true, atau 1 untuk ya; yang lain dibaca tidak."],
    [""],
    ["DUPLIKAT"],
    ["  Baris yang teleponnya sudah ada di daftar prospek akan dilewati."],
    ["  Begitu juga baris yang nama perusahaan dan nama kontaknya sudah ada."],
    ["  Perbedaan huruf besar kecil dan spasi ganda diabaikan; tanda baca tidak."],
    [""],
    ["PEMEGANG"],
    ["  Isi EMAIL orang yang akan menghubungi prospek ini. Lihat sheet Pilihan."],
    ["  Kosongkan untuk memakai pemegang yang dipilih saat import."],
    [""],
    ["PERUSAHAAN"],
    ["  Kalau namanya persis sama dengan perusahaan di LeadEngine, prospek tertaut ke sana."],
    ["  Import tidak pernah membuat perusahaan baru di CRM."],
    [""],
    ["SEBELUM IMPORT"],
    ["  File dicek dulu seluruhnya. Baris bermasalah dan duplikat ditampilkan"],
    ["  beserta alasannya, dan hanya baris yang lolos yang akan dibuat."],
  ]
  const guideSheet = XLSX.utils.aoa_to_sheet(guide)
  guideSheet["!cols"] = [{ wch: 84 }]
  XLSX.utils.book_append_sheet(book, guideSheet, "Petunjuk")

  const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="template-import-prospek.xlsx"',
      "Cache-Control": "no-store",
    },
  })
}
