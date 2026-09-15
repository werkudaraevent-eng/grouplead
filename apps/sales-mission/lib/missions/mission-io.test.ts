import { describe, expect, it } from "vitest"
import {
  SALES_EMAIL_COLUMN,
  SUPPORTING_EMAILS_COLUMN,
  buildImportColumns,
  findInFileClashes,
  normaliseDate,
  normaliseTime,
  parseRow,
  splitList,
  type ParsedRow,
} from "./mission-io"
import type { FormField } from "./form-fields"

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
    options: [], allowOther: false,
    displayOrder: 10,
    ...overrides,
  }
}

const FIELDS: FormField[] = [
  field({ reportingKey: "client_company", label: "Perusahaan klien", isRequired: true, displayOrder: 10 }),
  field({ reportingKey: "mission_type", label: "Jenis mission", fieldType: "SELECT", isRequired: true, options: ["Meeting", "Visit"], allowOther: false, displayOrder: 20 }),
  field({ reportingKey: "date", label: "Tanggal", fieldType: "DATE", isRequired: true, displayOrder: 30 }),
  field({ reportingKey: "start_time", label: "Jam mulai", fieldType: "TIME", isRequired: true, displayOrder: 40 }),
  field({ reportingKey: "end_time", label: "Jam selesai", fieldType: "TIME", displayOrder: 50 }),
  field({ reportingKey: "primary_sales", label: "Sales utama", fieldType: "SELECT", isRequired: true, displayOrder: 60 }),
  field({ reportingKey: "supporting_sales", label: "Sales pendukung", fieldType: "MULTI_SELECT", displayOrder: 70 }),
]

const COLUMNS = buildImportColumns(FIELDS)
const TYPES = ["Meeting", "Visit"]

function rowFrom(overrides: Record<string, string> = {}) {
  return {
    "Perusahaan klien": "PT Arunika",
    "Jenis mission": "Meeting",
    Tanggal: "2026-09-15",
    "Jam mulai": "09:30",
    [SALES_EMAIL_COLUMN]: "yulia@werkudara.com",
    ...overrides,
  }
}

describe("buildImportColumns", () => {
  it("replaces the two sales pickers with email columns", () => {
    const headers = COLUMNS.map((c) => c.header)
    // A name cannot resolve to a user id, and this CRM has three "Dimas".
    expect(headers).toContain(SALES_EMAIL_COLUMN)
    expect(headers).toContain(SUPPORTING_EMAILS_COLUMN)
    expect(headers).not.toContain("Sales utama")
  })

  it("follows the tenant's own labels and order", () => {
    const renamed = buildImportColumns([
      field({ reportingKey: "client_company", label: "Nama klien", displayOrder: 20 }),
      field({ reportingKey: "location", label: "Kota", displayOrder: 10 }),
    ])
    expect(renamed.map((c) => c.header)).toEqual(["Kota", "Nama klien"])
  })

  it("skips archived fields", () => {
    const columns = buildImportColumns([field({ reportingKey: "location", label: "Lokasi", isActive: false })])
    expect(columns).toHaveLength(0)
  })

  it("carries the configured choices onto the column", () => {
    expect(COLUMNS.find((c) => c.key === "mission_type")?.options).toEqual(["Meeting", "Visit"])
  })
})

describe("normaliseDate", () => {
  it("keeps an ISO date", () => {
    expect(normaliseDate("2026-09-15")).toBe("2026-09-15")
  })

  it("reads an Excel serial without shifting by the server timezone", () => {
    // 46280 is 2026-09-15 in Excel's 1900 system, verified by round-trip.
    expect(normaliseDate("46280")).toBe("2026-09-15")
  })

  it("reads day-first text dates", () => {
    expect(normaliseDate("15/09/2026")).toBe("2026-09-15")
    expect(normaliseDate("5-9-2026")).toBe("2026-09-05")
  })

  it("returns junk unchanged so the caller can report it", () => {
    expect(normaliseDate("besok")).toBe("besok")
  })
})

describe("normaliseTime", () => {
  it("accepts the shapes people actually type", () => {
    expect(normaliseTime("09:30")).toBe("09:30")
    expect(normaliseTime("9:30")).toBe("09:30")
    expect(normaliseTime("09.30")).toBe("09:30")
  })

  it("reads an Excel time fraction", () => {
    expect(normaliseTime("0.395833333")).toBe("09:30")
  })
})

describe("splitList", () => {
  it("splits on comma, semicolon and newline", () => {
    expect(splitList("a@x.com, b@x.com;c@x.com\nd@x.com")).toEqual([
      "a@x.com", "b@x.com", "c@x.com", "d@x.com",
    ])
  })

  it("drops empty entries from trailing separators", () => {
    expect(splitList("a@x.com, ,")).toEqual(["a@x.com"])
  })
})

