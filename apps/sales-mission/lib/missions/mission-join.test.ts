import { describe, expect, it } from "vitest"
import {
  DEFAULT_CONFLICT_SETTINGS,
  DEFAULT_JOIN_SETTINGS,
  annotateJoinStatus,
  canJoin,
  detectConflict,
  joinBlockedReason,
  resolveJoinStatus,
  type ConflictSettings,
  type JoinCandidate,
  type ScheduledBlock,
} from "./mission-join"

function block(missionId: string, start: string | null, end: string | null = null, location: string | null = null): ScheduledBlock {
  return { missionId, scheduledStart: start, scheduledEnd: end, location }
}

// All times below are UTC. 02:30Z is 09:30 WIB.
const CANDIDATE = block("candidate", "2026-09-01T02:30:00.000Z", "2026-09-01T03:30:00.000Z", "Jakarta Selatan")

describe("detectConflict", () => {
  it("finds no conflict against an empty calendar", () => {
    expect(detectConflict(CANDIDATE, [])).toEqual({ hasConflict: false, conflictingMissionIds: [] })
  })

  it("flags a straightforward overlap", () => {
    const existing = [block("a", "2026-09-01T03:00:00.000Z", "2026-09-01T04:00:00.000Z")]
    const result = detectConflict(CANDIDATE, existing)
    expect(result.hasConflict).toBe(true)
    expect(result.conflictingMissionIds).toEqual(["a"])
  })

  it("flags a gap smaller than the travel buffer even though the meetings do not overlap", () => {
    // Candidate ends 03:30Z; this starts 03:45Z — 15 minutes apart, buffer is 30.
    const existing = [block("a", "2026-09-01T03:45:00.000Z", "2026-09-01T04:30:00.000Z")]
    expect(detectConflict(CANDIDATE, existing).hasConflict).toBe(true)
  })

  it("allows a gap wider than the travel buffer", () => {
    // Starts 04:15Z, 45 minutes after the candidate ends.
    const existing = [block("a", "2026-09-01T04:15:00.000Z", "2026-09-01T05:00:00.000Z")]
    expect(detectConflict(CANDIDATE, existing).hasConflict).toBe(false)
  })

  it("treats exactly the buffer boundary as clear", () => {
    // Starts 04:00Z — precisely 30 minutes after the candidate's 03:30Z end.
    const existing = [block("a", "2026-09-01T04:00:00.000Z", "2026-09-01T04:45:00.000Z")]
    expect(detectConflict(CANDIDATE, existing).hasConflict).toBe(false)
  })

  it("ignores the mission being checked against itself", () => {
    const existing = [block("candidate", "2026-09-01T02:30:00.000Z", "2026-09-01T03:30:00.000Z")]
    expect(detectConflict(CANDIDATE, existing).hasConflict).toBe(false)
  })

  it("ignores unscheduled and unparseable blocks", () => {
    const existing = [block("a", null), block("b", "not-a-date")]
    expect(detectConflict(CANDIDATE, existing).hasConflict).toBe(false)
  })

  it("returns no conflict when the candidate itself is unscheduled", () => {
    const existing = [block("a", "2026-09-01T02:30:00.000Z", "2026-09-01T03:30:00.000Z")]
    expect(detectConflict(block("candidate", null), existing).hasConflict).toBe(false)
  })

  it("assumes an hour for a mission with no end time", () => {
    // Candidate starts 02:30Z. This one starts 03:00Z with no end, so it is
    // treated as 03:00–04:00 and clashes.
    const existing = [block("a", "2026-09-01T03:00:00.000Z", null)]
    expect(detectConflict(CANDIDATE, existing).hasConflict).toBe(true)
  })

  it("reports every clashing mission, not just the first", () => {
    const existing = [
      block("a", "2026-09-01T03:00:00.000Z", "2026-09-01T04:00:00.000Z"),
      block("b", "2026-09-01T02:00:00.000Z", "2026-09-01T02:45:00.000Z"),
      block("far", "2026-09-02T02:00:00.000Z", "2026-09-02T03:00:00.000Z"),
    ]
    expect(detectConflict(CANDIDATE, existing).conflictingMissionIds.sort()).toEqual(["a", "b"])
  })

  it("waives the buffer for the same location when the tenant allows it", () => {
    const settings: ConflictSettings = { ...DEFAULT_CONFLICT_SETTINGS, allowSameLocationBackToBack: true }
    // 15 minutes after the candidate ends, same location.
    const existing = [block("a", "2026-09-01T03:45:00.000Z", "2026-09-01T04:30:00.000Z", "Jakarta Selatan")]
    expect(detectConflict(CANDIDATE, existing, settings).hasConflict).toBe(false)
    // A genuine overlap at the same location is still a conflict.
    const overlapping = [block("b", "2026-09-01T03:00:00.000Z", "2026-09-01T04:00:00.000Z", "Jakarta Selatan")]
    expect(detectConflict(CANDIDATE, overlapping, settings).hasConflict).toBe(true)
  })

  it("does not waive the buffer for a different location", () => {
    const settings: ConflictSettings = { ...DEFAULT_CONFLICT_SETTINGS, allowSameLocationBackToBack: true }
    const existing = [block("a", "2026-09-01T03:45:00.000Z", "2026-09-01T04:30:00.000Z", "Tangerang")]
    expect(detectConflict(CANDIDATE, existing, settings).hasConflict).toBe(true)
  })

  it("finds nothing when conflict checking is switched off", () => {
    const settings: ConflictSettings = { ...DEFAULT_CONFLICT_SETTINGS, conflictCheckEnabled: false }
    const existing = [block("a", "2026-09-01T03:00:00.000Z", "2026-09-01T04:00:00.000Z")]
    expect(detectConflict(CANDIDATE, existing, settings).hasConflict).toBe(false)
  })

  it("honours a zero buffer as back-to-back being allowed", () => {
    const settings: ConflictSettings = { ...DEFAULT_CONFLICT_SETTINGS, travelBufferMinutes: 0 }
    const existing = [block("a", "2026-09-01T03:30:00.000Z", "2026-09-01T04:00:00.000Z")]
    expect(detectConflict(CANDIDATE, existing, settings).hasConflict).toBe(false)
  })
})

