import { describe, expect, it } from "vitest"
import { statusBeforeCompletion } from "./report-withdraw"

describe("statusBeforeCompletion", () => {
  it("returns the status the latest completion came from", () => {
    expect(
      statusBeforeCompletion([
        { fromStatus: "SCHEDULED", toStatus: "ASSIGNED", createdAt: "2026-09-10T01:00:00Z" },
        { fromStatus: "ASSIGNED", toStatus: "ACCEPTED", createdAt: "2026-09-10T02:00:00Z" },
        { fromStatus: "IN_PROGRESS", toStatus: "COMPLETED", createdAt: "2026-09-17T09:00:00Z" },
      ])
    ).toBe("IN_PROGRESS")
  })

  it("uses the most recent completion when a report was sent twice", () => {
    expect(
      statusBeforeCompletion([
        { fromStatus: "ACCEPTED", toStatus: "COMPLETED", createdAt: "2026-09-17T09:00:00Z" },
        { fromStatus: "COMPLETED", toStatus: "ACCEPTED", createdAt: "2026-09-17T10:00:00Z" },
        { fromStatus: "ACCEPTED", toStatus: "COMPLETED", createdAt: "2026-09-17T11:00:00Z" },
      ])
    ).toBe("ACCEPTED")
  })

  it("falls back to ACCEPTED without a usable row", () => {
    expect(statusBeforeCompletion([])).toBe("ACCEPTED")
    expect(statusBeforeCompletion([{ fromStatus: null, toStatus: "COMPLETED", createdAt: "2026-09-17T09:00:00Z" }])).toBe("ACCEPTED")
    expect(statusBeforeCompletion([{ fromStatus: "CANCELLED", toStatus: "COMPLETED", createdAt: "2026-09-17T09:00:00Z" }])).toBe("ACCEPTED")
  })
})
