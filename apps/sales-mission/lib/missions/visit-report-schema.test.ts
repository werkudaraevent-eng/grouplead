import { describe, expect, it } from "vitest"
import {
  contactFromAppointment,
  isAppointmentContact,
  canPushLead,
  hasOpenNextAction,
  missingSubmitFields,
  outcomeRequiresContacts,
  visitReportDraftSchema,
  visitReportSubmitSchema,
} from "./visit-report-schema"

const OWNER_ID = "11111111-1111-4111-8111-111111111111"

function completeReport(overrides: Record<string, unknown> = {}) {
  return {
    visitOutcome: "MET_DECISION_MAKER",
    meetingSummary: "Klien tertarik paket gathering 200 pax.",
    clientNeeds: ["Event organizer"],
    productInterest: [],
    interestLevel: "WARM",
    opportunityExists: true,
    estimatedValue: 150_000_000,
    competitorMentioned: "",
    nextActionType: "SEND_PROPOSAL",
    nextActionOwner: OWNER_ID,
    followUpDate: "2026-09-05",
    contacts: [{ fullName: "Budi Santoso", jobTitle: "GM", phone: "", email: "", isDecisionMaker: true }],
    ...overrides,
  }
}

describe("visitReportDraftSchema", () => {
  it("accepts an almost empty draft so autosave never loses work", () => {
    const result = visitReportDraftSchema.safeParse({})
    expect(result.success).toBe(true)
    expect(result.success && result.data.nextActionType).toBe("NONE")
    expect(result.success && result.data.contacts).toEqual([])
  })

  it("still rejects data that could never be valid", () => {
    expect(visitReportDraftSchema.safeParse({ estimatedValue: -1 }).success).toBe(false)
    // Codes are the tenant's now, so the schema checks the shape; the server checks membership.
    expect(visitReportDraftSchema.safeParse({ visitOutcome: "not a code" }).success).toBe(false)
    expect(visitReportDraftSchema.safeParse({ visitOutcome: "VIDEO_CALL" }).success).toBe(true)
    expect(visitReportDraftSchema.safeParse({ followUpDate: "05-09-2026" }).success).toBe(false)
  })

  it("takes a DISC reading on a contact, and only the four letters", () => {
    const ok = visitReportDraftSchema.safeParse({
      contacts: [{ fullName: "Budi", isDecisionMaker: false, discPrimary: "D", discSecondary: "I", discNote: " jangan telepon pagi " }],
    })
    expect(ok.success).toBe(true)
    expect(ok.success && ok.data.contacts[0]).toMatchObject({ discPrimary: "D", discSecondary: "I", discNote: "jangan telepon pagi" })
    // A contact without a reading is the common case and stays valid.
    expect(visitReportDraftSchema.safeParse({ contacts: [{ fullName: "Budi", isDecisionMaker: false }] }).success).toBe(true)
    expect(visitReportDraftSchema.safeParse({ contacts: [{ fullName: "Budi", isDecisionMaker: false, discPrimary: "X" }] }).success).toBe(false)
    expect(visitReportDraftSchema.safeParse({ contacts: [{ fullName: "Budi", isDecisionMaker: false, discPrimary: "D", discNote: "x".repeat(301) }] }).success).toBe(false)
  })

  it("rejects a malformed contact email", () => {
    const draft = { contacts: [{ fullName: "Budi", email: "budi-at-example", isDecisionMaker: false }] }
    expect(visitReportDraftSchema.safeParse(draft).success).toBe(false)
  })

  it("allows a contact with only a name — the field rep may have nothing else", () => {
    const draft = { contacts: [{ fullName: "Budi", isDecisionMaker: false }] }
    expect(visitReportDraftSchema.safeParse(draft).success).toBe(true)
  })
})

