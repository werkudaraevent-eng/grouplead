import { describe, expect, it } from "vitest"
import { canClaimProspect, canEditProspect } from "./prospect-access"

describe("prospect access", () => {
  it("lets the owner, an admin, or anyone on an unowned prospect edit", () => {
    expect(canEditProspect({ ownerId: "a" }, { userId: "a", isAdmin: false })).toBe(true)
    expect(canEditProspect({ ownerId: "a" }, { userId: "b", isAdmin: false })).toBe(false)
    expect(canEditProspect({ ownerId: "a" }, { userId: "b", isAdmin: true })).toBe(true)
    expect(canEditProspect({ ownerId: null }, { userId: "b", isAdmin: false })).toBe(true)
  })

  it("offers claiming to anyone but the current owner", () => {
    expect(canClaimProspect({ ownerId: null }, { userId: "a" })).toBe(true)
    expect(canClaimProspect({ ownerId: "a" }, { userId: "a" })).toBe(false)
    expect(canClaimProspect({ ownerId: "a" }, { userId: "b" })).toBe(true)
  })
})
