import { describe, expect, it } from "vitest"
import { describeTiming, formatVisitWindow, isOnTime, splitMissionInstant, startDelayMinutes, toVisitInstants, visitDurationMinutes, visitTimeInFuture, visitTimeViolation } from "./visit-time"

describe("visitTimeInFuture", () => {
  const now = new Date("2026-09-17T10:00:00+07:00")
  it("flags a start after now, in mission time", () => {
    expect(visitTimeInFuture({ actualDate: "2026-09-21", actualStartTime: "09:00" }, now)).toBe(true)
    expect(visitTimeInFuture({ actualDate: "2026-09-17", actualStartTime: "10:30" }, now)).toBe(true)
    expect(visitTimeInFuture({ actualDate: "2026-09-17", actualStartTime: "09:30" }, now)).toBe(false)
  })
  it("is not a verdict on an empty or broken window", () => {
    expect(visitTimeInFuture({}, now)).toBe(false)
    expect(visitTimeInFuture({ actualDate: "2026-09-21" }, now)).toBe(false)
  })
})

describe("splitMissionInstant / toVisitInstants", () => {
  it("round-trips a mission-time date and clock", () => {
    const instants = toVisitInstants({ actualDate: "2026-09-17", actualStartTime: "17:05", actualEndTime: "18:10" })
    expect(instants.start).toBe("2026-09-17T17:05:00+07:00")
    expect(splitMissionInstant(instants.start)).toEqual({ date: "2026-09-17", time: "17:05" })
    expect(splitMissionInstant(instants.end)).toEqual({ date: "2026-09-17", time: "18:10" })
    expect(splitMissionInstant(null)).toBeNull()
  })

  it("stores nothing for an empty or broken window", () => {
    expect(toVisitInstants({})).toEqual({ start: null, end: null })
    expect(toVisitInstants({ actualDate: "2026-09-17", actualStartTime: "17:05", actualEndTime: "16:00" })).toEqual({ start: null, end: null })
  })
})

describe("visitTimeViolation", () => {
  it("accepts nothing at all, and a start with or without an end", () => {
    expect(visitTimeViolation({})).toBeNull()
    expect(visitTimeViolation({ actualDate: "2026-09-17", actualStartTime: "17:05" })).toBeNull()
    expect(visitTimeViolation({ actualDate: "2026-09-17", actualStartTime: "17:05", actualEndTime: "18:10" })).toBeNull()
  })

  it("refuses half a window and an end before the start", () => {
    expect(visitTimeViolation({ actualDate: "2026-09-17" })).toContain("Lengkapi")
    expect(visitTimeViolation({ actualStartTime: "17:05" })).toContain("Lengkapi")
    expect(visitTimeViolation({ actualDate: "2026-09-17", actualStartTime: "17:05", actualEndTime: "17:05" })).toContain("setelah")
    expect(visitTimeViolation({ actualDate: "17/09/2026", actualStartTime: "17:05" })).toContain("Tanggal")
  })
})

describe("timing against the appointment", () => {
  const planned = "2026-09-17T15:00:00+07:00"

  it("measures the delay and grants the grace period", () => {
    expect(startDelayMinutes("2026-09-17T17:05:00+07:00", planned)).toBe(125)
    expect(isOnTime("2026-09-17T15:10:00+07:00", planned)).toBe(true)
    expect(isOnTime("2026-09-17T15:20:00+07:00", planned)).toBe(false)
    expect(isOnTime(null, planned)).toBeNull()
  })

  it("says it in one line", () => {
    expect(describeTiming("2026-09-17T15:10:00+07:00", planned)).toEqual({ text: "Sesuai jadwal", tone: "success" })
    expect(describeTiming("2026-09-17T17:05:00+07:00", planned)).toEqual({ text: "Mulai 2 jam 5 menit setelah jadwal", tone: "warning" })
    expect(describeTiming("2026-09-17T14:20:00+07:00", planned)).toEqual({ text: "Mulai 40 menit sebelum jadwal", tone: "neutral" })
    expect(describeTiming(null, planned)).toBeNull()
  })

  it("formats the window and its length", () => {
    expect(formatVisitWindow("2026-09-17T17:05:00+07:00", "2026-09-17T18:10:00+07:00")).toMatch(/17\.05–18\.10$/)
    expect(formatVisitWindow("2026-09-17T17:05:00+07:00", null)).toMatch(/17\.05$/)
    expect(visitDurationMinutes("2026-09-17T17:05:00+07:00", "2026-09-17T18:10:00+07:00")).toBe(65)
  })
})
