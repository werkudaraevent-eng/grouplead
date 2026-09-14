import { describe, expect, it } from "vitest"
import { visitActivities } from "./lead-activity"

const mission = { clientCompanyName: "Apple", scheduledStart: "2026-09-10T02:30:00.000Z", location: "Singapore", missionType: "Meeting" }
const report = {
  visitOutcome: "MET_DECISION_MAKER" as const,
  meetingSummary: "Tim tertarik dengan wellness.",
  clientNeeds: ["Team building", "Gathering"],
  interestLevel: "HOT" as const,
  nextActionType: "SEND_PROPOSAL" as const,
  followUpDate: "2026-09-29",
  contacts: [
    { fullName: "Tim Cook", jobTitle: "CEO", phone: "", email: "", isDecisionMaker: true, leadEngineContactId: null },
    { fullName: "Ani", jobTitle: "", phone: "", email: "", isDecisionMaker: false, leadEngineContactId: null },
  ],
}

describe("visitActivities", () => {
  it("writes the visit as a meeting dated when it happened, then the hand-off", () => {
    const [meeting, created] = visitActivities(mission, report, "Hanung")
    expect(meeting.type).toBe("Meeting")
    expect(meeting.occurredAt).toBe(mission.scheduledStart)
    expect(meeting.description).toContain("Meeting · Apple · Singapore · 10 September 2026")
    expect(meeting.description).toContain("Hasil: Bertemu pengambil keputusan")
    expect(meeting.description).toContain("Bertemu: Tim Cook (CEO), Ani")
    expect(meeting.description).toContain("Kebutuhan: Team building, Gathering")
    expect(meeting.description).toContain("Next action: Kirim proposal (2026-09-29)")
    expect(meeting.description.endsWith("Tim tertarik dengan wellness.")).toBe(true)
    expect(created.type).toBe("lead_created")
    expect(created.occurredAt).toBeNull()
    expect(created.description).toContain("Hanung")
  })

  it("leaves out what the report does not say", () => {
    const [meeting] = visitActivities(
      { ...mission, scheduledStart: null, location: null },
      { ...report, visitOutcome: null, contacts: [], clientNeeds: [], interestLevel: null, nextActionType: "NONE", followUpDate: null, meetingSummary: "" },
      "Hanung"
    )
    expect(meeting.description).toBe("Meeting · Apple")
    expect(meeting.occurredAt).toBeNull()
  })
})