describe("resolveJoinStatus", () => {
  const base = { isAssigned: false, isOver: false, allowJoin: true,
    createdBy: "creator",
    createdByName: "Pembuat",
    createdAt: "2026-09-01T01:00:00.000Z",
    reportStatus: "NONE",
    visitOutcome: null, supportingCount: 0, maxSupporting: 2, hasConflict: false }

  it("reports assignment before anything else", () => {
    expect(resolveJoinStatus({ ...base, isAssigned: true, hasConflict: true, allowJoin: false })).toBe("ASSIGNED")
  })

  it("reports the viewer's own clash before the mission's own limits", () => {
    expect(resolveJoinStatus({ ...base, hasConflict: true, allowJoin: false, supportingCount: 5 })).toBe("CONFLICT")
  })

  it("reports closed before full", () => {
    expect(resolveJoinStatus({ ...base, allowJoin: false, supportingCount: 5 })).toBe("CLOSED")
  })

  it("reports full at the cap", () => {
    expect(resolveJoinStatus({ ...base, supportingCount: 2 })).toBe("FULL")
    expect(resolveJoinStatus({ ...base, supportingCount: 1 })).toBe("JOINABLE")
  })

  it("is joinable when nothing blocks it", () => {
    expect(resolveJoinStatus(base)).toBe("JOINABLE")
  })

  it("closes a visit that is over, after assignment and before everything else", () => {
    expect(resolveJoinStatus({ ...base, isOver: true, hasConflict: true })).toBe("OVER")
    expect(resolveJoinStatus({ ...base, isOver: true, isAssigned: true })).toBe("ASSIGNED")
  })

  it("treats a zero cap as never joinable", () => {
    expect(resolveJoinStatus({ ...base, maxSupporting: 0 })).toBe("FULL")
  })
})

