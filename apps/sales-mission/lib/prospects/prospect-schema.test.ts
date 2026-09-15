import { describe, expect, it } from "vitest"
import { attemptInputSchema, describeDueDate, prospectInputSchema, suggestedStatusKind, validateStatusChange } from "./prospect-schema"

describe("prospectInputSchema", () => {
  it("normalises the phone and refuses a bad one", () => {
    const ok = prospectInputSchema.safeParse({ clientCompanyName: "PT Arunika", contactPhone: "0812 3456 7890" })
    expect(ok.success && ok.data.contactPhone).toBe("+6281234567890")
    const bad = prospectInputSchema.safeParse({ clientCompanyName: "PT Arunika", contactPhone: "081" })
    expect(bad.success).toBe(false)
  })

  it("requires the company and accepts everything else blank", () => {
    expect(prospectInputSchema.safeParse({ clientCompanyName: " " }).success).toBe(false)
    expect(prospectInputSchema.safeParse({ clientCompanyName: "PT X", contactEmail: "" }).success).toBe(true)
  })
})

describe("suggestedStatusKind", () => {
  it("maps outcomes to the kind the dialog should preselect", () => {
    expect(suggestedStatusKind("APPOINTMENT")).toBe("won")
    expect(suggestedStatusKind("DECLINED")).toBe("lost")
    expect(suggestedStatusKind("WRONG_NUMBER")).toBe("lost")
    expect(suggestedStatusKind("NO_ANSWER")).toBe("in_progress")
    expect(suggestedStatusKind("REACHED")).toBe("in_progress")
  })
})

describe("validateStatusChange", () => {
  it("refuses a manual won and demands a reason for lost", () => {
    expect(validateStatusChange("won", {})).toMatch(/Jadwalkan kunjungan/)
    expect(validateStatusChange("lost", { lostReason: "" })).toMatch(/alasan/)
    expect(validateStatusChange("lost", { lostReason: "Menolak" })).toBeNull()
    expect(validateStatusChange("in_progress", {})).toBeNull()
  })
})

describe("attemptInputSchema", () => {
  it("accepts a minimal attempt", () => {
    expect(attemptInputSchema.safeParse({ channel: "PHONE", outcome: "NO_ANSWER" }).success).toBe(true)
    expect(attemptInputSchema.safeParse({ channel: "FAX", outcome: "NO_ANSWER" }).success).toBe(false)
  })
})

describe("describeDueDate", () => {
  it("speaks relative for near dates and marks the overdue", () => {
    expect(describeDueDate("2026-09-15", "2026-09-15")).toEqual({ text: "hari ini", overdue: false, due: true })
    expect(describeDueDate("2026-09-16", "2026-09-15").text).toBe("besok")
    expect(describeDueDate("2026-09-12", "2026-09-15")).toEqual({ text: "terlambat 3 hari", overdue: true, due: true })
    expect(describeDueDate("2026-09-23", "2026-09-15").due).toBe(false)
  })
})
