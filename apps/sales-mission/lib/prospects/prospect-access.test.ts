import { describe, expect, it } from "vitest"
import { canAssignOthers, canAssignTo, canEditProspect, type ProspectViewer } from "./prospect-access"

const viewer = (scope: ProspectViewer["scope"], subordinateIds: string[] = []): ProspectViewer => ({ userId: "me", scope, subordinateIds })

describe("prospect access", () => {
  it("lets the holder, anyone in reach, or anyone on an unowned prospect edit", () => {
    expect(canEditProspect({ ownerId: "me" }, viewer("own"))).toBe(true)
    expect(canEditProspect({ ownerId: "a" }, viewer("own"))).toBe(false)
    expect(canEditProspect({ ownerId: "a" }, viewer("team", ["a"]))).toBe(true)
    expect(canEditProspect({ ownerId: "a" }, viewer("team", ["b"]))).toBe(false)
    expect(canEditProspect({ ownerId: "a" }, viewer("all"))).toBe(true)
    expect(canEditProspect({ ownerId: null }, viewer("own"))).toBe(true)
  })

  it("hands prospects only to people in reach", () => {
    expect(canAssignTo(viewer("own"), "me")).toBe(true)
    expect(canAssignTo(viewer("own"), "a")).toBe(false)
    expect(canAssignTo(viewer("own"), null)).toBe(false)
    expect(canAssignTo(viewer("team", ["a"]), "a")).toBe(true)
    expect(canAssignTo(viewer("team", ["a"]), "b")).toBe(false)
    expect(canAssignTo(viewer("team", ["a"]), null)).toBe(true)
    expect(canAssignTo(viewer("all"), "b")).toBe(true)
  })

  it("offers the assign controls beyond own scope only", () => {
    expect(canAssignOthers(viewer("own"))).toBe(false)
    expect(canAssignOthers(viewer("team"))).toBe(true)
    expect(canAssignOthers(viewer("all"))).toBe(true)
  })
})
