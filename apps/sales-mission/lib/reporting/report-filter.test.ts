import { describe, expect, it } from "vitest"
import { dateRangeFor } from "@/lib/missions/mission-filter"
import { EMPTY_REPORT_QUERY, countActiveReportFacets, isEmptyReportQuery, parseReportQuery, serializeReportQuery, type ReportQuery } from "./report-filter"

describe("parseReportQuery / serializeReportQuery", () => {
  it("round-trips a query with every facet set", () => {
    const query: ReportQuery = {
      q: "arunika",
      status: ["SUBMITTED", "NEEDS_CLARIFICATION"],
      outcome: ["MET_DECISION_MAKER"],
      interest: ["HOT", "WARM"],
      nextAction: ["SEND_PROPOSAL"],
      sales: ["11111111-1111-4111-8111-111111111111", "none"],
      opportunity: true,
      pushed: false,
      date: "custom",
      from: "2026-09-01",
      to: "2026-09-30",
    }
    expect(parseReportQuery(Object.fromEntries(serializeReportQuery(query)))).toEqual(query)
  })

  it("reads the tri-states and keeps a false", () => {
    expect(parseReportQuery({}).opportunity).toBeNull()
    expect(parseReportQuery({ opp: "1" }).opportunity).toBe(true)
    expect(parseReportQuery({ opp: "0", pushed: "yes" })).toMatchObject({ opportunity: false, pushed: null })
    expect(serializeReportQuery({ ...EMPTY_REPORT_QUERY, pushed: false }).get("pushed")).toBe("0")
    expect(serializeReportQuery(EMPTY_REPORT_QUERY).has("opp")).toBe(false)
  })

  it("treats bare from/to as a custom range, and keeps a preset's bounds out of the link", () => {
    expect(parseReportQuery({ from: "2026-09-01", to: "2026-09-30" })).toMatchObject({ date: "custom", from: "2026-09-01", to: "2026-09-30" })
    const monthly = parseReportQuery({ date: "month", from: "2026-09-01" })
    expect(monthly.date).toBe("month")
    expect(serializeReportQuery(monthly).has("from")).toBe(false)
  })

  it("drops what it does not know", () => {
    const query = parseReportQuery({ status: "DRAFT,BOGUS", outcome: "met_staff,VIDEO_CALL", date: "yesterday", from: "01/09/2026" })
    expect(query.status).toEqual(["DRAFT"])
    expect(query.outcome).toEqual(["VIDEO_CALL"])
    expect(query.date).toBeNull()
    expect(query.from).toBeNull()
  })

  it("counts a facet once, and a false as active", () => {
    expect(countActiveReportFacets(EMPTY_REPORT_QUERY)).toBe(0)
    expect(isEmptyReportQuery(EMPTY_REPORT_QUERY)).toBe(true)
    expect(countActiveReportFacets({ ...EMPTY_REPORT_QUERY, status: ["DRAFT", "SUBMITTED"], opportunity: false })).toBe(2)
  })

  it("feeds the shared date-range helper", () => {
    expect(dateRangeFor({ ...EMPTY_REPORT_QUERY, date: "custom", from: "2026-09-01", to: "2026-09-30" }, new Date())).toEqual(["2026-09-01", "2026-09-30"])
    expect(dateRangeFor(EMPTY_REPORT_QUERY, new Date())).toBeNull()
  })
})
