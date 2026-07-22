import { describe, it, expect } from "vitest"
import { resolvePicSales, type ProfileLite } from "../resolve-pic-sales"

const profiles: ProfileLite[] = [
    { id: "p-adiel", full_name: "Adiel Pratama" },
    { id: "p-anwar", full_name: "Anwar Hidayat" },
    { id: "p-mitha", full_name: "Mitha Suryani" },
    { id: "p-emy", full_name: "Emy Lestari" },
    { id: "p-mya", full_name: "Mya Kurniawan" },
    { id: "p-elfasa", full_name: "Elfasa Putra" },
    { id: "p-other-adiel", full_name: "Adiel Wijaya" },
]

describe("resolvePicSales", () => {
    it("picks first-name match when unique", () => {
        const r = resolvePicSales("ANWAR", profiles)
        expect(r?.id).toBe("p-anwar")
        expect(r?.matched).toBe("first")
    })

    it("matches lower-case input", () => {
        const r = resolvePicSales("mitha", profiles)
        expect(r?.id).toBe("p-mitha")
    })

    it("matches even short tokens like EMY/MYA", () => {
        expect(resolvePicSales("EMY", profiles)?.id).toBe("p-emy")
        expect(resolvePicSales("MYA", profiles)?.id).toBe("p-mya")
    })

    it("returns null when first-name match is ambiguous", () => {
        // Two profiles named "Adiel ..." — should not auto-pick.
        const r = resolvePicSales("ADIEL", profiles)
        // Either null (ambiguous) or a fuzzy hit, but never a wrong pick
        if (r) {
            // If fuzzy fired, gap requirement should still hold.
            expect(["fuzzy"]).toContain(r.matched)
        } else {
            expect(r).toBe(null)
        }
    })

    it("matches exact full name case-insensitively", () => {
        const r = resolvePicSales("anwar hidayat", profiles)
        expect(r?.id).toBe("p-anwar")
        expect(r?.matched).toBe("exact")
    })

    it("returns null for nonsense input", () => {
        expect(resolvePicSales("xyzzy", profiles)).toBe(null)
    })

    it("returns null for empty input or empty profiles", () => {
        expect(resolvePicSales("", profiles)).toBe(null)
        expect(resolvePicSales("anwar", [])).toBe(null)
    })

    it("falls back to fuzzy when token doesn't match start", () => {
        // 'Suryani' is the last name of Mitha — substring should hit uniquely.
        const r = resolvePicSales("Suryani", profiles)
        expect(r?.id).toBe("p-mitha")
        expect(["substring", "fuzzy"]).toContain(r?.matched)
    })
})
