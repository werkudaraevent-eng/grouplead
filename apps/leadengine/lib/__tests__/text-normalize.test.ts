import { describe, it, expect } from "vitest"
import {
    normalizeWhitespace,
    normalizeStringFields,
    suggestTitleCase,
} from "../text-normalize"

describe("normalizeWhitespace", () => {
    it("trims surrounding whitespace", () => {
        expect(normalizeWhitespace("  hello  ")).toBe("hello")
    })

    it("collapses runs of whitespace into a single space", () => {
        expect(normalizeWhitespace("Bank   Central\t\nAsia")).toBe("Bank Central Asia")
    })

    it("returns null for empty / whitespace-only input", () => {
        expect(normalizeWhitespace("")).toBeNull()
        expect(normalizeWhitespace("   ")).toBeNull()
        expect(normalizeWhitespace(null)).toBeNull()
        expect(normalizeWhitespace(undefined)).toBeNull()
    })

    it("does not change case", () => {
        expect(normalizeWhitespace("PT BANK BCA")).toBe("PT BANK BCA")
    })
})

describe("normalizeStringFields", () => {
    it("normalizes string-valued keys and leaves the rest alone", () => {
        const input = {
            name: "  Acme  Corp  ",
            phone: "+62  812 345",
            count: 5,
            active: true,
            owner_id: null,
        }
        expect(normalizeStringFields(input)).toEqual({
            name: "Acme Corp",
            phone: "+62 812 345",
            count: 5,
            active: true,
            owner_id: null,
        })
    })

    it("normalizes string array entries and drops empties", () => {
        const input = {
            secondary_emails: ["  foo@bar.com  ", "", "   ", " baz@qux.com"],
        }
        expect(normalizeStringFields(input)).toEqual({
            secondary_emails: ["foo@bar.com", "baz@qux.com"],
        })
    })

    it("returns null for fully-blank string fields", () => {
        const input = { name: "   ", note: "" }
        expect(normalizeStringFields(input)).toEqual({ name: null, note: null })
    })
})

describe("suggestTitleCase", () => {
    it("suggests title-case for a fully uppercase name", () => {
        expect(suggestTitleCase("PT BANK CENTRAL ASIA")).toBe("PT Bank Central Asia")
    })

    it("returns null for already well-cased input", () => {
        expect(suggestTitleCase("PT Bank Central Asia")).toBeNull()
    })

    it("returns null for short codes / acronyms", () => {
        expect(suggestTitleCase("BCA")).toBeNull()
        expect(suggestTitleCase("PT")).toBeNull()
    })

    it("returns null for mostly-lowercase input", () => {
        expect(suggestTitleCase("bank central asia")).toBeNull()
    })

    it("handles mixed-case threshold sensibly", () => {
        // Below 70% caps → no suggestion
        expect(suggestTitleCase("Bank Central ASIA")).toBeNull()
        // Above 70% caps → suggestion
        expect(suggestTitleCase("BANK CENTRAL Asia")).toBe("Bank Central Asia")
    })

    it("preserves Indonesian acronyms in the suggestion", () => {
        // Note: TBK is in the smartTitleCase known-abbreviation list so it
        // stays uppercase. Indonesian style guides usually write "Tbk",
        // but the dataset convention here is to keep it caps for
        // searchability — documented in `smart-title-case.ts`.
        const out = suggestTitleCase("PT BANK BCA TBK")
        expect(out).toBe("PT Bank BCA TBK")
    })

    it("returns null on empty / null input", () => {
        expect(suggestTitleCase("")).toBeNull()
        expect(suggestTitleCase(null)).toBeNull()
        expect(suggestTitleCase(undefined)).toBeNull()
    })
})