describe("parseRow", () => {
  it("accepts a well-formed row", () => {
    const { row, issues } = parseRow(rowFrom(), 2, COLUMNS, FIELDS, TYPES)
    expect(issues).toEqual([])
    expect(row.clientCompanyName).toBe("PT Arunika")
    expect(row.primarySalesEmail).toBe("yulia@werkudara.com")
  })

  it("reports every problem at once rather than one per upload", () => {
    const { issues } = parseRow(
      rowFrom({ Tanggal: "besok", "Jam mulai": "pagi", "Jenis mission": "Audit" }),
      2, COLUMNS, FIELDS, TYPES
    )
    expect(issues.map((i) => i.column).sort()).toEqual(["Jam mulai", "Jenis mission", "Tanggal"])
  })

  it("enforces whatever the admin made required", () => {
    const { issues } = parseRow(rowFrom({ "Perusahaan klien": "" }), 2, COLUMNS, FIELDS, TYPES)
    expect(issues.some((i) => i.column === "Perusahaan klien")).toBe(true)
  })

  it("refuses a mission type outside the tenant's configured list", () => {
    const { issues } = parseRow(rowFrom({ "Jenis mission": "Audit" }), 2, COLUMNS, FIELDS, TYPES)
    expect(issues[0].message).toContain("bukan pilihan yang ada")
  })

  it("refuses an end time at or before the start", () => {
    const { issues } = parseRow(rowFrom({ "Jam selesai": "09:30" }), 2, COLUMNS, FIELDS, TYPES)
    expect(issues.some((i) => i.message.includes("setelah jam mulai"))).toBe(true)
  })

  it("refuses the primary sales appearing in the supporting list", () => {
    const { issues } = parseRow(
      rowFrom({ [SUPPORTING_EMAILS_COLUMN]: "yulia@werkudara.com" }),
      2, COLUMNS, FIELDS, TYPES
    )
    expect(issues.some((i) => i.message.includes("sekaligus"))).toBe(true)
  })

  it("lowercases emails so casing cannot split one person into two", () => {
    const { row } = parseRow(rowFrom({ [SALES_EMAIL_COLUMN]: "Yulia@Werkudara.com" }), 2, COLUMNS, FIELDS, TYPES)
    expect(row.primarySalesEmail).toBe("yulia@werkudara.com")
  })

  it("normalises dates and times while parsing", () => {
    const { row, issues } = parseRow(
      rowFrom({ Tanggal: "15/09/2026", "Jam mulai": "9.30" }), 2, COLUMNS, FIELDS, TYPES
    )
    expect(issues).toEqual([])
    expect(row.date).toBe("2026-09-15")
    expect(row.startTime).toBe("09:30")
  })

  it("reads custom fields by their configured label and type", () => {
    const withCustom = [
      ...FIELDS,
      field({ reportingKey: "budget", label: "Budget", isCore: false, fieldType: "CURRENCY", displayOrder: 80 }),
      field({ reportingKey: "channel", label: "Kanal", isCore: false, fieldType: "MULTI_SELECT", options: ["Email", "Telepon"], allowOther: false, displayOrder: 90 }),
      field({ reportingKey: "urgent", label: "Mendesak", isCore: false, fieldType: "BOOLEAN", displayOrder: 100 }),
    ]
    const columns = buildImportColumns(withCustom)
    const { row, issues } = parseRow(
      { ...rowFrom(), Budget: "15000000", Kanal: "Email, Telepon", Mendesak: "ya" },
      2, columns, withCustom, TYPES
    )
    expect(issues).toEqual([])
    expect(row.custom).toEqual({ budget: "15000000", channel: ["Email", "Telepon"], urgent: true })
  })

  it("checks the salutation against the tenant's configured list", () => {
    const withSalutation = [
      ...FIELDS,
      field({ reportingKey: "contact_salutation", label: "Sapaan", fieldType: "SELECT", options: ["Bapak", "Ibu"], allowOther: false, displayOrder: 65 }),
    ]
    const columns = buildImportColumns(withSalutation)

    const ok = parseRow({ ...rowFrom(), Sapaan: "Ibu" }, 2, columns, withSalutation, TYPES)
    expect(ok.issues).toEqual([])
    expect(ok.row.contactSalutation).toBe("Ibu")

    const bad = parseRow({ ...rowFrom(), Sapaan: "Tuan" }, 2, columns, withSalutation, TYPES)
    expect(bad.issues.some((i) => i.column === "Sapaan" && i.message.includes("Tuan"))).toBe(true)
  })

  it("refuses an unknown option on a custom multi-select", () => {
    const withCustom = [
      ...FIELDS,
      field({ reportingKey: "channel", label: "Kanal", isCore: false, fieldType: "MULTI_SELECT", options: ["Email"], allowOther: false, displayOrder: 90 }),
    ]
    const { issues } = parseRow(
      { ...rowFrom(), Kanal: "Email, Merpati" },
      2, buildImportColumns(withCustom), withCustom, TYPES
    )
    expect(issues.some((i) => i.message.includes("Merpati"))).toBe(true)
  })
})

describe("findInFileClashes", () => {
  const row = (n: number, email: string, date: string, start: string) =>
    ({ row: n, primarySalesEmail: email, date, startTime: start } as ParsedRow)

  it("catches the same person booked twice at once in one file", () => {
    const clashes = findInFileClashes([
      row(2, "a@x.com", "2026-09-15", "09:30"),
      row(3, "a@x.com", "2026-09-15", "09:30"),
    ])
    expect(clashes).toHaveLength(1)
    expect(clashes[0].row).toBe(3)
    expect(clashes[0].message).toContain("baris 2")
  })

  it("allows the same person at different times, and different people at once", () => {
    expect(findInFileClashes([
      row(2, "a@x.com", "2026-09-15", "09:30"),
      row(3, "a@x.com", "2026-09-15", "14:00"),
      row(4, "b@x.com", "2026-09-15", "09:30"),
    ])).toEqual([])
  })

  it("ignores rows too incomplete to compare", () => {
    expect(findInFileClashes([row(2, "", "", ""), row(3, "", "", "")])).toEqual([])
  })
})
