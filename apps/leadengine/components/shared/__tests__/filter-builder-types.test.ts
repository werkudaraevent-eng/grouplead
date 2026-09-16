import { describe, expect, it } from "vitest"
import { applyFilters, type FilterDefinition } from "../filter-builder-types"

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

  it("ignores a filter whose definition is unknown", () => {
    expect(applyFilters(rows, [{ field: "nope", operator: "eq", value: "x" }], defs)).toHaveLength(3)
  })
})
