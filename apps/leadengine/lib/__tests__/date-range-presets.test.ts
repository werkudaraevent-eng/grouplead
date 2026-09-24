import { describe, expect, it } from "vitest"
import { DATE_RANGE_PRESETS, activeDateRangePreset, dateRangeLabel, isCustomDateRange } from "../date-range-presets"

const NOW = new Date(2026, 8, 24) // 24 Sep 2026

describe("dateRangeLabel", () => {
    it("names a named period", () => {
        expect(dateRangeLabel("this_quarter", "", "")).toBe("This Quarter")
        expect(dateRangeLabel("all_time", "", "")).toBe("All Time")
    })

    it("reads a custom range, the year once when both days share it", () => {
        expect(dateRangeLabel("custom", "2026-03-01", "2026-03-31")).toBe("1 Mar – 31 Mar 2026")
        expect(dateRangeLabel("custom", "2025-12-01", "2026-01-31")).toBe("1 Dec 2025 – 31 Jan 2026")
    })

    it("reads a one-day range as that day", () => {
        expect(dateRangeLabel("custom", "2026-09-24", "2026-09-24")).toBe("24 Sep 2026")
    })

    it("falls back when a custom range is incomplete", () => {
        expect(dateRangeLabel("custom", "2026-09-01", "")).toBe("Date Range")
    })
})

describe("activeDateRangePreset", () => {
    it("finds a named quick range", () => {
        expect(activeDateRangePreset("this_year", "", "", NOW)).toBe("this_year")
    })

    it("finds a custom range that is a quick range", () => {
        const last7 = DATE_RANGE_PRESETS.find((p) => p.key === "last7")!.resolve(NOW)
        expect(activeDateRangePreset("custom", last7.start, last7.end, NOW)).toBe("last7")
        expect(activeDateRangePreset("custom", "2026-08-01", "2026-08-31", NOW)).toBe("last_month")
    })

    it("finds nothing for any other custom range", () => {
        expect(activeDateRangePreset("custom", "2025-01-01", "2025-12-31", NOW)).toBeNull()
    })
})

describe("isCustomDateRange", () => {
    it("is a range picked on the calendar", () => {
        expect(isCustomDateRange("custom", "2026-05-01", "2026-05-31", NOW)).toBe(true)
    })

    it("is not a quick range, even one stored as custom days", () => {
        expect(isCustomDateRange("custom", "2026-09-18", "2026-09-24", NOW)).toBe(false) // Last 7 days
        expect(isCustomDateRange("this_quarter", "", "", NOW)).toBe(false)
    })
})
