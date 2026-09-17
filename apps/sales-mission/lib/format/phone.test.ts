import { describe, expect, it } from "vitest"
import { caretKeepingDigitsAfter, countDigits, formatPhone, formatPhoneWhileTyping, isValidPhone, normalizePhone } from "./phone"

describe("normalizePhone", () => {
  it("accepts the ways people actually type an Indonesian number", () => {
    expect(normalizePhone("0812 3456 7890")).toBe("+6281234567890")
    expect(normalizePhone("+62 812-3456-7890")).toBe("+6281234567890")
    expect(normalizePhone("6281234567890")).toBe("+6281234567890")
    expect(normalizePhone("81234567890")).toBe("+6281234567890")
    expect(normalizePhone("(021) 555-1234")).toBe("+62215551234")
  })

  it("keeps another country's number as typed", () => {
    expect(normalizePhone("+65 9123 4567")).toBe("+6591234567")
  })

  it("is empty for blank input", () => {
    expect(normalizePhone("   ")).toBe("")
  })
})

describe("formatPhone", () => {
  it("groups a mobile as operator prefix then fours", () => {
    expect(formatPhone("081234567890")).toBe("+62 812-3456-7890")
    expect(formatPhone("08123456789")).toBe("+62 812-3456-789")
  })

  it("shows a landline with its area code", () => {
    expect(formatPhone("0215551234")).toBe("+62 21-5551-234")
  })

  it("does not format the first few digits, so the caret stays put", () => {
    expect(formatPhoneWhileTyping("0812")).toBe("0812")
    expect(formatPhoneWhileTyping("081234")).toBe("+62 812-34")
  })
})

describe("caretKeepingDigitsAfter", () => {
  it("keeps the same digits to the right of the caret after a format", () => {
    // "+62 812-3456-7890": caret after "812" has eight digits to its right.
    expect(caretKeepingDigitsAfter("+62 812-3456-7890", 8)).toBe(8)
    expect(caretKeepingDigitsAfter("+62 812-3456-7890", 4)).toBe(13)
  })

  it("goes to the end when nothing follows, and to the start when everything does", () => {
    expect(caretKeepingDigitsAfter("+62 812-3456-7890", 0)).toBe(17)
    expect(caretKeepingDigitsAfter("+62 812-3456-7890", 99)).toBe(0)
  })

  it("survives the head being rewritten from 0812 to +62 812", () => {
    // Typing the sixth digit of "08123|4": the caret had one digit after it.
    const formatted = formatPhoneWhileTyping("081234")
    expect(formatted).toBe("+62 812-34")
    expect(caretKeepingDigitsAfter(formatted, 1)).toBe(9)
  })
})

describe("countDigits", () => {
  it("ignores separators and the plus", () => {
    expect(countDigits("+62 812-34")).toBe(7)
    expect(countDigits("")).toBe(0)
  })
})

describe("isValidPhone", () => {
  it("accepts plausible lengths and blank, refuses the rest", () => {
    expect(isValidPhone("")).toBe(true)
    expect(isValidPhone("081234567890")).toBe(true)
    expect(isValidPhone("0812")).toBe(false)
    expect(isValidPhone("08123456789012345")).toBe(false)
  })
})
