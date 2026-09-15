import { describe, expect, it } from "vitest"
import {
  archiveChoiceViolation,
  choicesFor,
  defaultChoiceSet,
  isDecisionMakerOutcome,
  isNoAction,
  isNoInterest,
  kindOf,
  labelOf,
  noActionCode,
  outcomeReachesCrm,
  outcomeRequiresContacts,
  reorderChoice,
  reportChoiceViolation,
  toChoiceCode,
  type ChoiceSet,
} from "./report-choices"

function tenant(): ChoiceSet {
  const set = defaultChoiceSet()
  // The admin relabelled one, archived one, and added one of their own.
  set.visit_outcome = set.visit_outcome.map((choice) =>
    choice.code === "MET_STAFF" ? { ...choice, label: "Bertemu tim procurement" } : choice.code === "CANCELLED_ON_SITE" ? { ...choice, isActive: false } : choice
  )
  set.visit_outcome.push({ id: "x", fieldKey: "visit_outcome", code: "VIDEO_CALL", label: "Bertemu via video call", kind: "met_decision_maker", isActive: true, displayOrder: 60 })
  return set
}

describe("kinds and labels", () => {
  it("reads the tenant's label and kind, falling back to the seed and then to the safest kind", () => {
    const set = tenant()
    expect(labelOf(set, "visit_outcome", "MET_STAFF")).toBe("Bertemu tim procurement")
    expect(labelOf(null, "visit_outcome", "MET_STAFF")).toBe("Bertemu staf")
    expect(labelOf(set, "visit_outcome", "UNKNOWN")).toBe("UNKNOWN")
    expect(kindOf(set, "visit_outcome", "VIDEO_CALL")).toBe("met_decision_maker")
    expect(kindOf(set, "visit_outcome", "UNKNOWN")).toBe("met_staff")
  })

  it("drives the rules by kind, so an added choice behaves like its kind", () => {
    const set = tenant()
    expect(isDecisionMakerOutcome("VIDEO_CALL", set)).toBe(true)
    expect(outcomeReachesCrm("VIDEO_CALL", set)).toBe(true)
    expect(outcomeRequiresContacts("CLIENT_ABSENT", set)).toBe(false)
    expect(outcomeRequiresContacts("VIDEO_CALL", set)).toBe(true)
    expect(isNoInterest("NO_INTEREST")).toBe(true)
    expect(isNoAction("NONE")).toBe(true)
    expect(isNoAction("SEND_PROPOSAL")).toBe(false)
    expect(noActionCode(set)).toBe("NONE")
  })

  it("offers the active choices in order, plus an archived one a report still carries", () => {
    const set = tenant()
    expect(choicesFor(set, "visit_outcome").map((choice) => choice.code)).toEqual(["MET_DECISION_MAKER", "MET_STAFF", "RESCHEDULED_ON_SITE", "CLIENT_ABSENT", "VIDEO_CALL"])
    expect(choicesFor(set, "visit_outcome", "CANCELLED_ON_SITE").map((choice) => choice.code)).toContain("CANCELLED_ON_SITE")
  })
})

describe("reportChoiceViolation", () => {
  const ok = { visitOutcome: "MET_STAFF", interestLevel: "WARM", nextActionType: "SEND_PROPOSAL", opportunityExists: true, contactCount: 1, nextActionOwner: "u", followUpDate: "2026-09-20" }

  it("accepts a report that fits its kinds", () => {
    expect(reportChoiceViolation(tenant(), ok)).toBeNull()
  })

  it("refuses codes the tenant does not have, and re-applies the kind rules", () => {
    const set = tenant()
    expect(reportChoiceViolation(set, { ...ok, visitOutcome: "TELEPATHY" })).toContain("Hasil kunjungan")
    expect(reportChoiceViolation(set, { ...ok, contactCount: 0 })).toContain("kontak")
    expect(reportChoiceViolation(set, { ...ok, visitOutcome: "CLIENT_ABSENT", contactCount: 0 })).toBeNull()
    expect(reportChoiceViolation(set, { ...ok, interestLevel: "NO_INTEREST" })).toContain("Peluang")
    expect(reportChoiceViolation(set, { ...ok, nextActionOwner: null })).toContain("penanggung jawab")
    expect(reportChoiceViolation(set, { ...ok, nextActionType: "NONE", nextActionOwner: null, followUpDate: null })).toBeNull()
  })
})

describe("admin moves", () => {
  it("derives an upper-snake code that stays unique", () => {
    expect(toChoiceCode("Bertemu via video call", [])).toBe("BERTEMU_VIA_VIDEO_CALL")
    expect(toChoiceCode("Bertemu via video call", ["BERTEMU_VIA_VIDEO_CALL"])).toBe("BERTEMU_VIA_VIDEO_CALL_2")
    expect(toChoiceCode("3 hari", [])).toBe("C3_HARI")
  })

  it("keeps one active choice per field and one 'none' next action", () => {
    const set = defaultChoiceSet()
    const none = set.next_action_type.find((choice) => choice.code === "NONE")!
    expect(archiveChoiceViolation(set.next_action_type, none.id)).toContain("Tidak ada tindak lanjut")
    const only = [{ ...none, id: "solo" }]
    expect(archiveChoiceViolation(only, "solo")).toContain("minimal satu")
    expect(archiveChoiceViolation(set.visit_outcome, set.visit_outcome[0].id)).toBeNull()
  })

  it("reorders within the active list and renumbers in tens", () => {
    const set = defaultChoiceSet()
    const moved = reorderChoice(set.interest_level, set.interest_level[1].id, "up")
    expect(moved.filter((choice) => choice.isActive).sort((a, b) => a.displayOrder - b.displayOrder).map((choice) => choice.code)).toEqual(["WARM", "HOT", "COLD", "NO_INTEREST"])
  })
})
