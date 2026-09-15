import { describe, expect, it } from "vitest"
import { dedupeKeys, findExistingDuplicates, findInFileDuplicates, normaliseName, parseProspectRow } from "./prospect-io"

const salutations = ["Bapak", "Ibu"]

describe("parseProspectRow", () => {
  it("reads every column, tolerating the required marker and case", () => {
    const { row, issues } = parseProspectRow(
      { "Perusahaan *": " PT Arunika ", industri: "Farmasi", Kota: "Jakarta", Telepon: "0812 3456 7890", Email: "NOFRI@arunika.co.id", Sapaan: "bapak", Website: "arunika.co.id", "Email pemegang": "Yulia@werkudara.com" },
      2,
      { salutations }
    )
    expect(issues).toEqual([])
    expect(row.clientCompanyName).toBe("PT Arunika")
    expect(row.industry).toBe("Farmasi")
    expect(row.contactPhone).toBe("+6281234567890")
    expect(row.contactEmail).toBe("nofri@arunika.co.id")
    expect(row.contactSalutation).toBe("Bapak")
    expect(row.website).toBe("https://arunika.co.id")
    expect(row.ownerEmail).toBe("yulia@werkudara.com")
  })

  it("collects every issue on the row", () => {
    const { issues } = parseProspectRow({ Perusahaan: "", Telepon: "081", Email: "bukan-email", Sapaan: "Tuan" }, 5, { salutations })
    expect(issues.map((issue) => issue.column)).toEqual(["Perusahaan", "Telepon", "Email", "Sapaan"])
    expect(issues.every((issue) => issue.row === 5)).toBe(true)
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
    ].map((row) => ({ industry: "", location: "", address: "", website: "", contactSalutation: "", contactJobTitle: "", contactDivision: "", contactEmail: "", notes: "", ownerEmail: "", ...row }))
    const issues = findInFileDuplicates(rows)
    expect(issues.map((issue) => issue.row)).toEqual([3, 4])
  })

  it("flags rows the list already holds", () => {
    const rows = [
      { row: 2, clientCompanyName: "PT A", contactName: "Ani", contactPhone: "+6281111111111" },
      { row: 3, clientCompanyName: "PT C", contactName: "Citra", contactPhone: "" },
    ].map((row) => ({ industry: "", location: "", address: "", website: "", contactSalutation: "", contactJobTitle: "", contactDivision: "", contactEmail: "", notes: "", ownerEmail: "", ...row }))
    const issues = findExistingDuplicates(rows, [
      { matchKey: "+6281111111111", clientCompanyName: "PT Lama", contactName: "Ani" },
      { matchKey: "pt c|citra", clientCompanyName: "PT C", contactName: "Citra" },
    ])
    expect(issues).toHaveLength(2)
    expect(issues[0].message).toContain("PT Lama")
  })
})
