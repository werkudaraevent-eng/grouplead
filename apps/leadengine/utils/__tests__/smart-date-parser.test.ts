import { describe, it, expect } from "vitest"
import { parseSmartEventDates } from "../smart-date-parser"

describe("parseSmartEventDates — sample-derived patterns", () => {
    // ── Already-supported patterns ────────────────────────────────
    it("same-month range with 2-digit year", () => {
        const r = parseSmartEventDates("3 - 5 Jan 26")
        expect(r).toEqual(["2026-01-03", "2026-01-04", "2026-01-05"])
    })

    it("cross-month range", () => {
        const r = parseSmartEventDates("28 Feb - 1 Mar 26")
        expect(r).toEqual(["2026-02-28", "2026-03-01"])
    })

    it("compact same-month range no spaces", () => {
        const r = parseSmartEventDates("7-10 Jul 26")
        expect(r).toEqual(["2026-07-07", "2026-07-08", "2026-07-09", "2026-07-10"])
    })

    // ── New: Indonesian month variants (Sept, Agu) ────────────────
    it("accepts Sept abbreviation", () => {
        const r = parseSmartEventDates("3 - 5 Sept 26")
        expect(r).toEqual(["2026-09-03", "2026-09-04", "2026-09-05"])
    })

    it("accepts mixed Indo/Eng (Agu in start, Aug in end)", () => {
        const r = parseSmartEventDates("15 Agu - 17 Aug 26")
        expect(r).toEqual(["2026-08-15", "2026-08-16", "2026-08-17"])
    })

    // ── New: Multi-range with separator ──────────────────────────
    it("multi-range with slash separator", () => {
        const r = parseSmartEventDates("13 - 15 / 27 - 29 Jan 26")
        expect(r).toEqual([
            "2026-01-13", "2026-01-14", "2026-01-15",
            "2026-01-27", "2026-01-28", "2026-01-29",
        ])
    })

    it("multi-range cross-month with slash", () => {
        const r = parseSmartEventDates("2-3 / 12-13 Feb 26")
        expect(r).toEqual([
            "2026-02-02", "2026-02-03",
            "2026-02-12", "2026-02-13",
        ])
    })

    it("comma list of single days then range", () => {
        const r = parseSmartEventDates("4, 11 Feb 26")
        expect(r).toEqual(["2026-02-04", "2026-02-11"])
    })

    it("slash-separated single days", () => {
        const r = parseSmartEventDates("2/3/4 Feb 25")
        expect(r).toEqual(["2025-02-02", "2025-02-03", "2025-02-04"])
    })

    // ── New: Slash-month (ambiguous "Jul/Aug 26") ────────────────
    it("slash-month treated as range over both months", () => {
        const r = parseSmartEventDates("Jul/Aug 26")
        // First day of first month → last day of second month
        expect(r[0]).toBe("2026-07-01")
        expect(r[r.length - 1]).toBe("2026-08-31")
    })

    it("slash-month with year-end wrap", () => {
        const r = parseSmartEventDates("Nov/Dec 26")
        expect(r[0]).toBe("2026-11-01")
        expect(r[r.length - 1]).toBe("2026-12-31")
    })

    // ── New: Month-range "Apr - Jun 27" ──────────────────────────
    it("month-range without days", () => {
        const r = parseSmartEventDates("Apr - Jun 26")
        expect(r[0]).toBe("2026-04-01")
        expect(r[r.length - 1]).toBe("2026-06-30")
    })

    it("month-range with slashes (May - Dec)", () => {
        const r = parseSmartEventDates("May - Dec 26")
        expect(r[0]).toBe("2026-05-01")
        expect(r[r.length - 1]).toBe("2026-12-31")
    })

    // ── New: Year-only ───────────────────────────────────────────
    it("year-only returns whole-year range", () => {
        const r = parseSmartEventDates("2026")
        expect(r[0]).toBe("2026-01-01")
        expect(r[r.length - 1]).toBe("2026-12-31")
        expect(r.length).toBe(365)
    })

    // ── New: Fuzzy "End of Mar 2026" ─────────────────────────────
    it("end of month phrase", () => {
        const r = parseSmartEventDates("End of Mar 2026")
        // Should anchor to last few days of March
        expect(r[0]).toBe("2026-03-25")
        expect(r[r.length - 1]).toBe("2026-03-31")
    })

    it("early month phrase", () => {
        const r = parseSmartEventDates("Early Apr 2026")
        expect(r[0]).toBe("2026-04-01")
        expect(r[r.length - 1]).toBe("2026-04-07")
    })

    it("end / early bridging two months", () => {
        const r = parseSmartEventDates("End Feb / Early Mar 26")
        // last days of Feb + first days of Mar
        expect(r).toContain("2026-02-25")
        expect(r).toContain("2026-03-01")
    })

    // ── New: Excel serial input ─────────────────────────────────
    it("converts a single Excel serial to ISO date", () => {
        // 46012 = 2025-12-21 per xlsx SSF
        expect(parseSmartEventDates("46012")).toEqual(["2025-12-21"])
    })

    it("excel serial with time fraction", () => {
        expect(parseSmartEventDates("46012.375")).toEqual(["2025-12-21"])
    })

    // ── Backward compat: existing patterns still work ────────────
    it("ISO date passthrough", () => {
        expect(parseSmartEventDates("2026-03-15")).toEqual(["2026-03-15"])
    })

    it("returns empty for completely unparseable input", () => {
        expect(parseSmartEventDates("nonsense gibberish")).toEqual([])
    })
})
