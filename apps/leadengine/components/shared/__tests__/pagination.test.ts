import { describe, expect, it } from "vitest"
import { buildRange } from "../pagination"

describe("buildRange", () => {
  it("lists every page up to seven", () => {
    expect(buildRange(3, 5)).toEqual([1, 2, 3, 4, 5])
    expect(buildRange(1, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it("collapses the far side into an ellipsis", () => {
    expect(buildRange(1, 18)).toEqual([1, 2, "ellipsis", 18])
    expect(buildRange(7, 18)).toEqual([1, "ellipsis", 6, 7, 8, "ellipsis", 18])
    expect(buildRange(18, 18)).toEqual([1, "ellipsis", 17, 18])
  })
})
