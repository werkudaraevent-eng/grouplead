import { describe, expect, it } from "vitest"
import { describeAudit, groupAuditEvents, type AuditRow } from "./describe-audit"

function row(overrides: Partial<AuditRow>): AuditRow {
  return {
    id: 1,
    actorId: "u1",
    actorName: "Irvani",
    tableName: "missions",
    action: "UPDATE",
    entityId: "m1",
    missionId: "m1",
    entityLabel: "PT Arunika",
    changes: {},
    txId: 100,
    createdAt: "2026-09-16T02:30:00.000Z",
    ...overrides,
  }
}

describe("describeAudit", () => {
  it("names the mission on create and delete", () => {
    expect(describeAudit(row({ action: "INSERT", changes: { to: {} } })).sentence).toBe("membuat aktivitas ke PT Arunika")
    expect(describeAudit(row({ action: "DELETE", changes: { from: {} } })).tone).toBe("delete")
  })

  it("reads a status change as the verb it is", () => {
    expect(describeAudit(row({ changes: { status: { from: "ACCEPTED", to: "CANCELLED" } } })).sentence).toBe("membatalkan aktivitas ke PT Arunika")
    expect(describeAudit(row({ changes: { status: { from: "ASSIGNED", to: "ACCEPTED" } } })).sentence).toContain("Ditugaskan → Diterima")
  })

  it("labels changed fields for the detail view and hides plumbing columns", () => {
    const result = describeAudit(row({ changes: { location: { from: "Jakarta", to: "Bogor" }, updated_by: { from: "a", to: "b" } } }))
    expect(result.details).toEqual([{ field: "lokasi", from: "Jakarta", to: "Bogor" }])
    expect(result.sentence).toBe("mengubah lokasi pada aktivitas ke PT Arunika")
  })

  it("formats timestamps in mission time and booleans in words", () => {
    const result = describeAudit(row({ changes: { scheduled_start: { from: "2026-09-16T02:30:00.000Z", to: "2026-09-17T07:00:00.000Z" } } }))
    expect(result.sentence).toBe("memindahkan jadwal aktivitas ke PT Arunika")
    expect(result.details[0].to).toContain("14.00")
    const flag = describeAudit(row({ tableName: "mission_settings", changes: { require_assignment_confirmation: { from: false, to: true } } }))
    expect(flag.sentence).toBe("mengubah aturan aktivitas: sales harus mengonfirmasi tidak → ya")
  })

  it("reads an assignment answer", () => {
    expect(describeAudit(row({ tableName: "assignments", changes: { response: { from: "PENDING", to: "ACCEPTED" } } })).sentence).toBe("menerima penugasan aktivitas ke PT Arunika")
    expect(describeAudit(row({ tableName: "assignments", action: "INSERT", changes: { to: { assignment_role: "PRIMARY" } } })).sentence).toBe("ditugaskan sebagai sales utama pada aktivitas ke PT Arunika")
  })

  it("falls back sensibly for a table it has no wording for", () => {
    expect(describeAudit(row({ tableName: "something_new", action: "INSERT", entityLabel: null })).sentence).toBe("menambah something_new")
  })
})

describe("groupAuditEvents", () => {
  it("folds rows from one transaction under the mission row", () => {
    const events = groupAuditEvents([
      row({ id: 3, tableName: "assignments", action: "DELETE", txId: 7 }),
      row({ id: 4, tableName: "missions", action: "DELETE", txId: 7 }),
      row({ id: 5, tableName: "visit_reports", action: "DELETE", txId: 7 }),
      row({ id: 6, tableName: "missions", action: "INSERT", txId: 8 }),
    ])
    expect(events).toHaveLength(2)
    expect(events[0].lead.tableName).toBe("missions")
    expect(events[0].folded.map((r) => r.tableName)).toEqual(["visit_reports", "assignments"])
    expect(events[1].folded).toEqual([])
  })
})
