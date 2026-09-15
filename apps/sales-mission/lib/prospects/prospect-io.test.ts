import { describe, expect, it } from "vitest"
import { CORE_PROSPECT_FIELDS, type FormField } from "@/lib/missions/form-fields"
import { buildProspectColumns, dedupeKeys, findExistingDuplicates, findInFileDuplicates, normaliseName, parseProspectRow } from "./prospect-io"

const salutations = ["Bapak", "Ibu"]

/** The seeded prospect form, plus one custom field, as a tenant would have it. */
const fields: FormField[] = [
  ...CORE_PROSPECT_FIELDS.map((field) => ({
    id: `id-${field.reportingKey}`,
    reportingKey: field.reportingKey,
    label: field.label,
    fieldType: field.fieldType,
    isRequired: field.isRequired,
    isCore: true,
    isActive: true,
    placeholder: null,
    helpText: null,
    options: [],
    displayOrder: field.displayOrder,
  })),
  { id: "id-budget", reportingKey: "budget", label: "Budget", fieldType: "CURRENCY", isRequired: false, isCore: false, isActive: true, placeholder: null, helpText: null, options: [], displayOrder: 200 },
  { id: "id-tag", reportingKey: "tag", label: "Tag", fieldType: "MULTI_SELECT", isRequired: false, isCore: false, isActive: true, placeholder: null, helpText: null, options: ["Prioritas", "Referensi"], displayOrder: 210 },
]
const columns = buildProspectColumns(fields)
const options = { columns, fields, salutations }

const base = { industry: "", location: "", address: "", website: "", contactSalutation: "", contactJobTitle: "", contactDivision: "", contactEmail: "", notes: "", ownerEmail: "", custom: {} }

describe("buildProspectColumns", () => {
  it("follows the configured form, swapping the owner for an email column", () => {
    expect(columns.map((column) => column.header)).toEqual([
      "Perusahaan", "Industri", "Website", "Alamat jalan", "Kota", "Sapaan", "Nama kontak", "Jabatan", "Divisi", "Telepon", "Email", "Catatan", "Email pemegang", "Budget", "Tag",
    ])
    expect(columns[0].required).toBe(true)
    expect(columns.find((column) => column.key === "tag")?.options).toEqual(["Prioritas", "Referensi"])
  })

  it("carries a relabelled and tightened core field", () => {
    const relabelled = fields.map((field) => (field.reportingKey === "contact_phone" ? { ...field, label: "No. HP", isRequired: true } : field))
    const column = buildProspectColumns(relabelled).find((item) => item.key === "contact_phone")
    expect(column).toMatchObject({ header: "No. HP", required: true })
  })
})

describe("parseProspectRow", () => {
  it("reads every column, tolerating the required marker and case", () => {
    const { row, issues } = parseProspectRow(
      { "Perusahaan *": " PT Arunika ", industri: "Farmasi", Kota: "Jakarta", Telepon: "0812 3456 7890", Email: "NOFRI@arunika.co.id", Sapaan: "bapak", Website: "arunika.co.id", "Email pemegang": "Yulia@werkudara.com", Budget: "15.000.000", Tag: "Prioritas; Referensi" },
      2,
      options
    )
    expect(issues).toEqual([])
    expect(row.clientCompanyName).toBe("PT Arunika")
    expect(row.industry).toBe("Farmasi")
    expect(row.contactPhone).toBe("+6281234567890")
    expect(row.contactEmail).toBe("nofri@arunika.co.id")
    expect(row.contactSalutation).toBe("Bapak")
    expect(row.website).toBe("https://arunika.co.id")
    expect(row.ownerEmail).toBe("yulia@werkudara.com")
    expect(row.custom).toEqual({ budget: 15000000, tag: ["Prioritas", "Referensi"] })
  })

  it("collects every issue on the row", () => {
    const { issues } = parseProspectRow({ Perusahaan: "", Telepon: "081", Email: "bukan-email", Sapaan: "Tuan", Tag: "Lain" }, 5, options)
    expect(issues.map((issue) => issue.column)).toEqual(["Perusahaan", "Telepon", "Email", "Sapaan", "Tag"])
    expect(issues.every((issue) => issue.row === 5)).toBe(true)
  })

  it("enforces a core field the admin made required, under its label", () => {
    const tightened = fields.map((field) => (field.reportingKey === "contact_phone" ? { ...field, label: "No. HP", isRequired: true } : field))
    const strict = { columns: buildProspectColumns(tightened), fields: tightened, salutations }
    const { issues } = parseProspectRow({ Perusahaan: "PT A" }, 3, strict)
    expect(issues).toEqual([{ row: 3, column: "No. HP", message: "No. HP wajib diisi." }])
  })
})

describe("dedupe", () => {
  it("keys the same person the same way whatever the spelling", () => {
    const a = dedupeKeys({ clientCompanyName: "PT  Arunika Kreasi ", contactName: "Nofri Ardian", contactPhone: "081234567890" })
    const b = dedupeKeys({ clientCompanyName: "pt arunika kreasi", contactName: "nofri  ardian", contactPhone: "+62 812-3456-7890" })
    expect(a).toEqual(b)
    expect(normaliseName("  A   B ")).toBe("a b")
  })

  it("flags repeats within the file by phone or by company+contact", () => {
    const rows = [
      { row: 2, clientCompanyName: "PT A", contactName: "Ani", contactPhone: "+6281111111111" },
      { row: 3, clientCompanyName: "PT B", contactName: "Budi", contactPhone: "+6281111111111" },
      { row: 4, clientCompanyName: "pt a", contactName: "ANI", contactPhone: "" },
      { row: 5, clientCompanyName: "PT A", contactName: "", contactPhone: "" },
      { row: 6, clientCompanyName: "PT A", contactName: "", contactPhone: "" },
    ].map((row) => ({ ...base, ...row }))
    const issues = findInFileDuplicates(rows)
    expect(issues.map((issue) => issue.row)).toEqual([3, 4])
  })

  it("flags rows the list already holds", () => {
    const rows = [
      { row: 2, clientCompanyName: "PT A", contactName: "Ani", contactPhone: "+6281111111111" },
      { row: 3, clientCompanyName: "PT C", contactName: "Citra", contactPhone: "" },
    ].map((row) => ({ ...base, ...row }))
    const issues = findExistingDuplicates(rows, [
      { matchKey: "+6281111111111", clientCompanyName: "PT Lama", contactName: "Ani" },
      { matchKey: "pt c|citra", clientCompanyName: "PT C", contactName: "Citra" },
    ])
    expect(issues).toHaveLength(2)
    expect(issues[0].message).toContain("PT Lama")
  })
})