describe("visitReportSubmitSchema", () => {
  it("accepts a complete report", () => {
    expect(visitReportSubmitSchema.safeParse(completeReport()).success).toBe(true)
  })

  it("requires outcome, summary, interest level, and needs", () => {
    expect(visitReportSubmitSchema.safeParse(completeReport({ visitOutcome: null })).success).toBe(false)
    expect(visitReportSubmitSchema.safeParse(completeReport({ meetingSummary: "   " })).success).toBe(false)
    expect(visitReportSubmitSchema.safeParse(completeReport({ interestLevel: null })).success).toBe(false)
    expect(visitReportSubmitSchema.safeParse(completeReport({ clientNeeds: [] })).success).toBe(false)
  })

  it("requires at least one contact met", () => {
    expect(visitReportSubmitSchema.safeParse(completeReport({ contacts: [] })).success).toBe(false)
  })

  it("waives the contact requirement when the client was absent", () => {
    const absent = completeReport({
      visitOutcome: "CLIENT_ABSENT",
      contacts: [],
      opportunityExists: false,
      interestLevel: "COLD",
    })
    expect(visitReportSubmitSchema.safeParse(absent).success).toBe(true)
  })

  it("requires an owner and a date once a next action is chosen", () => {
    expect(visitReportSubmitSchema.safeParse(completeReport({ nextActionOwner: null })).success).toBe(false)
    expect(visitReportSubmitSchema.safeParse(completeReport({ followUpDate: null })).success).toBe(false)
  })

  it("allows a missing owner and date only when there is no next action", () => {
    const none = completeReport({ nextActionType: "NONE", nextActionOwner: null, followUpDate: null })
    expect(visitReportSubmitSchema.safeParse(none).success).toBe(true)
  })

  it("rejects an opportunity flagged on a no-interest visit", () => {
    const contradiction = completeReport({ interestLevel: "NO_INTEREST", opportunityExists: true })
    const result = visitReportSubmitSchema.safeParse(contradiction)
    expect(result.success).toBe(false)
    expect(result.success === false && result.error.issues.some((i) => i.path[0] === "opportunityExists")).toBe(true)
  })

  it("allows no interest as long as no opportunity is claimed", () => {
    const honest = completeReport({ interestLevel: "NO_INTEREST", opportunityExists: false })
    expect(visitReportSubmitSchema.safeParse(honest).success).toBe(true)
  })
})

describe("outcomeRequiresContacts", () => {
  it("is false only for an absent client", () => {
    expect(outcomeRequiresContacts("CLIENT_ABSENT")).toBe(false)
    expect(outcomeRequiresContacts("MET_STAFF")).toBe(true)
    expect(outcomeRequiresContacts("CANCELLED_ON_SITE")).toBe(true)
    expect(outcomeRequiresContacts(null)).toBe(true)
  })
})

describe("canPushLead", () => {
  it("requires both an opportunity and a submitted report", () => {
    expect(canPushLead({ status: "SUBMITTED", opportunityExists: true })).toBe(true)
    expect(canPushLead({ status: "DRAFT", opportunityExists: true })).toBe(false)
    expect(canPushLead({ status: "SUBMITTED", opportunityExists: false })).toBe(false)
    expect(canPushLead({ status: "NEEDS_CLARIFICATION", opportunityExists: true })).toBe(false)
  })
})

describe("hasOpenNextAction", () => {
  it("ignores drafts and reports with no next action", () => {
    expect(hasOpenNextAction({ status: "SUBMITTED", nextActionType: "SEND_PROPOSAL" })).toBe(true)
    expect(hasOpenNextAction({ status: "DRAFT", nextActionType: "SEND_PROPOSAL" })).toBe(false)
    expect(hasOpenNextAction({ status: "SUBMITTED", nextActionType: "NONE" })).toBe(false)
  })
})

describe("missingSubmitFields", () => {
  it("returns nothing for a complete report", () => {
    expect(missingSubmitFields(visitReportDraftSchema.parse(completeReport()))).toEqual([])
  })

  it("names each field still blocking submission, without duplicates", () => {
    const draft = visitReportDraftSchema.parse({})
    const missing = missingSubmitFields(draft)
    expect(missing).toContain("visitOutcome")
    expect(missing).toContain("meetingSummary")
    expect(missing).toContain("interestLevel")
    expect(missing).toContain("clientNeeds")
    expect(missing).toContain("contacts")
    expect(new Set(missing).size).toBe(missing.length)
  })
})

describe("contactFromAppointment", () => {
  it("turns the appointment into the first report contact", () => {
    expect(contactFromAppointment({ name: " Budi Santoso ", jobTitle: "GM", phone: "+628123456789", email: null })).toEqual({
      fullName: "Budi Santoso",
      jobTitle: "GM",
      phone: "+628123456789",
      email: "",
      isDecisionMaker: false,
      discPrimary: null,
      discSecondary: null,
      discNote: "",
    })
  })

  it("is null when the mission has no named contact", () => {
    expect(contactFromAppointment({ name: null, jobTitle: "GM", phone: null, email: null })).toBeNull()
    expect(contactFromAppointment({ name: "  ", jobTitle: null, phone: null, email: null })).toBeNull()
  })

  it("recognises the appointment contact by name, case-insensitively", () => {
    const appointment = contactFromAppointment({ name: "Budi Santoso", jobTitle: null, phone: null, email: null })
    expect(isAppointmentContact({ fullName: "budi santoso" }, appointment)).toBe(true)
    expect(isAppointmentContact({ fullName: "Siti" }, appointment)).toBe(false)
    expect(isAppointmentContact({ fullName: "Budi Santoso" }, null)).toBe(false)
  })
})
