import { describe, expect, it } from "vitest"
import { countActiveProspectFacets, parseProspectQuery, serializeProspectQuery, splitStatusFacet } from "./prospect-filter"
import { nextProspectSort, parseProspectPageParams, parseProspectSort, prospectSortParts } from "./prospect-paging"

describe("prospect query", () => {
  it("round-trips through the URL", () => {
    const query = parseProspectQuery({ q: "arunika", status: "a,state:completed", owner: "none,u1", batch: "b1", due: "1" })
    expect(query).toEqual({ q: "arunika", status: ["a", "state:completed"], owner: ["none", "u1"], batch: ["b1"], due: true })
    expect(parseProspectQuery(Object.fromEntries(serializeProspectQuery(query)))).toEqual(query)
    expect(countActiveProspectFacets(query)).toBe(7)
  })

  it("splits stored statuses from derived states", () => {
    expect(splitStatusFacet(["a", "state:completed", "b"])).toEqual({ statusIds: ["a", "b"], states: ["completed"] })
  })
})

describe("prospect sort", () => {
  it("parses, cycles and falls back to due", () => {
    expect(parseProspectSort("owner:desc")).toBe("owner:desc")
    expect(parseProspectSort("nonsense")).toBe("due")
    expect(prospectSortParts("due")).toEqual({ column: "due", direction: "due" })
    expect(nextProspectSort("company", "due")).toBe("company:asc")
    expect(nextProspectSort("company", "company:asc")).toBe("company:desc")
    expect(nextProspectSort("company", "company:desc")).toBe("due")
    expect(nextProspectSort("owner", "company:desc")).toBe("owner:asc")
    expect(parseProspectPageParams({ page: "3", size: "100", sort: "created:desc" })).toEqual({ page: 3, size: 100, sort: "created:desc" })
  })
})
