import { describe, expect, it } from "vitest"
import { nextSort, parsePageParams, parseSort, sortParts } from "./mission-paging"

describe("parseSort", () => {
  it("accepts every column in both directions and falls back to the default", () => {
    expect(parseSort("client:desc")).toBe("client:desc")
    expect(parseSort("status:asc")).toBe("status:asc")
    expect(parseSort("nonsense")).toBe("upcoming")
    expect(parseSort(undefined)).toBe("upcoming")
  })

  it("still reads the older schedule-only spelling", () => {
    expect(parseSort("asc")).toBe("schedule:asc")
    expect(parseSort("desc")).toBe("schedule:desc")
  })
})

describe("nextSort", () => {
  it("cycles a column unsorted → asc → desc → default", () => {
    expect(nextSort("client", "upcoming")).toBe("client:asc")
    expect(nextSort("client", "client:asc")).toBe("client:desc")
    expect(nextSort("client", "client:desc")).toBe("upcoming")
  })

  it("starts over when a different column is clicked", () => {
    expect(nextSort("location", "client:desc")).toBe("location:asc")
  })

  it("treats the schedule's default as its unsorted state", () => {
    expect(nextSort("schedule", "upcoming")).toBe("schedule:asc")
    expect(nextSort("schedule", "schedule:desc")).toBe("upcoming")
  })
})

describe("sortParts / parsePageParams", () => {
  it("names the column and direction", () => {
    expect(sortParts("upcoming")).toEqual({ column: "schedule", direction: "upcoming" })
    expect(sortParts("sales:desc")).toEqual({ column: "sales", direction: "desc" })
  })

  it("reads page, size and sort from the URL", () => {
    expect(parsePageParams({ page: "2", size: "50", sort: "location:asc" })).toEqual({ page: 2, size: 50, sort: "location:asc" })
    expect(parsePageParams({})).toEqual({ page: 0, size: 25, sort: "upcoming" })
  })
})