describe("canJoin", () => {
  it("permits only the joinable status", () => {
    expect(canJoin("JOINABLE")).toBe(true)
    for (const status of ["ASSIGNED", "OVER", "CONFLICT", "FULL", "CLOSED"] as const) {
      expect(canJoin(status)).toBe(false)
    }
  })
})

describe("annotateJoinStatus", () => {
  function candidate(overrides: Partial<JoinCandidate> & { id: string }): JoinCandidate {
    return {
      scheduledStart: "2026-09-01T02:30:00.000Z",
      scheduledEnd: "2026-09-01T03:30:00.000Z",
      location: "Jakarta Selatan",
      allowJoin: true,
      supportingCount: 0,
      viewerRole: null,
      ...overrides,
    }
  }

  it("marks missions the viewer is already on", () => {
    const result = annotateJoinStatus([candidate({ id: "a", viewerRole: "PRIMARY" })])
    expect(result[0].joinStatus).toBe("ASSIGNED")
  })

  it("derives the viewer's calendar from their own assignments in the same list", () => {
    const result = annotateJoinStatus([
      candidate({ id: "mine", viewerRole: "SUPPORTING" }),
      // Same slot as the mission the viewer is already on.
      candidate({ id: "clashing" }),
      // Next day, no clash.
      candidate({ id: "free", scheduledStart: "2026-09-02T02:30:00.000Z", scheduledEnd: "2026-09-02T03:30:00.000Z" }),
    ])

    expect(result.find((m) => m.id === "mine")?.joinStatus).toBe("ASSIGNED")
    expect(result.find((m) => m.id === "clashing")?.joinStatus).toBe("CONFLICT")
    expect(result.find((m) => m.id === "free")?.joinStatus).toBe("JOINABLE")
  })

  it("never offers a completed or cancelled visit", () => {
    const result = annotateJoinStatus([candidate({ id: "done", status: "COMPLETED" }), candidate({ id: "off", status: "CANCELLED" }), candidate({ id: "open", status: "SCHEDULED" })])
    expect(result.map((m) => m.joinStatus)).toEqual(["OVER", "OVER", "JOINABLE"])
  })

  it("leaves everything joinable when the viewer has no missions at all", () => {
    const result = annotateJoinStatus([candidate({ id: "a" }), candidate({ id: "b" })])
    expect(result.map((m) => m.joinStatus)).toEqual(["JOINABLE", "JOINABLE"])
  })

  it("applies the tenant cap and the closed flag", () => {
    const result = annotateJoinStatus(
      [candidate({ id: "full", supportingCount: 2 }), candidate({ id: "closed", allowJoin: false })],
      DEFAULT_JOIN_SETTINGS
    )
    expect(result[0].joinStatus).toBe("FULL")
    expect(result[1].joinStatus).toBe("CLOSED")
  })

  it("preserves the original fields it was given", () => {
    const [only] = annotateJoinStatus([candidate({ id: "a", location: "Tangerang" })])
    expect(only.id).toBe("a")
    expect(only.location).toBe("Tangerang")
  })
})

describe("joinBlockedReason", () => {
  it("explains each blocking status and stays silent otherwise", () => {
    expect(joinBlockedReason("CONFLICT", 2)).toContain("mission pada jam itu")
    expect(joinBlockedReason("FULL", 3)).toContain("3")
    expect(joinBlockedReason("CLOSED", 2)).toContain("menutup")
    expect(joinBlockedReason("JOINABLE", 2)).toBeNull()
    expect(joinBlockedReason("ASSIGNED", 2)).toBeNull()
  })
})
