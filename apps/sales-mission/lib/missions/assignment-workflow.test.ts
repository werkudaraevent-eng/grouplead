import { describe, expect, it } from "vitest"
import {
  applyRescheduleApproval,
  applyRescheduleRejection,
  canRespond,
  deriveMissionStatus,
  rescheduleRequestSchema,
  type AssignmentState,
} from "./assignment-workflow"

const PRIMARY = "11111111-1111-4111-8111-111111111111"
const SUPPORT = "22222222-2222-4222-8222-222222222222"

function state(role: "PRIMARY" | "SUPPORTING", response: AssignmentState["response"]): AssignmentState {
  return { role, response }
}

describe("deriveMissionStatus", () => {
  it("moves to ACCEPTED only once the primary accepts", () => {
    expect(deriveMissionStatus("ASSIGNED", [state("PRIMARY", "ACCEPTED")])).toBe("ACCEPTED")
    expect(deriveMissionStatus("ASSIGNED", [state("PRIMARY", "PENDING")])).toBe("ASSIGNED")
  })

  it("does not let supporting sales carry the mission", () => {
    const assignments = [state("PRIMARY", "PENDING"), state("SUPPORTING", "ACCEPTED")]
    expect(deriveMissionStatus("ASSIGNED", assignments)).toBe("ASSIGNED")
  })

  it("does not let a supporting rejection block the mission", () => {
    const assignments = [state("PRIMARY", "ACCEPTED"), state("SUPPORTING", "REJECTED")]
    expect(deriveMissionStatus("ASSIGNED", assignments)).toBe("ACCEPTED")
  })

  it("marks the mission rejected when the primary declines", () => {
    expect(deriveMissionStatus("ASSIGNED", [state("PRIMARY", "REJECTED")])).toBe("REJECTED")
  })

  it("lets an open reschedule request outrank an acceptance", () => {
    const assignments = [state("PRIMARY", "ACCEPTED"), state("SUPPORTING", "RESCHEDULE_REQUESTED")]
    expect(deriveMissionStatus("ACCEPTED", assignments)).toBe("RESCHEDULE_REQUESTED")
  })

  it("falls back to SCHEDULED when no primary is assigned", () => {
    expect(deriveMissionStatus("ASSIGNED", [state("SUPPORTING", "ACCEPTED")])).toBe("SCHEDULED")
    expect(deriveMissionStatus("ASSIGNED", [])).toBe("SCHEDULED")
  })

  it("never resurrects a finished or cancelled mission", () => {
    expect(deriveMissionStatus("COMPLETED", [state("PRIMARY", "PENDING")])).toBe("COMPLETED")
    expect(deriveMissionStatus("CANCELLED", [state("PRIMARY", "ACCEPTED")])).toBe("CANCELLED")
  })

  it("leaves a mission that is already under way alone", () => {
    expect(deriveMissionStatus("IN_PROGRESS", [state("PRIMARY", "PENDING")])).toBe("IN_PROGRESS")
  })
})

describe("canRespond", () => {
  it("closes once the visit is over, cancelled, or under way", () => {
    expect(canRespond("ASSIGNED")).toBe(true)
    expect(canRespond("ACCEPTED")).toBe(true)
    expect(canRespond("RESCHEDULE_REQUESTED")).toBe(true)
    expect(canRespond("COMPLETED")).toBe(false)
    expect(canRespond("CANCELLED")).toBe(false)
    expect(canRespond("IN_PROGRESS")).toBe(false)
  })
})

describe("rescheduleRequestSchema", () => {
  const valid = { date: "2026-09-10", startTime: "09:30", reason: "Klien minta mundur" }

  it("accepts a well-formed request", () => {
    expect(rescheduleRequestSchema.safeParse(valid).success).toBe(true)
  })

  it("requires a reason — an unexplained move gives the admin nothing to decide on", () => {
    expect(rescheduleRequestSchema.safeParse({ ...valid, reason: "   " }).success).toBe(false)
  })

  it("rejects an end time at or before the start", () => {
    expect(rescheduleRequestSchema.safeParse({ ...valid, endTime: "09:30" }).success).toBe(false)
    expect(rescheduleRequestSchema.safeParse({ ...valid, endTime: "11:00" }).success).toBe(true)
  })

  it("rejects malformed dates and times", () => {
    expect(rescheduleRequestSchema.safeParse({ ...valid, date: "10-09-2026" }).success).toBe(false)
    expect(rescheduleRequestSchema.safeParse({ ...valid, startTime: "9:30" }).success).toBe(false)
  })
})

describe("applyRescheduleApproval", () => {
  const assignments = [
    { userId: PRIMARY, role: "PRIMARY" as const },
    { userId: SUPPORT, role: "SUPPORTING" as const },
  ]

  it("keeps the requester's acceptance and resets everyone else", () => {
    const result = applyRescheduleApproval(assignments, SUPPORT)
    expect(result.responses).toEqual([
      { userId: PRIMARY, response: "PENDING" },
      { userId: SUPPORT, response: "ACCEPTED" },
    ])
    // The primary has not agreed to the new time, so the mission is not accepted.
    expect(result.missionStatus).toBe("ASSIGNED")
  })

  it("leaves the mission accepted when the primary is the one who proposed it", () => {
    const result = applyRescheduleApproval(assignments, PRIMARY)
    expect(result.responses.find((r) => r.userId === PRIMARY)?.response).toBe("ACCEPTED")
    expect(result.missionStatus).toBe("ACCEPTED")
  })
})

describe("applyRescheduleRejection", () => {
  it("only unwinds the requester, leaving other answers intact", () => {
    const result = applyRescheduleRejection([
      { userId: PRIMARY, role: "PRIMARY", response: "ACCEPTED" },
      { userId: SUPPORT, role: "SUPPORTING", response: "RESCHEDULE_REQUESTED" },
    ])

    expect(result.responses).toEqual([{ userId: SUPPORT, response: "PENDING" }])
    // The primary still accepts the original time, so the mission stands.
    expect(result.missionStatus).toBe("ACCEPTED")
  })

  it("returns the mission to ASSIGNED when it was the primary who asked", () => {
    const result = applyRescheduleRejection([
      { userId: PRIMARY, role: "PRIMARY", response: "RESCHEDULE_REQUESTED" },
      { userId: SUPPORT, role: "SUPPORTING", response: "ACCEPTED" },
    ])

    expect(result.responses).toEqual([{ userId: PRIMARY, response: "PENDING" }])
    expect(result.missionStatus).toBe("ASSIGNED")
  })
})
