import { describe, expect, it } from "vitest"
import { describeOutOfScope, inScope, isRecordScope, missionOwners, personInScope, prospectOwners, relate, reportOwners, type ScopeContext } from "./record-scope"

const ctx = (scope: ScopeContext["scope"], subordinates: string[] = []): ScopeContext => ({
  scope,
  viewerId: "me",
  subordinateIds: new Set(subordinates),
})

describe("relate / inScope", () => {
  it("own: reaches the viewer's own records and unowned ones only", () => {
    expect(relate(ctx("own"), ["me"])).toEqual({ owns: true, supervises: false })
    expect(relate(ctx("own"), ["other"])).toEqual({ owns: false, supervises: false })
    expect(relate(ctx("own"), [null])).toEqual({ owns: true, supervises: false })
    expect(inScope(ctx("own"), ["other", "me"])).toBe(true)
  })

  it("team: adds records owned by anyone in the subordinate chain", () => {
    const team = ctx("team", ["staff1", "staff2"])
    expect(relate(team, ["staff1"])).toEqual({ owns: false, supervises: true })
    expect(relate(team, ["stranger"])).toEqual({ owns: false, supervises: false })
    expect(relate(team, ["stranger", "staff2"])).toEqual({ owns: false, supervises: true })
    expect(inScope(ctx("team"), ["staff1"])).toBe(false)
  })

  it("all: supervises everything, and still knows when the viewer owns it", () => {
    expect(relate(ctx("all"), ["stranger"])).toEqual({ owns: false, supervises: true })
    expect(relate(ctx("all"), ["me"])).toEqual({ owns: true, supervises: true })
  })

  it("ignores empty owner slots", () => {
    expect(relate(ctx("own"), [null, "me"])).toEqual({ owns: true, supervises: false })
    expect(relate(ctx("own"), [undefined, ""])).toEqual({ owns: true, supervises: false })
  })
})

describe("personInScope", () => {
  it("self always; team only the chain; all anyone", () => {
    expect(personInScope(ctx("own"), "me")).toBe(true)
    expect(personInScope(ctx("own"), "x")).toBe(false)
    expect(personInScope(ctx("team", ["x"]), "x")).toBe(true)
    expect(personInScope(ctx("team", ["x"]), "y")).toBe(false)
    expect(personInScope(ctx("all"), "y")).toBe(true)
  })
})

describe("owners", () => {
  it("names the sales utama and creator of a mission, the sales utama of a report, the holder of a prospect", () => {
    expect(missionOwners({ createdBy: "c", primarySalesId: "p" })).toEqual(["p", "c"])
    expect(missionOwners({ createdBy: "c", primarySalesId: null })).toEqual([null, "c"])
    expect(reportOwners({ primarySalesId: "p" })).toEqual(["p"])
    expect(prospectOwners({ ownerId: null })).toEqual([null])
  })
})

describe("words", () => {
  it("validates scope values and explains a refusal in matrix terms", () => {
    expect(isRecordScope("team")).toBe(true)
    expect(isRecordScope("company")).toBe(false)
    expect(describeOutOfScope("own", "mission")).toContain("miliknya sendiri")
    expect(describeOutOfScope("team", "prospek")).toContain("tim di bawahnya")
    expect(describeOutOfScope("all", "laporan")).toContain("Role & Izin")
  })
})
