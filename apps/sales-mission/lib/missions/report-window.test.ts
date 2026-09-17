import { describe, expect, it } from "vitest"
import { describeReportOpens, reportLocked, reportOpensAt } from "./report-window"

describe("reportOpensAt", () => {
  it("is midnight of the scheduled day in mission time, whatever the hour", () => {
    expect(reportOpensAt("2026-09-21T02:00:00+00:00")?.toISOString()).toBe("2026-09-20T17:00:00.000Z")
    // 23.30 Jakarta on the 20th is 16.30Z; the report still opens on the 20th.
    expect(reportOpensAt("2026-09-20T16:30:00+00:00")?.toISOString()).toBe("2026-09-19T17:00:00.000Z")
  })

  it("has nothing to wait for without a schedule", () => {
    expect(reportOpensAt(null)).toBeNull()
    expect(reportOpensAt("nonsense")).toBeNull()
  })
})

describe("reportLocked", () => {
  const visit = "2026-09-21T09:00:00+07:00"

  it("locks until the scheduled day starts, then opens", () => {
    expect(reportLocked(visit, new Date("2026-09-17T10:00:00+07:00"))?.until.toISOString()).toBe("2026-09-20T17:00:00.000Z")
    expect(reportLocked(visit, new Date("2026-09-20T23:59:00+07:00"))).not.toBeNull()
    expect(reportLocked(visit, new Date("2026-09-21T00:00:00+07:00"))).toBeNull()
    expect(reportLocked(visit, new Date("2026-09-21T06:00:00+07:00"))).toBeNull()
  })

  it("never locks an unscheduled visit", () => {
    expect(reportLocked(null, new Date())).toBeNull()
  })
})

describe("describeReportOpens", () => {
  it("names the day", () => {
    expect(describeReportOpens(new Date("2026-09-21T00:00:00+07:00"))).toBe("Laporan bisa diisi mulai Sen, 21 Sep")
  })
})
