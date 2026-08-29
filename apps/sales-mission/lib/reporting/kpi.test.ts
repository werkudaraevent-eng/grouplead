import { describe, expect, it } from "vitest"
import {
  UNASSIGNED_LABEL,
  buildKpiReport,
  currentMonthRange,
  filterByRange,
  toCsv,
  toCsvRows,
  type ReportRecord,
} from "./kpi"

function record(overrides: Partial<ReportRecord> & { missionId: string }): ReportRecord {
  return {
    missionType: "Meeting",
    clientCompanyName: "PT Arunika Kreasi",
    primarySalesName: "Wg, Hanung",
    reportStatus: "SUBMITTED",
    visitOutcome: "MET_DECISION_MAKER",
    interestLevel: "WARM",
    opportunityExists: false,
    estimatedValue: null,
    nextActionType: "NONE",
    followUpDate: null,
    submittedAt: "2026-09-10T02:30:00.000Z",
    contactCount: 1,
    pushedLeadId: null,
    ...overrides,
  }
}

// 2026-09-15T10:00 WIB
const NOW = new Date("2026-09-15T03:00:00.000Z")

describe("filterByRange", () => {
  it("returns everything when no range is given", () => {
    const records = [record({ missionId: "a" }), record({ missionId: "b", submittedAt: null })]
    expect(filterByRange(records, null)).toHaveLength(2)
  })

  it("includes both boundary days", () => {
    const records = [
      record({ missionId: "first", submittedAt: "2026-09-01T02:00:00.000Z" }),
      record({ missionId: "last", submittedAt: "2026-09-30T02:00:00.000Z" }),
      record({ missionId: "before", submittedAt: "2026-08-31T02:00:00.000Z" }),
      record({ missionId: "after", submittedAt: "2026-10-01T02:00:00.000Z" }),
    ]
    const kept = filterByRange(records, { from: "2026-09-01", to: "2026-09-30" })
    expect(kept.map((item) => item.missionId)).toEqual(["first", "last"])
  })

  it("uses the mission-time day, so a late-evening submission counts as that day", () => {
    // 2026-09-30T23:30 WIB is 2026-09-30T16:30Z — still September in Jakarta.
    const late = [record({ missionId: "late", submittedAt: "2026-09-30T16:30:00.000Z" })]
    expect(filterByRange(late, { from: "2026-09-01", to: "2026-09-30" })).toHaveLength(1)
  })

  it("drops unsubmitted and unparseable records", () => {
    const records = [
      record({ missionId: "draft", submittedAt: null }),
      record({ missionId: "broken", submittedAt: "not-a-date" }),
    ]
    expect(filterByRange(records, { from: "2026-09-01", to: "2026-09-30" })).toEqual([])
  })
})

