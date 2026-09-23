import { describe, expect, it } from "vitest"
import { grantsWriteWithoutRead, newSubsidiaryRow, planSubsidiaryUpdates, IMPLIED_READ } from "./subsidiary-writes"

const row = (id: string, can_read: string) => ({ id, company_id: `c-${id}`, can_read })

describe("grantsWriteWithoutRead", () => {
  it("is true for a write switched on without Lihat in the payload", () => {
    expect(grantsWriteWithoutRead({ can_create: true })).toBe(true)
    expect(grantsWriteWithoutRead({ can_update: true })).toBe(true)
    expect(grantsWriteWithoutRead({ can_delete: true })).toBe(true)
  })

  it("is false when the payload sets Lihat itself, or only switches writes off", () => {
    expect(grantsWriteWithoutRead({ can_create: true, can_read: "company" })).toBe(false)
    expect(grantsWriteWithoutRead({ can_read: "none", can_create: false })).toBe(false)
    expect(grantsWriteWithoutRead({ can_delete: false })).toBe(false)
    expect(grantsWriteWithoutRead({ read_scope: "team", record_scope: "own" })).toBe(false)
  })
})

describe("planSubsidiaryUpdates", () => {
  it("adds the implied Lihat only to rows whose Lihat is off", () => {
    const plan = planSubsidiaryUpdates([row("a", "none"), row("b", "company"), row("c", "none")], { can_create: true })
    expect(plan.impliedReadIds).toEqual(["a", "c"])
    expect(plan.plainIds).toEqual(["b"])
    expect(plan.impliedReadUpdates).toEqual({ can_create: true, can_read: IMPLIED_READ })
  })

  it("writes every row plainly when the payload grants no write", () => {
    const plan = planSubsidiaryUpdates([row("a", "none"), row("b", "company")], { can_create: false })
    expect(plan.plainIds).toEqual(["a", "b"])
    expect(plan.impliedReadIds).toEqual([])
  })

  it("never overrides a Lihat the payload sets", () => {
    const plan = planSubsidiaryUpdates([row("a", "none")], { can_read: "none", can_create: false, can_update: false, can_delete: false })
    expect(plan.plainIds).toEqual(["a"])
  })
})

describe("newSubsidiaryRow", () => {
  const base = { company_id: "c1", role_id: "r1", module_id: "leads", record_scope: "own", read_scope: "all" }

  it("turns Lihat on when the payload grants a write", () => {
    expect(newSubsidiaryRow(base, { can_delete: true })).toMatchObject({ can_read: IMPLIED_READ, can_delete: true, can_create: false })
  })

  it("keeps everything off except the payload otherwise", () => {
    expect(newSubsidiaryRow(base, { can_read: "company" })).toMatchObject({ can_read: "company", can_create: false, can_update: false, can_delete: false })
    expect(newSubsidiaryRow(base, { can_create: false })).toMatchObject({ can_read: "none" })
  })

  it("satisfies write-requires-read for every single-switch payload", () => {
    for (const field of ["can_create", "can_update", "can_delete"] as const) {
      const created = newSubsidiaryRow(base, { [field]: true })
      const writes = created.can_create || created.can_update || created.can_delete
      expect(created.can_read !== "none" || !writes).toBe(true)
    }
  })
})
