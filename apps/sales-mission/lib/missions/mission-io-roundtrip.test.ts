import { describe, expect, it } from "vitest"
import * as XLSX from "xlsx"
import { buildImportColumns, parseRow, type RawRow } from "./mission-io"
import type { FormField } from "./form-fields"

/**
 * The template and the parser have to agree.
 *
 * A template whose own example row is rejected teaches a format the importer
 * refuses, which is worse than shipping no template at all. This writes a real
 * workbook the way the route does, reads it back the way the modal does, and
 * runs the result through the same validation the server uses.
 */

function field(overrides: Partial<FormField> & { reportingKey: string }): FormField {
  return {
    id: `id-${overrides.reportingKey}`,
    label: overrides.reportingKey,
    fieldType: "TEXT",
    isRequired: false,
    isCore: true,
    isActive: true,
    placeholder: null,
    helpText: null,
    options: [],
    displayOrder: 10,
    ...overrides,
    allowOther: Boolean(overrides.allowOther),
  }
}

const FIELDS: FormField[] = [
  field({ reportingKey: "client_company", label: "Perusahaan klien", isRequired: true, displayOrder: 10 }),
  field({ reportingKey: "mission_type", label: "Jenis mission", fieldType: "SELECT", isRequired: true, options: ["Meeting", "Visit"], displayOrder: 20 }),
  field({ reportingKey: "location", label: "Lokasi", displayOrder: 30 }),
  field({ reportingKey: "date", label: "Tanggal", fieldType: "DATE", isRequired: true, displayOrder: 40 }),
  field({ reportingKey: "start_time", label: "Jam mulai", fieldType: "TIME", isRequired: true, displayOrder: 50 }),
  field({ reportingKey: "end_time", label: "Jam selesai", fieldType: "TIME", displayOrder: 60 }),
  field({ reportingKey: "primary_sales", label: "Sales utama", fieldType: "SELECT", isRequired: true, displayOrder: 70 }),
  field({ reportingKey: "supporting_sales", label: "Sales pendukung", fieldType: "MULTI_SELECT", displayOrder: 80 }),
  field({ reportingKey: "contact_email", label: "Email", displayOrder: 90 }),
  field({ reportingKey: "budget", label: "Budget", isCore: false, fieldType: "CURRENCY", displayOrder: 100 }),
  field({ reportingKey: "channel", label: "Kanal", isCore: false, fieldType: "MULTI_SELECT", options: ["Email", "Telepon"], displayOrder: 110 }),
]

/** Mirrors the template route, including the " *" it appends to required headers. */
function writeTemplate(columns: ReturnType<typeof buildImportColumns>) {
  const sheet = XLSX.utils.aoa_to_sheet([
    columns.map((column) => (column.required ? `${column.header} *` : column.header)),
    columns.map((column) => column.example),
  ])
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, "Mission")
  return XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer
}

/** Mirrors the modal, including stripping the required marker off headers. */
function readTemplate(buffer: ArrayBuffer): RawRow[] {
  const book = XLSX.read(buffer, { type: "array" })
  const sheet = book.Sheets[book.SheetNames[0]]
  const parsed = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false })
  return parsed.map((row) => {
    const next: RawRow = {}
    for (const [key, value] of Object.entries(row)) {
      next[key.replace(/\s*\*\s*$/, "").trim()] = String(value ?? "").trim()
    }
    return next
  })
}

describe("template round-trip", () => {
  const columns = buildImportColumns(FIELDS)
  const rows = readTemplate(writeTemplate(columns))

  it("survives a real write and read", () => {
    expect(rows).toHaveLength(1)
  })

  it("strips the required marker so headers match the parser", () => {
    // The header reads "Tanggal *" in Excel but the parser looks for "Tanggal".
    expect(Object.keys(rows[0])).toContain("Tanggal")
    expect(Object.keys(rows[0]).some((key) => key.endsWith("*"))).toBe(false)
  })

  it("accepts its own example row with no issues at all", () => {
    const { issues } = parseRow(rows[0], 2, columns, FIELDS, ["Meeting", "Visit"])
    expect(issues).toEqual([])
  })

  it("reads the example row into the values it advertises", () => {
    const { row } = parseRow(rows[0], 2, columns, FIELDS, ["Meeting", "Visit"])
    expect(row.missionType).toBe("Meeting")
    expect(row.date).toBe("2026-09-15")
    expect(row.startTime).toBe("09:30")
    expect(row.primarySalesEmail).toBe("yulia@werkudara.com")
    expect(row.supportingSalesEmails).toEqual(["budi@werkudara.com", "sari@werkudara.com"])
    expect(row.custom.channel).toEqual(["Email", "Telepon"])
  })
})