describe("buildKpiReport", () => {
  it("counts only submitted reports — a draft is someone still typing", () => {
    const records = [
      record({ missionId: "a" }),
      record({ missionId: "b", reportStatus: "DRAFT" }),
    ]
    expect(buildKpiReport(records, NOW).summary.resultsSubmitted).toBe(1)
  })

  it("counts a report needing clarification as submitted, because it is", () => {
    const records = [record({ missionId: "a", reportStatus: "NEEDS_CLARIFICATION" })]
    const { summary } = buildKpiReport(records, NOW)
    expect(summary.resultsSubmitted).toBe(1)
    expect(summary.needsClarification).toBe(1)
  })

  it("sums opportunities, value, contacts and pushed leads", () => {
    const records = [
      record({ missionId: "a", opportunityExists: true, estimatedValue: 100, contactCount: 2, pushedLeadId: "77" }),
      record({ missionId: "b", opportunityExists: true, estimatedValue: 50, contactCount: 1 }),
      record({ missionId: "c", estimatedValue: null, contactCount: 3 }),
    ]
    const { summary } = buildKpiReport(records, NOW)
    expect(summary.opportunities).toBe(2)
    expect(summary.estimatedValueTotal).toBe(150)
    expect(summary.contactsDiscovered).toBe(6)
    expect(summary.leadsPushed).toBe(1)
  })

  it("separates open next actions from overdue ones", () => {
    const records = [
      record({ missionId: "future", nextActionType: "SEND_PROPOSAL", followUpDate: "2026-09-20" }),
      record({ missionId: "past", nextActionType: "FOLLOW_UP_CALL", followUpDate: "2026-09-01" }),
      record({ missionId: "today", nextActionType: "SITE_VISIT", followUpDate: "2026-09-15" }),
      record({ missionId: "none", nextActionType: "NONE" }),
    ]
    const { summary } = buildKpiReport(records, NOW)
    expect(summary.openNextActions).toBe(3)
    // Today is not yet overdue.
    expect(summary.overdueNextActions).toBe(1)
  })

  it("computes the decision-maker rate as a whole percentage", () => {
    const records = [
      record({ missionId: "a", visitOutcome: "MET_DECISION_MAKER" }),
      record({ missionId: "b", visitOutcome: "MET_STAFF" }),
      record({ missionId: "c", visitOutcome: "MET_STAFF" }),
    ]
    expect(buildKpiReport(records, NOW).summary.decisionMakerRate).toBe(33)
  })

  it("returns zero rather than NaN when nothing was submitted", () => {
    const { summary } = buildKpiReport([], NOW)
    expect(summary.decisionMakerRate).toBe(0)
    expect(summary.resultsSubmitted).toBe(0)
    expect(summary.estimatedValueTotal).toBe(0)
  })

  it("groups by sales, busiest first", () => {
    const records = [
      record({ missionId: "a", primarySalesName: "Nadia" }),
      record({ missionId: "b", primarySalesName: "Wg, Hanung" }),
      record({ missionId: "c", primarySalesName: "Wg, Hanung", opportunityExists: true, estimatedValue: 200 }),
    ]
    const { bySales } = buildKpiReport(records, NOW)
    expect(bySales[0]).toEqual({
      key: "Wg, Hanung",
      label: "Wg, Hanung",
      submitted: 2,
      opportunities: 1,
      estimatedValue: 200,
    })
    expect(bySales[1].label).toBe("Nadia")
  })

  it("labels a report with no primary sales rather than dropping it", () => {
    const records = [record({ missionId: "a", primarySalesName: null })]
    expect(buildKpiReport(records, NOW).bySales[0].label).toBe(UNASSIGNED_LABEL)
  })

  it("orders equal buckets alphabetically so rows do not shuffle between loads", () => {
    const records = [
      record({ missionId: "a", missionType: "Visit" }),
      record({ missionId: "b", missionType: "Meeting" }),
    ]
    expect(buildKpiReport(records, NOW).byMissionType.map((row) => row.label)).toEqual([
      "Meeting",
      "Visit",
    ])
  })

  it("buckets a missing interest level instead of discarding the report", () => {
    const records = [record({ missionId: "a", interestLevel: null })]
    const { byInterest } = buildKpiReport(records, NOW)
    expect(byInterest[0].key).toBe("UNSET")
    expect(byInterest[0].submitted).toBe(1)
  })

  it("applies the range before counting", () => {
    const records = [
      record({ missionId: "in", submittedAt: "2026-09-10T02:00:00.000Z" }),
      record({ missionId: "out", submittedAt: "2026-08-10T02:00:00.000Z" }),
    ]
    const report = buildKpiReport(records, NOW, { from: "2026-09-01", to: "2026-09-30" })
    expect(report.summary.resultsSubmitted).toBe(1)
    expect(report.byCompany[0].submitted).toBe(1)
  })
})

describe("currentMonthRange", () => {
  it("spans the whole month in mission time", () => {
    expect(currentMonthRange(NOW)).toEqual({ from: "2026-09-01", to: "2026-09-30" })
  })

  it("handles 31-day months and February", () => {
    expect(currentMonthRange(new Date("2026-08-15T03:00:00.000Z")).to).toBe("2026-08-31")
    expect(currentMonthRange(new Date("2026-02-15T03:00:00.000Z")).to).toBe("2026-02-28")
    expect(currentMonthRange(new Date("2028-02-15T03:00:00.000Z")).to).toBe("2028-02-29")
  })

  it("uses the Jakarta month at a UTC boundary", () => {
    // 2026-10-01T00:30 WIB is still 2026-09-30 in UTC.
    expect(currentMonthRange(new Date("2026-09-30T17:30:00.000Z")).from).toBe("2026-10-01")
  })
})

describe("toCsv", () => {
  it("emits a header followed by one row per record", () => {
    const rows = toCsvRows([record({ missionId: "m1" })])
    expect(rows).toHaveLength(2)
    expect(rows[0][0]).toBe("mission_id")
    expect(rows[1][0]).toBe("m1")
  })

  it("survives a company name containing a comma", () => {
    const rows = toCsvRows([record({ missionId: "m1", clientCompanyName: "PT Maju, Jaya" })])
    expect(toCsv(rows)).toContain('"PT Maju, Jaya"')
  })

  it("escapes embedded quotes by doubling them", () => {
    const rows = toCsvRows([record({ missionId: 'm"1' })])
    expect(toCsv(rows)).toContain('"m""1"')
  })

  it("writes an empty cell for a null rather than the word null", () => {
    const rows = toCsvRows([record({ missionId: "m1", estimatedValue: null, followUpDate: null })])
    expect(toCsv(rows)).not.toContain("null")
  })
})
