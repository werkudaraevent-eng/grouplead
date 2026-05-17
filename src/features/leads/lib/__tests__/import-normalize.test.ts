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
    it("strips commas and dots", () => {
        expect(coerceNumber("3.090.000")).toBe(3090000)
        expect(coerceNumber("3,090,000")).toBe(3090000)
    })

    it("handles raw numbers", () => {
        expect(coerceNumber(150_000_000)).toBe(150000000)
    })

    it("returns null for invalid input", () => {
        expect(coerceNumber("not a number")).toBe(null)
        expect(coerceNumber("")).toBe(null)
        expect(coerceNumber(null)).toBe(null)
    })
})
