import { describe, it, expect } from "vitest"
import {
    normalizePhoneToE164,
    formatPhoneDisplay,
    isValidPhone,
    phoneFormatStatus,
} from "../phone-normalize"

describe("normalizePhoneToE164 — Indonesian inputs", () => {
    it("normalizes 0-prefixed mobile to +62", () => {
        expect(normalizePhoneToE164("08112836676")).toBe("+628112836676")
        expect(normalizePhoneToE164("0811-2836-676")).toBe("+628112836676")
        expect(normalizePhoneToE164("0811 2836 676")).toBe("+628112836676")
    })

    it("normalizes mobile without leading zero", () => {
        expect(normalizePhoneToE164("8112836676")).toBe("+628112836676")
    })

    it("normalizes 62-prefixed (no plus) intl form", () => {
        expect(normalizePhoneToE164("628112836676")).toBe("+628112836676")
        expect(normalizePhoneToE164("62 811 2836 676")).toBe("+628112836676")
    })

    it("normalizes already-canonical E.164", () => {
        expect(normalizePhoneToE164("+628112836676")).toBe("+628112836676")
        expect(normalizePhoneToE164("+62 811-2836-676")).toBe("+628112836676")
    })

    it("normalizes Jakarta landline", () => {
        // 021 31924828 is a Jakarta landline.
        expect(normalizePhoneToE164("02131924828")).toBe("+622131924828")
        expect(normalizePhoneToE164("021-3192-4828")).toBe("+622131924828")
    })

    it("strips parentheses, dashes, spaces", () => {
        expect(normalizePhoneToE164("(0811) 2836-676")).toBe("+628112836676")
    })
})

describe("normalizePhoneToE164 — foreign inputs", () => {
    it("preserves explicit US +1 number", () => {
        expect(normalizePhoneToE164("+1 415 555 0173")).toBe("+14155550173")
    })

    it("preserves explicit Singapore +65 number", () => {
        expect(normalizePhoneToE164("+65 9123 4567")).toBe("+6591234567")
    })

    it("respects override defaultCountry for bare digits", () => {
        // 415 555 0173 with defaultCountry=US should resolve.
        expect(normalizePhoneToE164("4155550173", "US")).toBe("+14155550173")
    })
})

describe("normalizePhoneToE164 — invalid / edge cases", () => {
    it("returns null for empty / whitespace / null", () => {
        expect(normalizePhoneToE164("")).toBeNull()
        expect(normalizePhoneToE164("   ")).toBeNull()
        expect(normalizePhoneToE164(null)).toBeNull()
        expect(normalizePhoneToE164(undefined)).toBeNull()
    })

    it("returns null for inputs that are too short", () => {
        expect(normalizePhoneToE164("123")).toBeNull()
        expect(normalizePhoneToE164("0123")).toBeNull()
    })

    it("returns null for non-digit garbage", () => {
        expect(normalizePhoneToE164("not a phone")).toBeNull()
        expect(normalizePhoneToE164("---")).toBeNull()
    })
})

describe("formatPhoneDisplay", () => {
    it("renders E.164 in international pretty form", () => {
        const out = formatPhoneDisplay("+628112836676")
        expect(out).toMatch(/^\+62/)
        expect(out).toContain("811")
    })

    it("returns empty for empty input", () => {
        expect(formatPhoneDisplay("")).toBe("")
        expect(formatPhoneDisplay(null)).toBe("")
        expect(formatPhoneDisplay(undefined)).toBe("")
    })

    it("falls back to raw value when unparseable (legacy data)", () => {
        expect(formatPhoneDisplay("abc-zzz")).toBe("abc-zzz")
    })
})

describe("isValidPhone", () => {
    it("treats empty as valid (phone is optional by default)", () => {
        expect(isValidPhone("")).toBe(true)
        expect(isValidPhone(null)).toBe(true)
        expect(isValidPhone(undefined)).toBe(true)
    })

    it("recognises good ID inputs", () => {
        expect(isValidPhone("08112836676")).toBe(true)
        expect(isValidPhone("+628112836676")).toBe(true)
    })

    it("rejects junk", () => {
        expect(isValidPhone("123")).toBe(false)
        expect(isValidPhone("not a phone")).toBe(false)
    })
})

describe("phoneFormatStatus", () => {
    it("classifies inputs", () => {
        expect(phoneFormatStatus("")).toBe("empty")
        expect(phoneFormatStatus("   ")).toBe("empty")
        expect(phoneFormatStatus("08112836676")).toBe("ok")
        expect(phoneFormatStatus("123")).toBe("invalid")
    })
})
