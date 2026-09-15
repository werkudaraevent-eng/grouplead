import { describe, expect, it } from "vitest"
import { canEditSubmittedReport, describeEditWindow, editWindowEndsAt } from "./report-edit"

const sent = "2026-09-10T03:00:00.000Z"
const base = { isAdmin: false, isPrimary: true, submittedAt: sent, windowDays: 7 }

describe("canEditSubmittedReport", () => {
  it("lets the author edit inside the window and not after", () => {
    expect(canEditSubmittedReport({ ...base, now: new Date("2026-09-15T00:00:00Z") })).toMatchObject({ allowed: true, by: "author" })
    expect(canEditSubmittedReport({ ...base, now: new Date("2026-09-18T00:00:00Z") })).toEqual({ allowed: false, reason: "window_closed" })
  })

  it("lets an admin edit whenever, and nobody else", () => {
    expect(canEditSubmittedReport({ ...base, isAdmin: true, isPrimary: false, now: new Date("2027-01-01T00:00:00Z") })).toMatchObject({ allowed: true, by: "admin" })
    expect(canEditSubmittedReport({ ...base, isPrimary: false, now: new Date("2026-09-11T00:00:00Z") })).toEqual({ allowed: false, reason: "not_author" })
  })

  it("treats a window of zero as admin only, and an unsent report as nothing to reopen", () => {
    expect(canEditSubmittedReport({ ...base, windowDays: 0, now: new Date("2026-09-10T04:00:00Z") })).toEqual({ allowed: false, reason: "admin_only" })
    expect(canEditSubmittedReport({ ...base, submittedAt: null, now: new Date() })).toEqual({ allowed: false, reason: "not_sent" })
  })

  it("computes the window end from the submission time", () => {
    expect(editWindowEndsAt(sent, 7)?.toISOString()).toBe("2026-09-17T03:00:00.000Z")
    expect(editWindowEndsAt(sent, 0)).toBeNull()
  })
})

describe("describeEditWindow", () => {
  it("says until when, or why not", () => {
    expect(describeEditWindow(canEditSubmittedReport({ ...base, now: new Date("2026-09-12T00:00:00Z") }), 7)).toContain("Bisa diubah sendiri sampai")
    expect(describeEditWindow({ allowed: false, reason: "window_closed" }, 7)).toContain("7 hari sudah lewat")
    expect(describeEditWindow({ allowed: false, reason: "admin_only" }, 0)).toContain("hanya bisa diubah admin")
    expect(describeEditWindow({ allowed: true, by: "admin", until: null }, 7)).toBeNull()
    expect(describeEditWindow({ allowed: false, reason: "not_author" }, 7)).toBeNull()
  })
})
