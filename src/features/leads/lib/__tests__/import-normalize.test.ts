import { describe, it, expect } from "vitest"
import { coerceDateToISO, normalizeTaxonomicValue, coerceNumber } from "../import-normalize"

describe("coerceDateToISO", () => {
    it("converts Excel serial to ISO", () => {
        expect(coerceDateToISO(46012)).toBe("2025-12-21")
        expect(coerceDateToISO("46012")).toBe("2025-12-21")
        expect(coerceDateToISO("46012.375")).toBe("2025-12-21")
    })

    it("converts ISO strings", () => {
        expect(coerceDateToISO("2026-03-15")).toBe("2026-03-15")
    })

    it("returns null for unparseable input", () => {
        expect(coerceDateToISO("abc")).toBe(null)
        expect(coerceDateToISO("")).toBe(null)
        expect(coerceDateToISO(null)).toBe(null)
    })

    it("returns null for 4-digit year literal", () => {
        // We do NOT want "2026" alone to read as a date.
        expect(coerceDateToISO("2026")).toBe(null)
    })

    it("returns null for out-of-range years that would break Postgres", () => {
        // Postgres rejects toISOString output for year > 9999 because the
        // leading "+" is parsed as a timezone offset. The recap occasionally
        // produces nonsensical mega-years (e.g. "+013275-01-01") via stray
        // characters or formula errors — they must never reach the DB.
        expect(coerceDateToISO("13275-01-01")).toBe(null)
        expect(coerceDateToISO(new Date("+013275-01-01T00:00:00Z"))).toBe(null)
    })

    it("handles JS Date object", () => {
        expect(coerceDateToISO(new Date("2026-03-15T00:00:00Z"))).toBe("2026-03-15")
    })
})

describe("normalizeTaxonomicValue", () => {
    const optionMap = new Map<string, string>([
        ["category|hot lead", "Hot Lead"],
        ["category|warm lead", "Warm Lead"],
        ["category|cold lead", "Cold Lead"],
        ["grade_lead|grade c (< 200 jt)", "Grade C (< 200 Jt)"],
        ["grade_lead|grade b (200 - 499 jt)", "Grade B (200 - 499 Jt)"],
    ])

    it("matches exact case-insensitive", () => {
        const r = normalizeTaxonomicValue("category", "HOT LEAD", optionMap)
        expect(r.value).toBe("Hot Lead")
        expect(r.matched).toBe("exact")
    })

    it("matches with collapsed whitespace", () => {
        const r = normalizeTaxonomicValue("category", "  Hot   Lead  ", optionMap)
        expect(r.value).toBe("Hot Lead")
        expect(r.matched).toBe("exact")
    })

    it("fuzzy-matches near misses", () => {
        // "Grade C (< 200 juta)" → "Grade C (< 200 Jt)" should fuzzy match
        const r = normalizeTaxonomicValue(
            "grade_lead",
            "Grade C (< 200 juta)",
            optionMap,
        )
        expect(r.matched).toBe("fuzzy")
        expect(r.value).toBe("Grade C (< 200 Jt)")
        expect(r.warning).toBeDefined()
    })

    it("keeps raw value with warning when nothing matches", () => {
        const r = normalizeTaxonomicValue("category", "Quirky Lead", optionMap)
        expect(r.matched).toBe("raw")
        expect(r.value).toBe("Quirky Lead")
        expect(r.warning).toBeDefined()
    })
})

describe("coerceNumber", () => {
    it("strips thousands separators (dots and commas)", () => {
        expect(coerceNumber("3.090.000")).toBe(3090000)
        expect(coerceNumber("3,090,000")).toBe(3090000)
    })

    it("handles raw numbers", () => {
        expect(coerceNumber(150_000_000)).toBe(150000000)
    })

    it("treats an Indonesian decimal comma as a decimal point — NOT a separator", () => {
        // Regression for the 2026-06 import bug: "92826005,7275" was being
        // turned into 928260057275 (≈928 B) instead of ≈92.8 jt.
        expect(coerceNumber("92826005,7275")).toBeCloseTo(92826005.7275, 4)
        expect(coerceNumber("1234,5")).toBeCloseTo(1234.5, 4)
    })

    it("treats a US decimal point as a decimal point", () => {
        expect(coerceNumber("1234.5")).toBeCloseTo(1234.5, 4)
        expect(coerceNumber("0.75")).toBeCloseTo(0.75, 4)
    })

    it("handles mixed separators by using the right-most as decimal", () => {
        expect(coerceNumber("1.234.567,89")).toBeCloseTo(1234567.89, 2) // ID
        expect(coerceNumber("1,234,567.89")).toBeCloseTo(1234567.89, 2) // US
    })

    it("treats a single dot/comma before a 3-digit group as thousands", () => {
        expect(coerceNumber("3.090")).toBe(3090)
        expect(coerceNumber("3,090")).toBe(3090)
    })

    it("returns null for invalid input", () => {
        expect(coerceNumber("not a number")).toBe(null)
        expect(coerceNumber("")).toBe(null)
        expect(coerceNumber(null)).toBe(null)
    })
})
