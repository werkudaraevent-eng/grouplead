import { describe, expect, it } from "vitest"
import { currentFollowUp, followUpState, logFollowUpSchema, sortFollowUps } from "./follow-ups"

describe("followUpState", () => {
  it("is late only while open and past its day", () => {
    expect(followUpState({ status: "OPEN", dueDate: "2026-09-20" }, "2026-09-21")).toBe("late")
    expect(followUpState({ status: "OPEN", dueDate: "2026-09-21" }, "2026-09-21")).toBe("open")
    expect(followUpState({ status: "OPEN", dueDate: null }, "2026-09-21")).toBe("open")
    expect(followUpState({ status: "DONE", dueDate: "2026-09-01" }, "2026-09-21")).toBe("done")
    expect(followUpState({ status: "CANCELLED", dueDate: "2026-09-01" }, "2026-09-21")).toBe("cancelled")
  })
})

describe("currentFollowUp", () => {
  it("prefers the open one, else the latest", () => {
    const items = [
      { id: "a", createdAt: "2026-09-01T00:00:00Z", status: "DONE" as const },
      { id: "b", createdAt: "2026-09-02T00:00:00Z", status: "DONE" as const },
    ]
    expect(currentFollowUp(items)?.id).toBe("b")
    expect(currentFollowUp([...items, { id: "c", createdAt: "2026-08-01T00:00:00Z", status: "OPEN" as const }])?.id).toBe("c")
    expect(currentFollowUp([])).toBeNull()
    expect(sortFollowUps(items).map((item) => item.id)).toEqual(["a", "b"])
  })
})

describe("logFollowUpSchema", () => {
  it("accepts a close without a next step and with one", () => {
    expect(logFollowUpSchema.safeParse({ channel: "PHONE", outcome: "ADVANCED", note: "" }).success).toBe(true)
    expect(logFollowUpSchema.safeParse({ channel: "PHONE", outcome: "ADVANCED", next: { actionType: "SEND_PROPOSAL", dueDate: "2026-09-25" } }).success).toBe(true)
    expect(logFollowUpSchema.safeParse({ channel: "", outcome: "ADVANCED" }).success).toBe(false)
    expect(logFollowUpSchema.safeParse({ channel: "PHONE", outcome: "ADVANCED", next: { actionType: "X", dueDate: "25-09-2026" } }).success).toBe(false)
  })
})
