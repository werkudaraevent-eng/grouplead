import { describe, expect, it } from "vitest"
import { daysLeft, purgeAt, purgeCutoff, RETENTION_DAYS } from "./recycle-bin"

const NOW = new Date("2026-09-14T08:00:00.000Z")

describe("recycle bin retention", () => {
  it("keeps a deleted mission for the retention period", () => {
    expect(purgeAt("2026-09-01T00:00:00.000Z").toISOString()).toBe("2026-10-01T00:00:00.000Z")
    expect(RETENTION_DAYS).toBe(30)
  })

  it("counts the days left, rounding up, never below zero", () => {
    expect(daysLeft("2026-09-13T08:00:00.000Z", NOW)).toBe(29)
    expect(daysLeft("2026-09-13T09:00:00.000Z", NOW)).toBe(30)
    expect(daysLeft("2026-07-01T00:00:00.000Z", NOW)).toBe(0)
  })

  it("purges what was deleted before the cutoff", () => {
    expect(purgeCutoff(NOW)).toBe("2026-08-15T08:00:00.000Z")
  })
})
