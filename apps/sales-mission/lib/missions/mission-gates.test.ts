import { describe, expect, it } from "vitest"
import { missionGates, type MissionGateInput } from "./mission-gates"

const none = { owns: false, supervises: false }
const owner = { owns: true, supervises: false }
const boss = { owns: false, supervises: true }

const base: MissionGateInput = {
  status: "ACCEPTED",
  role: null,
  isCreator: false,
  missionUpdate: true,
  mission: none,
  resultCreate: true,
  report: none,
  primaryCanReschedule: true,
}

describe("missionGates", () => {
  it("an admin with scope Semua who is not on the team may do everything, directly", () => {
    expect(missionGates({ ...base, mission: boss, report: boss })).toEqual({
      canEdit: true,
      canCancel: true,
      canManageTeam: true,
      canWriteReport: true,
      scheduleMode: "move",
    })
  })

  it("a stranger with Ubah but scope Sendiri is refused everywhere", () => {
    expect(missionGates(base)).toEqual({ canEdit: false, canCancel: false, canManageTeam: false, canWriteReport: false, scheduleMode: "propose" })
  })

  it("the matrix grant is required even when the record is owned", () => {
    expect(missionGates({ ...base, role: "PRIMARY", mission: owner, report: owner, missionUpdate: false, resultCreate: false })).toEqual({
      canEdit: false,
      canCancel: false,
      canManageTeam: false,
      canWriteReport: false,
      scheduleMode: "propose",
    })
  })

  it("the creator who is not sales utama edits the mission but does not write its report", () => {
    const gates = missionGates({ ...base, isCreator: true, mission: owner, report: none })
    expect(gates.canEdit).toBe(true)
    expect(gates.canWriteReport).toBe(false)
    expect(gates.scheduleMode).toBe("move")
  })

  it("the sales utama moves the visit only when the tenant allows, otherwise proposes", () => {
    const primary = { ...base, role: "PRIMARY" as const, mission: owner, report: owner }
    expect(missionGates(primary).scheduleMode).toBe("move")
    expect(missionGates({ ...primary, primaryCanReschedule: false }).scheduleMode).toBe("propose")
    expect(missionGates({ ...primary, primaryCanReschedule: false }).canEdit).toBe(true)
  })

  it("a supervisor moves directly regardless of the sales-utama setting", () => {
    expect(missionGates({ ...base, mission: boss, primaryCanReschedule: false }).scheduleMode).toBe("move")
  })

  it("a finished or cancelled mission cannot be edited or cancelled, but its team can still be managed", () => {
    for (const status of ["COMPLETED", "CANCELLED"] as const) {
      const gates = missionGates({ ...base, status, mission: boss })
      expect(gates.canEdit).toBe(false)
      expect(gates.canCancel).toBe(false)
      expect(gates.canManageTeam).toBe(true)
    }
  })

  it("supporting sales are participants, not owners", () => {
    const gates = missionGates({ ...base, role: "SUPPORTING", mission: none, report: none })
    expect(gates.canEdit).toBe(false)
    expect(gates.canWriteReport).toBe(false)
  })
})
