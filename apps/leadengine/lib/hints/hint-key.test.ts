import { describe, expect, it } from "vitest"
import { HINT_KEY, INTRO_PAGES, listIntroKey, pageIntroKey, pageIntroKeys } from "./hint-key"

describe("list intro keys", () => {
  it("name the list and pass the table's own check", () => {
    expect(listIntroKey("contacts")).toBe("list-intro-contacts")
    expect(listIntroKey("companies")).toBe("list-intro-companies")
    for (const key of [listIntroKey("contacts"), listIntroKey("companies")]) expect(HINT_KEY.test(key)).toBe(true)
  })
})

describe("page intro keys", () => {
  it("name the page after its path", () => {
    expect(pageIntroKey("settings")).toBe("page-intro-settings")
    expect(pageIntroKey("settings-ai-usage")).toBe("page-intro-settings-ai-usage")
    expect(pageIntroKey("changelog")).toBe("page-intro-changelog")
  })

  it("pass the table's own check for every page", () => {
    for (const page of INTRO_PAGES) expect(HINT_KEY.test(pageIntroKey(page)), page).toBe(true)
  })

  it("are one per page", () => {
    const keys = INTRO_PAGES.map(pageIntroKey)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it("are picked out of a person's other seen marks", () => {
    const seen = ["announce-usage-2026-09-23", "list-intro-contacts", "page-intro-settings", "page-intro-changelog"]
    expect(pageIntroKeys(seen)).toEqual(["page-intro-settings", "page-intro-changelog"])
    expect(pageIntroKeys([])).toEqual([])
  })
})
