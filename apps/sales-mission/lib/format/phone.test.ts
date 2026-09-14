import { describe, expect, it } from "vitest"
import { formatPhone, formatPhoneWhileTyping, isValidPhone, normalizePhone } from "./phone"

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

describe("isValidPhone", () => {
  it("accepts plausible lengths and blank, refuses the rest", () => {
    expect(isValidPhone("")).toBe(true)
    expect(isValidPhone("081234567890")).toBe(true)
    expect(isValidPhone("0812")).toBe(false)
    expect(isValidPhone("08123456789012345")).toBe(false)
  })
})
