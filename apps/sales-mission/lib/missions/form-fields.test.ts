import { describe, expect, it } from "vitest"
import {
  CORE_MISSION_FIELDS,
  describeCoreFieldViolation,
  fieldDefinitionSchema,
  isChoiceType,
  nextDisplayOrder,
  reorderField,
  toReportingKey,
  validateFieldAnswers,
  visibleFields,
  type FormField,
} from "./form-fields"

function field(overrides: Partial<FormField> & { reportingKey: string }): FormField {
  return {
    id: `id-${overrides.reportingKey}`,
    label: overrides.reportingKey,
    fieldType: "TEXT",
    isRequired: false,
    isCore: false,
    isActive: true,
    placeholder: null,
    helpText: null,
    options: [],
    displayOrder: 10,
    ...overrides,
  }
}

describe("toReportingKey", () => {
  it("slugifies a label", () => {
    expect(toReportingKey("Budget indikatif")).toBe("budget_indikatif")
    expect(toReportingKey("  Nomor   PO  ")).toBe("nomor_po")
  })

  it("guarantees a leading letter, since the column requires one", () => {
    expect(toReportingKey("2026 target")).toMatch(/^[a-z]/)
  })

  it("strips punctuation rather than emitting an invalid key", () => {
    expect(toReportingKey("Nilai (Rp)!")).toBe("nilai_rp")
  })
})

describe("fieldDefinitionSchema", () => {
  const base = { label: "Budget", fieldType: "TEXT" as const, isRequired: false, options: [] }

  it("accepts a simple text field", () => {
    expect(fieldDefinitionSchema.safeParse(base).success).toBe(true)
  })

  it("requires at least one option on a choice field", () => {
    expect(fieldDefinitionSchema.safeParse({ ...base, fieldType: "SELECT" }).success).toBe(false)
    expect(
      fieldDefinitionSchema.safeParse({ ...base, fieldType: "SELECT", options: ["A"] }).success
    ).toBe(true)
  })

  it("rejects duplicate options", () => {
    const result = fieldDefinitionSchema.safeParse({
      ...base,
      fieldType: "MULTI_SELECT",
      options: ["A", "A"],
    })
    expect(result.success).toBe(false)
  })

  it("requires a label", () => {
    expect(fieldDefinitionSchema.safeParse({ ...base, label: "   " }).success).toBe(false)
  })
})

describe("describeCoreFieldViolation", () => {
  const core = { isCore: true, isRequired: true, fieldType: "DATE" as const }
  const custom = { isCore: false, isRequired: true, fieldType: "DATE" as const }

  it("blocks deleting a core field", () => {
    expect(describeCoreFieldViolation(core, { archive: true })).toContain("tidak bisa dihapus")
  })

  it("blocks changing a core field's type", () => {
    expect(describeCoreFieldViolation(core, { fieldType: "TEXT" })).toContain("Tipe field inti")
  })

  it("blocks loosening a required core field", () => {
    expect(describeCoreFieldViolation(core, { isRequired: false })).toContain("opsional")
  })

  it("allows tightening an optional core field", () => {
    const optionalCore = { isCore: true, isRequired: false, fieldType: "TEXT" as const }
    expect(describeCoreFieldViolation(optionalCore, { isRequired: true })).toBeNull()
  })

  it("allows relabelling and reordering, which pass no restricted change", () => {
    expect(describeCoreFieldViolation(core, {})).toBeNull()
  })

  it("never restricts a custom field", () => {
    expect(describeCoreFieldViolation(custom, { archive: true })).toBeNull()
    expect(describeCoreFieldViolation(custom, { isRequired: false })).toBeNull()
    expect(describeCoreFieldViolation(custom, { fieldType: "TEXT" })).toBeNull()
  })
})

describe("visibleFields", () => {
  it("drops archived fields and sorts by display order", () => {
    const fields = [
      field({ reportingKey: "c", displayOrder: 30 }),
      field({ reportingKey: "a", displayOrder: 10 }),
      field({ reportingKey: "gone", displayOrder: 20, isActive: false }),
    ]
    expect(visibleFields(fields).map((f) => f.reportingKey)).toEqual(["a", "c"])
  })
})

