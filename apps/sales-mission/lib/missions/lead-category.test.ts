import { describe, expect, it } from "vitest"
import { optionLabel, suggestCategory } from "./lead-category"

const options = [
  { label: "HQL", value: "HQL" },
  { label: "Hot Lead", value: "HOT LEAD" },
  { label: "Warm Lead", value: "WARM LEAD" },
  { label: "Cold Lead", value: "COLD LEAD" },
]

describe("suggestCategory", () => {
  it("matches the interest kind to the option by word, returning the stored value", () => {
    expect(suggestCategory(options, "hot")).toBe("HOT LEAD")
    expect(suggestCategory(options, "warm")).toBe("WARM LEAD")
    expect(suggestCategory(options, "cold")).toBe("COLD LEAD")
  })

  it("reads Indonesian labels too, and suggests HQL only for an HQL interest", () => {
    expect(suggestCategory([{ label: "Lead Panas", value: "P" }, { label: "HQL", value: "HQL" }], "hot")).toBe("P")
    expect(suggestCategory([{ label: "HQL", value: "HQL" }], "hot")).toBeNull()
    expect(suggestCategory(options, "hql")).toBe("HQL")
  })

  it("returns null for no interest, an unknown kind, or no options", () => {
    expect(suggestCategory(options, "none")).toBeNull()
    expect(suggestCategory(options, null)).toBeNull()
    expect(suggestCategory([], "hot")).toBeNull()
  })

  it("does not match on substrings inside other words", () => {
    expect(suggestCategory([{ label: "Shotgun", value: "SHOTGUN" }], "hot")).toBeNull()
  })
})

describe("optionLabel", () => {
  it("shows the label for a value, or the value when the option is gone", () => {
    expect(optionLabel(options, "HOT LEAD")).toBe("Hot Lead")
    expect(optionLabel(options, "RETIRED")).toBe("RETIRED")
    expect(optionLabel(options, null)).toBeNull()
  })
})
