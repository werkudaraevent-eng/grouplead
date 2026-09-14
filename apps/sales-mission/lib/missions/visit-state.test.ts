import { describe, expect, it } from "vitest"
import { reportOwed, visitState } from "./visit-state"

const now = new Date("2026-09-16T05:00:00.000Z")

function m(overrides: Partial<Parameters<typeof visitState>[0]>): Parameters<typeof visitState>[0] {
  return { status: "ACCEPTED", reportStatus: "NONE", scheduledStart: "2026-09-16T02:00:00.000Z", scheduledEnd: "2026-09-16T03:00:00.000Z", ...overrides }
}

describe("visitState", () => {
  it("is upcoming while the slot is ahead", () => {
    expect(visitState(m({ scheduledStart: "2026-09-16T08:00:00.000Z", scheduledEnd: "2026-09-16T09:00:00.000Z" }), now)).toBe("upcoming")
  })

  it("owes a report once the slot has passed with nothing written", () => {
    expect(visitState(m({}), now)).toBe("needs_report")
    // No end: assumed an hour.
    expect(visitState(m({ scheduledStart: "2026-09-16T04:30:00.000Z", scheduledEnd: null }), now)).toBe("upcoming")
    expect(visitState(m({ scheduledStart: "2026-09-16T03:30:00.000Z", scheduledEnd: null }), now)).toBe("needs_report")
  })

  it("reads a started report as a draft whatever the clock says", () => {
    expect(visitState(m({ reportStatus: "DRAFT", scheduledStart: "2026-09-20T02:00:00.000Z" }), now)).toBe("draft")
  })

  it("is reported once sent or the mission is complete", () => {
    expect(visitState(m({ reportStatus: "SUBMITTED" }), now)).toBe("reported")
    expect(visitState(m({ status: "COMPLETED" }), now)).toBe("reported")
  })

  it("is cancelled for a called-off or refused visit, whatever else is true", () => {
    expect(visitState(m({ status: "CANCELLED", reportStatus: "DRAFT" }), now)).toBe("cancelled")
  })

  it("knows which states a report resolves", () => {
    expect(reportOwed("needs_report")).toBe(true)
    expect(reportOwed("draft")).toBe(true)
    expect(reportOwed("upcoming")).toBe(false)
  })
})
