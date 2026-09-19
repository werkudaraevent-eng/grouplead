import { describe, expect, it } from "vitest"
import { contactsForCrm, visitReachesCrm, discForCrm } from "./crm-sync"

describe("visitReachesCrm", () => {
  it("registers the company when someone was met", () => {
    expect(visitReachesCrm("MET_DECISION_MAKER")).toBe(true)
    expect(visitReachesCrm("MET_STAFF")).toBe(true)
    expect(visitReachesCrm("RESCHEDULED_ON_SITE")).toBe(true)
  })

  it("keeps a no-show or a cancellation out of the CRM", () => {
    // Nobody was met, so there is no relationship to record and no contact
    // to register. The visit stays in Sales Mission's own history.
    expect(visitReachesCrm("CLIENT_ABSENT")).toBe(false)
    expect(visitReachesCrm("CANCELLED_ON_SITE")).toBe(false)
  })
})

describe("contactsForCrm", () => {
  it("drops blank names and trims the rest", () => {
    expect(contactsForCrm([{ fullName: "  Nofri Ardian " }, { fullName: "   " }])).toEqual([
      { fullName: "Nofri Ardian" },
    ])
  })

  it("keeps one row per name within a report", () => {
    const result = contactsForCrm([
      { fullName: "Nofri Ardian", jobTitle: "GM" },
      { fullName: "nofri ardian", phone: "0812" },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].jobTitle).toBe("GM")
  })
})

describe("discForCrm", () => {
  it("is null without a primary letter and drops a secondary equal to it", () => {
    expect(discForCrm({ discPrimary: null, discSecondary: "I" })).toBeNull()
    expect(discForCrm({ discPrimary: "D", discSecondary: "D", discNote: " ", discAssessedByName: "Rini", discAssessedAt: "2026-09-19T03:00:00Z" })).toEqual({
      primary: "D",
      secondary: null,
      note: null,
      assessedByName: "Rini",
      assessedAt: "2026-09-19T03:00:00Z",
    })
  })
})
