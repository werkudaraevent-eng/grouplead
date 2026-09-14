import { describe, expect, it } from "vitest"
import { formatNumber, formatNumberWhileTyping, parseNumber } from "./number"

describe("formatNumber", () => {
  it("uses dots for thousands", () => {
    expect(formatNumber(300000000)).toBe("300.000.000")
    expect(formatNumber(0)).toBe("0")
    expect(formatNumber(null)).toBe("")
  })

  it("uses a comma for decimals when allowed", () => {
    expect(formatNumber(1234.5, 2)).toBe("1.234,5")
  })
})

describe("parseNumber", () => {
  it("reads what was typed whatever separators it carries", () => {
    expect(parseNumber("300.000.000")).toBe(300000000)
    expect(parseNumber("Rp 1.500")).toBe(1500)
    expect(parseNumber("1.234,56", 2)).toBe(1234.56)
    expect(parseNumber("")).toBeNull()
  })
})

describe("formatNumberWhileTyping", () => {
  it("regroups as digits arrive", () => {
    expect(formatNumberWhileTyping("3")).toBe("3")
    expect(formatNumberWhileTyping("3000")).toBe("3.000")
    expect(formatNumberWhileTyping("300000000")).toBe("300.000.000")
  })

  it("drops leading zeros and keeps a decimal in progress", () => {
    expect(formatNumberWhileTyping("007")).toBe("7")
    expect(formatNumberWhileTyping("1234,", 2)).toBe("1.234,")
    expect(formatNumberWhileTyping("1234,5", 2)).toBe("1.234,5")
    expect(formatNumberWhileTyping("1234,5", 0)).toBe("1.234")
  })
})
