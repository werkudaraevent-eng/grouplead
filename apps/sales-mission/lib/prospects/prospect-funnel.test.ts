import { describe, expect, it } from "vitest"
import { buildFunnelSteps } from "./prospect-funnel"

describe("buildFunnelSteps", () => {
  it("computes shares against the cohort and against the step before", () => {
    const steps = buildFunnelSteps({ total: 200, contacted: 100, inProgress: 40, confirmed: 25, completed: 20, leadPushed: 5 })
    expect(steps.map((s) => s.label)).toEqual(["Prospek", "Dihubungi", "In Progress", "Confirmed", "Dikunjungi dan dilaporkan", "Lead dikirim ke CRM"])
    expect(steps[0]).toMatchObject({ value: 200, pctOfTotal: 100, pctOfPrevious: null })
    expect(steps[1]).toMatchObject({ value: 100, pctOfTotal: 50, pctOfPrevious: 50 })
    expect(steps[3]).toMatchObject({ value: 25, pctOfTotal: 13, pctOfPrevious: 25 })
    expect(steps[5]).toMatchObject({ value: 5, pctOfTotal: 3, pctOfPrevious: 25 })
  })

  it("never divides by zero", () => {
    const steps = buildFunnelSteps({ total: 0, contacted: 0, inProgress: 0, confirmed: 0, completed: 0, leadPushed: 0 })
    expect(steps.every((s) => s.pctOfTotal === 0 && (s.pctOfPrevious === null || s.pctOfPrevious === 0))).toBe(true)
  })
})
