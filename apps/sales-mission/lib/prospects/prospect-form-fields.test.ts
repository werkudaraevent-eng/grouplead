import { describe, expect, it } from "vitest"
import type { FormField } from "@/lib/missions/form-fields"
import { customAnswers, formatAnswer, missingRequiredCore, prospectBlocks } from "./prospect-form-fields"

function field(partial: Partial<FormField> & Pick<FormField, "reportingKey" | "displayOrder">): FormField {
  return {
    id: `id-${partial.reportingKey}`,
    label: partial.reportingKey,
    fieldType: "TEXT",
    isRequired: false,
    isCore: true,
    isActive: true,
    placeholder: null,
    helpText: null,
    options: [], allowOther: false,
    ...partial,
  }
}

describe("prospectBlocks", () => {
  it("cuts the configured order into section cards, custom fields last", () => {
    const blocks = prospectBlocks([
      field({ reportingKey: "client_company", displayOrder: 10 }),
      field({ reportingKey: "contact_name", displayOrder: 20 }),
      field({ reportingKey: "budget", displayOrder: 30, isCore: false }),
      field({ reportingKey: "notes", displayOrder: 25 }),
      field({ reportingKey: "archived", displayOrder: 5, isCore: false, isActive: false }),
    ])
    expect(blocks.map((block) => block.section)).toEqual(["Perusahaan", "Kontak", "Catatan dan pemegang", "Tambahan"])
    expect(blocks[3].fields[0].reportingKey).toBe("budget")
  })
})

describe("missingRequiredCore", () => {
  const fields = [
    field({ reportingKey: "client_company", label: "Perusahaan", displayOrder: 10, isRequired: true }),
    field({ reportingKey: "contact_phone", label: "Telepon", displayOrder: 20, isRequired: true }),
    field({ reportingKey: "owner", label: "Pemegang", displayOrder: 30 }),
  ]

  it("names the first required field left empty", () => {
    expect(missingRequiredCore(fields, { clientCompanyName: "PT A" })).toBe("Telepon")
    expect(missingRequiredCore(fields, { clientCompanyName: " " })).toBe("Perusahaan")
  })

  it("is satisfied when every required field has a value", () => {
    expect(missingRequiredCore(fields, { clientCompanyName: "PT A", contactPhone: "+628123" })).toBeNull()
  })
})

describe("formatAnswer", () => {
  it("renders each type as a reader expects", () => {
    expect(formatAnswer({ fieldType: "BOOLEAN" }, true)).toBe("Ya")
    expect(formatAnswer({ fieldType: "MULTI_SELECT" }, ["A", "B"])).toBe("A, B")
    expect(formatAnswer({ fieldType: "CURRENCY" }, 15000000)).toBe("Rp 15.000.000")
    expect(formatAnswer({ fieldType: "DATE" }, "2026-09-15")).toContain("2026")
    expect(formatAnswer({ fieldType: "TEXT" }, "halo")).toBe("halo")
  })
})

describe("customAnswers", () => {
  it("keeps only active custom fields with something to show", () => {
    const fields = [
      field({ reportingKey: "client_company", displayOrder: 10 }),
      field({ reportingKey: "budget", label: "Budget", displayOrder: 20, isCore: false, fieldType: "CURRENCY" }),
      field({ reportingKey: "tags", label: "Tag", displayOrder: 30, isCore: false, fieldType: "MULTI_SELECT" }),
      field({ reportingKey: "old", label: "Lama", displayOrder: 40, isCore: false, isActive: false }),
    ]
    const answers = customAnswers(fields, { client_company: "PT A", budget: 5000, tags: [], old: "x" })
    expect(answers.map((item) => [item.field.label, item.text])).toEqual([["Budget", "Rp 5.000"]])
  })
})
