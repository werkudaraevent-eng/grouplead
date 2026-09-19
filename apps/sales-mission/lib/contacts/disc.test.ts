import { describe, expect, it } from "vitest"
import { DISC_LETTERS, DISC_PROFILES, describeDisc, discCode, isDiscLetter, normalizeDisc } from "./disc"

describe("disc", () => {
  it("knows the four letters and nothing else", () => {
    for (const letter of DISC_LETTERS) expect(isDiscLetter(letter)).toBe(true)
    expect(isDiscLetter("X")).toBe(false)
    expect(isDiscLetter("d")).toBe(false)
    expect(isDiscLetter(null)).toBe(false)
  })

  it("writes the code from the pair, dropping a secondary that repeats the primary", () => {
    expect(discCode("D", "I")).toBe("DI")
    expect(discCode("S", null)).toBe("S")
    expect(discCode("C", "C")).toBe("C")
    expect(discCode(null, "I")).toBe("")
  })

  it("describes the approach from the primary, with the secondary as a side note", () => {
    expect(describeDisc("D")).toBe(DISC_PROFILES.D.approach)
    expect(describeDisc("D", "I")).toContain("Ada sisi Influence")
    expect(describeDisc(null)).toBe("")
  })

  it("normalises a stored pair: unknown letters and a repeated secondary fall away", () => {
    expect(normalizeDisc("D", "I")).toEqual({ primary: "D", secondary: "I" })
    expect(normalizeDisc("D", "D")).toEqual({ primary: "D", secondary: null })
    expect(normalizeDisc("x", "I")).toEqual({ primary: null, secondary: null })
    expect(normalizeDisc(undefined, undefined)).toEqual({ primary: null, secondary: null })
  })
})
