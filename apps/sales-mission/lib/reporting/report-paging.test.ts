import { describe, expect, it } from "vitest"
import { nextReportSort, parseReportPageParams, parseReportSort, reportSortParts } from "./report-paging"

describe("report paging", () => {
  it("parses a sort and falls back to newest sent", () => {
    expect(parseReportSort("value:desc")).toBe("value:desc")
    expect(parseReportSort("nonsense")).toBe("submitted:desc")
    expect(parseReportSort(undefined)).toBe("submitted:desc")
    expect(reportSortParts("follow_up:asc")).toEqual({ column: "follow_up", direction: "asc" })
  })

  it("cycles a column asc → desc → default, and flips the submitted column", () => {
    expect(nextReportSort("client", "submitted:desc")).toBe("client:asc")
    expect(nextReportSort("client", "client:asc")).toBe("client:desc")
    expect(nextReportSort("client", "client:desc")).toBe("submitted:desc")
    expect(nextReportSort("submitted", "submitted:desc")).toBe("submitted:asc")
    expect(nextReportSort("submitted", "submitted:asc")).toBe("submitted:desc")
    expect(nextReportSort("submitted", "value:desc")).toBe("submitted:desc")
    expect(nextReportSort("actual", "value:desc")).toBe("actual:asc")
  })

  it("parses page, size and sort with safe defaults", () => {
    expect(parseReportPageParams({ page: "2", size: "50", sort: "follow_up:asc" })).toEqual({ page: 2, size: 50, sort: "follow_up:asc" })
    expect(parseReportPageParams({})).toEqual({ page: 0, size: 25, sort: "submitted:desc" })
    expect(parseReportPageParams({ page: "-3", size: "7" })).toEqual({ page: 0, size: 25, sort: "submitted:desc" })
  })
})
