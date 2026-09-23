import { describe, expect, it } from "vitest"
import { applyFilters, filterValueLabel, isEffectiveFilter, type FilterDefinition } from "../filter-builder-types"

const rows = [
  { id: 1, name: "Alpha", email: "a@x.id", tags: ["vip"], owner: { full_name: "Ana" }, created_at: "2026-09-01" },
  { id: 2, name: "Beta", email: "", tags: [], owner: { full_name: "Budi" }, created_at: "2026-09-10" },
  { id: 3, name: "Gamma", email: "g@x.id", tags: ["vip", "new"], owner: null, created_at: "2026-08-20" },
]
const defs: FilterDefinition[] = [
  { field: "name", label: "Name", type: "text" },
  { field: "email", label: "Has email", type: "boolean", accessor: (row) => (row as { email: string }).email },
  { field: "owner.full_name", label: "Owner", type: "select" },
  { field: "tags", label: "Tags", type: "multi-select" },
  { field: "created_at", label: "Created", type: "date-range" },
]

describe("applyFilters", () => {
  it("returns every row when nothing is applied", () => {
    expect(applyFilters(rows, [], defs)).toHaveLength(3)
  })

  it("matches text case-insensitively", () => {
    expect(applyFilters(rows, [{ field: "name", operator: "contains", value: "ALP" }], defs).map((r) => r.id)).toEqual([1])
    expect(applyFilters(rows, [{ field: "name", operator: "starts_with", value: "g" }], defs).map((r) => r.id)).toEqual([3])
  })

  it("reads dot paths and treats a missing branch as empty", () => {
    expect(applyFilters(rows, [{ field: "owner.full_name", operator: "eq", value: "Budi" }], defs).map((r) => r.id)).toEqual([2])
    expect(applyFilters(rows, [{ field: "owner.full_name", operator: "is_empty", value: null }], defs).map((r) => r.id)).toEqual([3])
  })

  it("uses the accessor for booleans and empties", () => {
    expect(applyFilters(rows, [{ field: "email", operator: "is_not_empty", value: null }], defs).map((r) => r.id)).toEqual([1, 3])
  })

  it("ANDs filters together", () => {
    const out = applyFilters(rows, [
      { field: "email", operator: "is_not_empty", value: null },
      { field: "name", operator: "contains", value: "amm" },
    ], defs)
    expect(out.map((r) => r.id)).toEqual([3])
  })

  it("never lets an empty value blank the list", () => {
    expect(applyFilters(rows, [{ field: "owner.full_name", operator: "eq", value: "" }], defs)).toHaveLength(3)
    expect(applyFilters(rows, [{ field: "tags", operator: "in", value: [] }], defs)).toHaveLength(3)
    expect(applyFilters(rows, [{ field: "created_at", operator: "between", value: [null, null] }], defs)).toHaveLength(3)
    expect(isEffectiveFilter({ field: "email", operator: "is_not_empty", value: null })).toBe(true)
    expect(isEffectiveFilter({ field: "name", operator: "contains", value: "" })).toBe(false)
  })

  it("ignores a filter whose definition is unknown", () => {
    expect(applyFilters(rows, [{ field: "nope", operator: "eq", value: "x" }], defs)).toHaveLength(3)
  })

  it("a Has-* filter is a real boolean read with the boolean type's own operators", () => {
    const hasEmail: FilterDefinition[] = [
      { field: "email", label: "Has email", type: "boolean", accessor: (row) => Boolean((row as { email: string }).email?.trim()) },
    ]
    expect(applyFilters(rows, [{ field: "email", operator: "is_true", value: null }], hasEmail).map((r) => r.id)).toEqual([1, 3])
    expect(applyFilters(rows, [{ field: "email", operator: "is_false", value: null }], hasEmail).map((r) => r.id)).toEqual([2])
  })

  it("a view saved with is_not_empty on a boolean still means 'has one'", () => {
    const hasEmail: FilterDefinition[] = [
      { field: "email", label: "Has email", type: "boolean", accessor: (row) => Boolean((row as { email: string }).email?.trim()) },
    ]
    expect(applyFilters(rows, [{ field: "email", operator: "is_not_empty", value: null }], hasEmail).map((r) => r.id)).toEqual([1, 3])
    expect(applyFilters(rows, [{ field: "email", operator: "is_empty", value: null }], hasEmail).map((r) => r.id)).toEqual([2])
  })
})

describe("filterValueLabel", () => {
  const sector: FilterDefinition = { field: "industry", label: "Sector", type: "select", options: [{ value: "hotel", label: "Hotel" }] }
  const hasEmail: FilterDefinition = { field: "email", label: "Has email", type: "boolean" }
  const created: FilterDefinition = { field: "created_at", label: "Created date", type: "date-range" }

  it("names the chosen option, and says so when it is a negation", () => {
    expect(filterValueLabel(sector, { field: "industry", operator: "eq", value: "hotel" })).toBe("Hotel")
    expect(filterValueLabel(sector, { field: "industry", operator: "neq", value: "hotel" })).toBe("not Hotel")
    expect(filterValueLabel(sector, { field: "industry", operator: "eq", value: "Bank" })).toBe("Bank")
    expect(filterValueLabel(sector, { field: "industry", operator: "is_empty", value: null })).toBe("is empty")
  })

  it("reads a true/false filter as yes or no, old operators included", () => {
    expect(filterValueLabel(hasEmail, { field: "email", operator: "is_true", value: null })).toBe("yes")
    expect(filterValueLabel(hasEmail, { field: "email", operator: "is_false", value: null })).toBe("no")
    expect(filterValueLabel(hasEmail, { field: "email", operator: "is_not_empty", value: null })).toBe("yes")
  })

  it("reads dates by their operator", () => {
    expect(filterValueLabel(created, { field: "created_at", operator: "between", value: ["2026-01-01", "2026-03-31"] })).toBe("2026-01-01 → 2026-03-31")
    expect(filterValueLabel(created, { field: "created_at", operator: "before", value: [null, "2026-03-01"] })).toBe("before 2026-03-01")
    expect(filterValueLabel(created, { field: "created_at", operator: "after", value: ["2026-03-01", null] })).toBe("after 2026-03-01")
  })
})
