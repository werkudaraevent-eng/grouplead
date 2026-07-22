import { describe, it, expect } from "vitest"
import {
    getDashboardPeriodRanges,
    prorateTarget,
    prorateMonthlyTargets,
    rangesOverlapDays,
    rangeDurationDays,
    isAllTimeRange,
    type DateRange,
} from "../dashboard-period"

const NOW = new Date(2026, 4, 20) // May 20 2026 (local time)

function range(start: string, end: string): DateRange {
    const [sy, sm, sd] = start.split("-").map(Number)
    const [ey, em, ed] = end.split("-").map(Number)
    return { start: new Date(sy, sm - 1, sd), end: new Date(ey, em - 1, ed) }
}

function toLocalDate(d: Date): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
}

describe("rangeDurationDays", () => {
    it("returns whole days for clean spans", () => {
        expect(rangeDurationDays(range("2026-01-01", "2026-01-11"))).toBe(10)
    })

    it("returns 0 for inverted ranges", () => {
        expect(rangeDurationDays(range("2026-02-01", "2026-01-01"))).toBe(0)
    })
})

describe("rangesOverlapDays", () => {
    it("computes overlap when ranges intersect", () => {
        const a = range("2026-01-01", "2026-04-01") // Q1
        const b = range("2026-03-01", "2026-06-01") // Mar–May
        // overlap = Mar 1 -> Apr 1 = 31 days
        expect(rangesOverlapDays(a, b)).toBe(31)
    })

    it("returns 0 when ranges do not overlap", () => {
        const a = range("2026-01-01", "2026-02-01")
        const b = range("2026-03-01", "2026-04-01")
        expect(rangesOverlapDays(a, b)).toBe(0)
    })
})

describe("prorateTarget", () => {
    it("returns full amount when dashboard fully covers target", () => {
        const target = range("2026-04-01", "2026-07-01") // Q2
        const dashboard = range("2026-01-01", "2027-01-01") // full year
        expect(prorateTarget(1_000_000, target, dashboard)).toBe(1_000_000)
    })

    it("returns 0 for non-overlapping ranges", () => {
        const target = range("2026-01-01", "2026-04-01")
        const dashboard = range("2026-07-01", "2026-10-01")
        expect(prorateTarget(1_000_000, target, dashboard)).toBe(0)
    })

    it("scales linearly by overlap days", () => {
        const target = range("2026-01-01", "2027-01-01") // 365 days
        const dashboard = range("2026-04-01", "2026-07-01") // 91 days (Q2)
        const result = prorateTarget(365_000, target, dashboard)
        // 365k * 91 / 365 = 91k
        expect(result).toBeCloseTo(91_000, 6)
    })

    it("returns 0 for non-positive amounts", () => {
        const target = range("2026-01-01", "2027-01-01")
        const dashboard = range("2026-01-01", "2026-04-01")
        expect(prorateTarget(0, target, dashboard)).toBe(0)
        expect(prorateTarget(-100, target, dashboard)).toBe(0)
    })
})

describe("prorateMonthlyTargets", () => {
    const buckets = {
        "1": 100,
        "2": 100,
        "3": 100,
        "4": 200,
        "5": 200,
        "6": 200,
        "7": 300,
        "8": 300,
        "9": 300,
        "10": 400,
        "11": 400,
        "12": 400,
    }

    it("sums full months that fall inside dashboard range", () => {
        // Q2 = Apr+May+Jun = 200 + 200 + 200 = 600
        const dashboard = range("2026-04-01", "2026-07-01")
        expect(prorateMonthlyTargets(buckets, 2026, dashboard)).toBe(600)
    })

    it("returns 0 when no buckets overlap", () => {
        const dashboard = range("2027-01-01", "2027-04-01")
        expect(prorateMonthlyTargets(buckets, 2026, dashboard)).toBe(0)
    })

    it("prorates partial month overlap", () => {
        // First half of April only -> ~15/30 of April = 200 * 0.5 = 100
        const dashboard = range("2026-04-01", "2026-04-16")
        const result = prorateMonthlyTargets(buckets, 2026, dashboard)
        expect(result).toBeCloseTo(100, 6)
    })

    it("handles null monthly targets", () => {
        const dashboard = range("2026-04-01", "2026-07-01")
        expect(prorateMonthlyTargets(null, 2026, dashboard)).toBe(0)
        expect(prorateMonthlyTargets(undefined, 2026, dashboard)).toBe(0)
    })
})

describe("isAllTimeRange + getDashboardPeriodRanges integration", () => {
    it("flags all_time as the sentinel range", () => {
        const { current } = getDashboardPeriodRanges("all_time", NOW)
        expect(isAllTimeRange(current)).toBe(true)
    })

    it("does NOT flag this_quarter as all_time", () => {
        const { current } = getDashboardPeriodRanges("this_quarter", NOW)
        expect(isAllTimeRange(current)).toBe(false)
    })

    it("this_quarter for May 2026 = Apr–Jun (Q2)", () => {
        const { current } = getDashboardPeriodRanges("this_quarter", NOW)
        expect(toLocalDate(current.start)).toBe("2026-04-01")
        expect(toLocalDate(current.end)).toBe("2026-07-01")
    })
})

describe("end-to-end: annual target prorated to quarter", () => {
    it("annual 20.8B with Q2 dashboard => ~5.18B", () => {
        const annual = 20_800_000_000
        const targetRange = range("2026-01-01", "2027-01-01") // 365 days
        const { current: q2 } = getDashboardPeriodRanges("this_quarter", NOW) // 91 days
        const prorated = prorateTarget(annual, targetRange, q2)
        // 20.8B * 91/365 ≈ 5.184B
        const expected = 20_800_000_000 * 91 / 365
        expect(prorated).toBeCloseTo(expected, -3)
    })
})
