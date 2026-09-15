import { describe, expect, it } from "vitest"
import {
  archiveViolation,
  displayStatus,
  entryStatus,
  nextStatusOrder,
  reorderStatus,
  toStatusCode,
  wonStatus,
  type ProspectStatus,
} from "./prospect-status"

const s = (over: Partial<ProspectStatus> & Pick<ProspectStatus, "id" | "kind">): ProspectStatus => ({
  code: over.id,
  label: over.id,
  color: "neutral",
  isActive: true,
  displayOrder: 10,
  ...over,
})

const set = [
  s({ id: "u", kind: "open", displayOrder: 10 }),
  s({ id: "p", kind: "in_progress", displayOrder: 20 }),
  s({ id: "c", kind: "won", displayOrder: 30 }),
  s({ id: "d", kind: "lost", displayOrder: 40 }),
]

describe("anchors", () => {
  it("picks the lowest-ordered active status of the kind", () => {
    expect(entryStatus(set)?.id).toBe("u")
    expect(wonStatus(set)?.id).toBe("c")
    const twoOpen = [s({ id: "late", kind: "open", displayOrder: 50 }), ...set]
    expect(entryStatus(twoOpen)?.id).toBe("u")
  })

  it("falls back to an archived anchor rather than nothing", () => {
    const archived = set.map((status) => (status.id === "u" ? { ...status, isActive: false } : status))
    expect(entryStatus(archived)?.id).toBe("u")
    expect(entryStatus([])).toBeNull()
  })
})

describe("archiveViolation", () => {
  it("protects the last open and the last won", () => {
    expect(archiveViolation(set, "u")).toMatch(/status awal/)
    expect(archiveViolation(set, "c")).toMatch(/janji temu/)
    expect(archiveViolation(set, "p")).toBeNull()
    expect(archiveViolation(set, "d")).toBeNull()
  })

  it("allows archiving an anchor once another of its kind is active", () => {
    expect(archiveViolation([...set, s({ id: "u2", kind: "open", displayOrder: 15 })], "u")).toBeNull()
  })
})

describe("toStatusCode", () => {
  it("slugs the label and keeps it unique", () => {
    expect(toStatusCode("Hubungi Lagi", [])).toBe("hubungi_lagi")
    expect(toStatusCode("Hubungi Lagi", ["hubungi_lagi"])).toBe("hubungi_lagi_2")
    expect(toStatusCode("2nd Call", [])).toBe("s2nd_call")
    expect(toStatusCode("!!!", [])).toBe("status")
  })
})

describe("reorderStatus", () => {
  it("swaps neighbours among active statuses and renumbers in tens", () => {
    const moved = reorderStatus(set, "c", "up")
    const order = moved.filter((x) => x.isActive).sort((a, b) => a.displayOrder - b.displayOrder).map((x) => x.id)
    expect(order).toEqual(["u", "c", "p", "d"])
    expect(moved.find((x) => x.id === "c")?.displayOrder).toBe(20)
    expect(nextStatusOrder(moved)).toBe(50)
  })

  it("ignores moves off the end and archived rows", () => {
    expect(reorderStatus(set, "u", "up")).toEqual(set)
  })
})

describe("displayStatus", () => {
  it("lets the mission's fate override a converted prospect's label", () => {
    const stored = { label: "Confirmed", color: "success" as const, kind: "won" as const }
    expect(displayStatus(stored, "stored")).toEqual({ label: "Confirmed", color: "success", derived: false })
    expect(displayStatus(stored, "rescheduled").label).toBe("Rescheduled")
    expect(displayStatus(stored, "completed").color).toBe("success")
    expect(displayStatus(stored, "mission_cancelled")).toEqual({ label: "Cancelled", color: "danger", derived: true })
  })
})
