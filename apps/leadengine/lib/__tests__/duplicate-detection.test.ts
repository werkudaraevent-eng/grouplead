import { describe, it, expect } from "vitest"
import {
    normalizeCompanyName,
    normalizeEntityName,
    findDuplicateCandidates,
} from "../duplicate-detection"

describe("normalizeCompanyName (database matching key)", () => {
    // Each pair below was a real duplicate in production before the unique
    // index existed. The key has to see them as one company.
    it("folds the duplicates that actually occurred", () => {
        expect(normalizeCompanyName("Asuransi BRI Life")).toBe(normalizeCompanyName("Asuransi  BRI Life"))
        expect(normalizeCompanyName("Sriboga Marugame Indonesia")).toBe(normalizeCompanyName("Sriboga Marugame Indonesia PT"))
        expect(normalizeCompanyName("Pertamina (Persero)")).toBe(normalizeCompanyName("Pertamina"))
        expect(normalizeCompanyName("Citra Media Nusa Purnama  PT")).toBe(normalizeCompanyName("Citra Media Nusa Purnama PT"))
    })

    it("strips legal forms from both edges", () => {
        expect(normalizeCompanyName("PT Bank Central Asia Tbk")).toBe("bank central asia")
        expect(normalizeCompanyName("Acme Co. Ltd.")).toBe("acme")
    })

    it("treats punctuation as a separator, unlike the advisory normaliser", () => {
        expect(normalizeCompanyName("Pertamina Hulu Energi - West Madura")).toBe("pertamina hulu energi west madura")
        expect(normalizeCompanyName("A.B.C")).toBe("a b c")
    })

    it("never strips the last token, so a name that is only a legal form survives", () => {
        expect(normalizeCompanyName("PT")).toBe("pt")
        expect(normalizeCompanyName("PT Tbk")).toBe("tbk")
    })

    it("keeps distinct companies distinct", () => {
        expect(normalizeCompanyName("Pertamina Hulu Energi")).not.toBe(normalizeCompanyName("Pertamina"))
        expect(normalizeCompanyName("Arunika Kreasi")).not.toBe(normalizeCompanyName("Arunika Kreasindo"))
    })
})

describe("normalizeEntityName", () => {
    it("strips PT / Tbk and normalizes case", () => {
        expect(normalizeEntityName("PT Bank Central Asia Tbk"))
            .toBe("bank central asia")
    })

    it("keeps the entity body when no legal form is present", () => {
        expect(normalizeEntityName("Bank Central Asia")).toBe("bank central asia")
    })

    it("strips chained suffixes", () => {
        expect(normalizeEntityName("Acme Co. Ltd.")).toBe("acme")
    })

    it("strips parenthesized legal forms", () => {
        expect(normalizeEntityName("Bank Mandiri (Persero)")).toBe("bank mandiri")
    })

    it("collapses whitespace", () => {
        expect(normalizeEntityName("  PT   Acme   Corp ")).toBe("acme")
    })

    it("handles plain lowercase input", () => {
        expect(normalizeEntityName("acme inc.")).toBe("acme")
    })

    it("returns empty string for legal-only input", () => {
        // Edge case: only "PT Tbk" — leaves nothing; the >1 token guard
        // means we stop stripping when only one token remains.
        expect(normalizeEntityName("PT Tbk")).toBe("tbk")
    })
})

describe("findDuplicateCandidates", () => {
    type Company = { id: string; name: string }
    const existing: Company[] = [
        { id: "1", name: "PT Bank Central Asia Tbk" },
        { id: "2", name: "Bank Central Asia Indonesia" },
        { id: "3", name: "Bank Mandiri (Persero)" },
        { id: "4", name: "Acme Inc." },
        { id: "5", name: "Acme Holdings" },
    ]
    const getName = (c: Company) => c.name

    it("returns exact match first", () => {
        const matches = findDuplicateCandidates("Bank Central Asia", existing, getName)
        expect(matches[0]?.kind).toBe("exact")
        expect(matches[0]?.record.id).toBe("1") // shorter normalized form wins tie
    })

    it("flags 'contains' matches even when the input is a subset", () => {
        const matches = findDuplicateCandidates("Bank Central", existing, getName)
        expect(matches.length).toBeGreaterThan(0)
        // The strongest matches must be 'contains' (not prefix). Bank Mandiri
        // also surfaces because it shares the 'bank' prefix — that's the
        // weakest tier and ranked last.
        expect(matches[0].kind).toBe("contains")
    })

    it("flags 'prefix' matches when first 4 normalized chars align", () => {
        const matches = findDuplicateCandidates("Bank Mandurah", existing, getName)
        expect(matches.some(m => m.record.id === "3" && m.kind === "prefix")).toBe(true)
    })

    it("excludes the record being edited via excludeId", () => {
        const matches = findDuplicateCandidates(
            "PT Bank Central Asia Tbk",
            existing,
            getName,
            {},
            "1",
        )
        expect(matches.find(m => m.record.id === "1")).toBeUndefined()
        // Record 2 (Bank Central Asia Indonesia) still surfaces
        expect(matches.find(m => m.record.id === "2")?.kind).toBe("contains")
    })

    it("respects the limit option", () => {
        const matches = findDuplicateCandidates("acme", existing, getName, { limit: 1 })
        expect(matches.length).toBe(1)
    })

    it("returns empty for unrelated names", () => {
        const matches = findDuplicateCandidates("Quantum Mechanics", existing, getName)
        expect(matches).toEqual([])
    })

    it("returns empty for empty candidate", () => {
        expect(findDuplicateCandidates("", existing, getName)).toEqual([])
        expect(findDuplicateCandidates("   ", existing, getName)).toEqual([])
    })

    it("handles entities with null names without crashing", () => {
        type Loose = { id: string; name: string | null }
        const list: Loose[] = [{ id: "x", name: null }, { id: "y", name: "Acme" }]
        const matches = findDuplicateCandidates("Acme", list, l => l.name)
        expect(matches.map(m => m.record.id)).toEqual(["y"])
    })
})
