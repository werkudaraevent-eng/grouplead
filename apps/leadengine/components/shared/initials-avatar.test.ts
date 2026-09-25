import { describe, expect, it } from "vitest"
import { getInitials } from "./initials-avatar"

describe("getInitials", () => {
    it("takes the first letters of the first two words", () => {
        expect(getInitials("Abdan Falaha")).toBe("AF")
        expect(getInitials("hanung")).toBe("H")
    })

    it("skips punctuation around a word", () => {
        expect(getInitials("Elitery (Data Sinergitama)")).toBe("ED")
        expect(getInitials("“PT” Maju")).toBe("PM")
        expect(getInitials("( )")).toBe("?")
        expect(getInitials("")).toBe("?")
    })
})

describe("the pickers' initials (lib/avatar)", () => {
    it("skip punctuation the same way", async () => {
        const { getInitials: pickerInitials } = await import("@/lib/avatar")
        expect(pickerInitials("Elitery (Data Sinergitama)")).toBe("ED")
        expect(pickerInitials("Kensrie Diah Ayuningtyas")).toBe("KD")
        expect(pickerInitials(null)).toBe("?")
    })
})
