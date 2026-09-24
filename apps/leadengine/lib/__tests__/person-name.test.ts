import { describe, expect, it } from "vitest"
import { shortPersonName } from "../person-name"

describe("shortPersonName", () => {
    it("keeps a name that fits", () => {
        expect(shortPersonName("Hanung Wibowo")).toBe("Hanung Wibowo")
    })

    it("keeps the first name and turns the rest into initials when it is too long", () => {
        expect(shortPersonName("Setyorini Dewi Ismu Handayani")).toBe("Setyorini D. I. H.")
    })

    it("capitalises the initials", () => {
        expect(shortPersonName("Kensrie diah ayuningtyas putri")).toBe("Kensrie D. A. P.")
    })

    it("falls back to the first name alone when it is a single long word", () => {
        expect(shortPersonName("Wolfeschlegelsteinhausen")).toBe("Wolfeschlegelsteinhausen")
    })

    it("ignores surrounding and repeated whitespace", () => {
        expect(shortPersonName("  Dewi   Lestari  ")).toBe("Dewi Lestari")
        expect(shortPersonName("Setyorini  Dewi   Ismu Handayani")).toBe("Setyorini D. I. H.")
    })

    it("honours a custom length", () => {
        expect(shortPersonName("Dewi Lestari", 6)).toBe("Dewi L.")
    })
})
