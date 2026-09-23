import { describe, expect, it } from "vitest"
import { nextSort } from "../list-sort"

describe("nextSort", () => {
  it("sorts a new column ascending", () => {
    expect(nextSort(null, "name")).toEqual({ key: "name", direction: "asc" })
    expect(nextSort({ key: "city", direction: "desc" }, "name")).toEqual({ key: "name", direction: "asc" })
  })

  it("then descending, then back to the default order", () => {
    expect(nextSort({ key: "name", direction: "asc" }, "name")).toEqual({ key: "name", direction: "desc" })
    expect(nextSort({ key: "name", direction: "desc" }, "name")).toBeNull()
  })
})
