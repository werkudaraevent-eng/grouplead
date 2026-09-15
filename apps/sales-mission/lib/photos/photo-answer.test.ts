import { describe, expect, it } from "vitest"
import { fitWithin, isCompanyPhoto, parsePhotoAnswer, photoAnswerViolation } from "./photo-answer"

const company = "11111111-1111-4111-8111-111111111111"
const good = { path: `${company}/mission-abc/22222222-2222-4222-8222-222222222222.jpg`, name: "IMG_0001.jpg", size: 512_000, width: 1600, height: 1200 }

describe("parsePhotoAnswer", () => {
  it("keeps valid photos, from an array or its JSON, and drops the rest", () => {
    expect(parsePhotoAnswer([good, { path: "../etc/passwd", name: "x", size: 1 }, "junk"])).toEqual([good])
    expect(parsePhotoAnswer(JSON.stringify([good]))).toEqual([good])
    expect(parsePhotoAnswer(null)).toEqual([])
    expect(parsePhotoAnswer("not json")).toEqual([])
  })
})

describe("photoAnswerViolation", () => {
  it("accepts nothing, and a short list of valid photos", () => {
    expect(photoAnswerViolation(null, "Foto")).toBeNull()
    expect(photoAnswerViolation([good], "Foto")).toBeNull()
  })

  it("refuses too many, and anything malformed", () => {
    expect(photoAnswerViolation([good, good, good], "Foto", 2)).toContain("maksimal 2")
    expect(photoAnswerViolation([{ ...good, size: 99_999_999 }], "Foto")).toContain("tidak dikenal")
    expect(photoAnswerViolation("x", "Foto")).toContain("tidak valid")
  })
})

describe("paths and sizes", () => {
  it("ties a path to its company folder", () => {
    expect(isCompanyPhoto(good.path, company)).toBe(true)
    expect(isCompanyPhoto(good.path, "33333333-3333-4333-8333-333333333333")).toBe(false)
  })

  it("fits the longest edge and keeps the ratio", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 })
    expect(fitWithin(800, 1200)).toEqual({ width: 800, height: 1200 })
  })
})
