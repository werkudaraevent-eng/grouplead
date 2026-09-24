import { describe, expect, it } from "vitest"
import { HINT_KEY, INTRO_PAGES, listIntroKey, pageIntroKey } from "./hint-key"

describe("list intro keys", () => {
  it("name the list and pass the table's own check", () => {
    expect(listIntroKey("activities")).toBe("list-intro-activities")
    for (const list of ["activities", "prospects", "reports"] as const) expect(HINT_KEY.test(listIntroKey(list))).toBe(true)
  })
})

describe("page intro keys", () => {
  it("name the page and pass the table's own check", () => {
    expect(pageIntroKey("calendar")).toBe("page-intro-calendar")
    for (const page of INTRO_PAGES) expect(HINT_KEY.test(pageIntroKey(page))).toBe(true)
  })

  it("are one per page", () => {
    expect(new Set(INTRO_PAGES).size).toBe(INTRO_PAGES.length)
  })
})
