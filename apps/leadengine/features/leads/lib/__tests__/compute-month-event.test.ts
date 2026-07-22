import { describe, it, expect } from "vitest"
import { computeMonthEvent } from "../compute-month-event"

describe("computeMonthEvent", () => {
    it("returns end-date month when end day is on/before cutoff", () => {
        // 13 Sept - 21 Oct 2027, cutoff 25 → October 2027
        expect(computeMonthEvent(["2027-09-13", "2027-10-21"], 25)).toBe("October 2027")
    })

    it("bumps to next month when end day is after cutoff", () => {
        // 26 - 31 Oct 2026, cutoff 25 → November 2026
        expect(computeMonthEvent(["2026-10-26", "2026-10-31"], 25)).toBe("November 2026")
    })

    it("rolls over the year when bumping from December", () => {
        // 28 - 30 Dec 2026, cutoff 25 → January 2027
        expect(computeMonthEvent(["2026-12-28", "2026-12-30"], 25)).toBe("January 2027")
    })

    it("uses end day even for single-day events", () => {
        // 30 Nov 2026 alone, cutoff 25 → December 2026
        expect(computeMonthEvent(["2026-11-30"], 25)).toBe("December 2026")
    })

    it("respects custom cutoff days", () => {
        // 16 Mar 2026 with cutoff 15 → April 2026
        expect(computeMonthEvent(["2026-03-16"], 15)).toBe("April 2026")
        // Same date with cutoff 20 → March 2026
        expect(computeMonthEvent(["2026-03-16"], 20)).toBe("March 2026")
    })

    it("matches Werkudara recap examples", () => {
        // From sample/Lead 2026.xlsx, MONTH column was user-curated:
        expect(computeMonthEvent(["2026-10-15", "2026-10-18"], 25)).toBe("October 2026")
        expect(computeMonthEvent(["2026-10-22", "2026-10-25"], 25)).toBe("October 2026")
        expect(computeMonthEvent(["2026-10-26", "2026-10-31"], 25)).toBe("November 2026")
        expect(computeMonthEvent(["2026-11-30", "2026-12-12"], 25)).toBe("December 2026")
        expect(computeMonthEvent(["2027-09-13", "2027-10-21"], 25)).toBe("October 2027")
    })

    it("returns null for empty input", () => {
        expect(computeMonthEvent([], 25)).toBe(null)
        expect(computeMonthEvent(null as unknown as string[], 25)).toBe(null)
    })

    it("ignores invalid dates", () => {
        expect(computeMonthEvent(["not-a-date"], 25)).toBe(null)
    })
})