describe("validateFieldAnswers", () => {
  it("passes when nothing is required and nothing is answered", () => {
    expect(validateFieldAnswers([field({ reportingKey: "note" })], {}).ok).toBe(true)
  })

  it("reports a missing required answer using the field's label", () => {
    const fields = [field({ reportingKey: "budget", label: "Budget", isRequired: true })]
    const result = validateFieldAnswers(fields, {})
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.errors.budget).toContain("Budget")
  })

  it("treats false as an answer for a required boolean", () => {
    const fields = [field({ reportingKey: "urgent", fieldType: "BOOLEAN", isRequired: true })]
    expect(validateFieldAnswers(fields, { urgent: false }).ok).toBe(true)
  })

  it("never validates core fields — those have their own schema", () => {
    const fields = [field({ reportingKey: "date", isCore: true, isRequired: true })]
    expect(validateFieldAnswers(fields, {}).ok).toBe(true)
  })

  it("ignores archived fields even when they were required", () => {
    const fields = [field({ reportingKey: "old", isRequired: true, isActive: false })]
    expect(validateFieldAnswers(fields, {}).ok).toBe(true)
  })

  it("rejects a non-numeric or negative number", () => {
    const fields = [field({ reportingKey: "value", fieldType: "CURRENCY" })]
    expect(validateFieldAnswers(fields, { value: "abc" }).ok).toBe(false)
    expect(validateFieldAnswers(fields, { value: -5 }).ok).toBe(false)
    expect(validateFieldAnswers(fields, { value: 1000 }).ok).toBe(true)
  })

  it("checks date and time shape", () => {
    const dates = [field({ reportingKey: "d", fieldType: "DATE" })]
    expect(validateFieldAnswers(dates, { d: "10-09-2026" }).ok).toBe(false)
    expect(validateFieldAnswers(dates, { d: "2026-09-10" }).ok).toBe(true)

    const times = [field({ reportingKey: "t", fieldType: "TIME" })]
    expect(validateFieldAnswers(times, { t: "9:30" }).ok).toBe(false)
    expect(validateFieldAnswers(times, { t: "09:30" }).ok).toBe(true)
  })

  it("rejects a choice outside the configured options", () => {
    const fields = [field({ reportingKey: "src", fieldType: "SELECT", options: ["Telepon", "Email"] })]
    expect(validateFieldAnswers(fields, { src: "Merpati" }).ok).toBe(false)
    expect(validateFieldAnswers(fields, { src: "Email" }).ok).toBe(true)
  })

  it("rejects a multi-select containing any unknown option", () => {
    const fields = [field({ reportingKey: "ch", fieldType: "MULTI_SELECT", options: ["A", "B"] })]
    expect(validateFieldAnswers(fields, { ch: ["A", "Z"] }).ok).toBe(false)
    expect(validateFieldAnswers(fields, { ch: ["A", "B"] }).ok).toBe(true)
  })

  it("collects every failure at once rather than stopping at the first", () => {
    const fields = [
      field({ reportingKey: "a", label: "A", isRequired: true }),
      field({ reportingKey: "b", label: "B", isRequired: true }),
    ]
    const result = validateFieldAnswers(fields, {})
    expect(result.ok === false && Object.keys(result.errors)).toEqual(["a", "b"])
  })
})

describe("nextDisplayOrder", () => {
  it("places a new field after everything else", () => {
    expect(nextDisplayOrder([field({ reportingKey: "a", displayOrder: 90 })])).toBe(100)
    expect(nextDisplayOrder([])).toBe(10)
  })
})

describe("reorderField", () => {
  const fields = [
    field({ reportingKey: "a", displayOrder: 10 }),
    field({ reportingKey: "b", displayOrder: 20 }),
    field({ reportingKey: "c", displayOrder: 30 }),
  ]

  it("swaps a field with its neighbour and renumbers in steps of ten", () => {
    const result = reorderField(fields, "id-b", "up")
    expect(result).toEqual([
      { id: "id-b", displayOrder: 10 },
      { id: "id-a", displayOrder: 20 },
      { id: "id-c", displayOrder: 30 },
    ])
  })

  it("does nothing at the boundaries", () => {
    expect(reorderField(fields, "id-a", "up")).toEqual([])
    expect(reorderField(fields, "id-c", "down")).toEqual([])
  })

  it("ignores an unknown field", () => {
    expect(reorderField(fields, "id-missing", "up")).toEqual([])
  })

  it("skips archived fields when computing neighbours", () => {
    const withArchived = [
      field({ reportingKey: "a", displayOrder: 10 }),
      field({ reportingKey: "hidden", displayOrder: 20, isActive: false }),
      field({ reportingKey: "c", displayOrder: 30 }),
    ]
    // "c" moves up past "a" — the archived row between them is not a position.
    expect(reorderField(withArchived, "id-c", "up")).toEqual([
      { id: "id-c", displayOrder: 10 },
      { id: "id-a", displayOrder: 20 },
    ])
  })
})

describe("CORE_MISSION_FIELDS", () => {
  it("covers every core key the mission form renders", () => {
    // The form maps these keys to purpose-built inputs; a key here with no
    // branch there renders nothing at all, which is how the form once came up
    // completely empty.
    expect(CORE_MISSION_FIELDS.map((field) => field.reportingKey)).toEqual([
      "client_company",
      "mission_type",
      "location",
      "date",
      "start_time",
      "end_time",
      "objective",
      "primary_sales",
      "supporting_sales",
    ])
  })

  it("keeps the fields conflict detection and the calendar depend on required", () => {
    const required = new Set(
      CORE_MISSION_FIELDS.filter((field) => field.isRequired).map((field) => field.reportingKey)
    )
    expect(required.has("client_company")).toBe(true)
    expect(required.has("date")).toBe(true)
    expect(required.has("start_time")).toBe(true)
    expect(required.has("primary_sales")).toBe(true)
  })

  it("uses keys the database constraint accepts", () => {
    for (const field of CORE_MISSION_FIELDS) {
      expect(field.reportingKey).toMatch(/^[a-z][a-z0-9_]*$/)
    }
  })

  it("orders fields distinctly so the initial form is stable", () => {
    const orders = CORE_MISSION_FIELDS.map((field) => field.displayOrder)
    expect(new Set(orders).size).toBe(orders.length)
    expect([...orders].sort((a, b) => a - b)).toEqual(orders)
  })
})

describe("isChoiceType", () => {
  it("covers exactly the two option-driven types", () => {
    expect(isChoiceType("SELECT")).toBe(true)
    expect(isChoiceType("MULTI_SELECT")).toBe(true)
    expect(isChoiceType("TEXT")).toBe(false)
    expect(isChoiceType("BOOLEAN")).toBe(false)
  })
})
