import { describe, expect, it } from "vitest"
import { LIST_NOUNS, listCountText } from "./list-count"

describe("listCountText", () => {
  const unfiltered = { shown: 170, total: 170, narrowed: false }
  const filtered = { shown: 12, total: 170, narrowed: true }

  it("says the total on a phone and nothing in a desk footer while nothing narrows the list", () => {
    expect(listCountText("activities", unfiltered, false, "phone")).toBe("170 aktivitas")
    expect(listCountText("activities", unfiltered, false, "footer")).toBe("")
  })

  it("says X dari Y in both places while a filter narrows the list", () => {
    expect(listCountText("activities", filtered, false, "phone")).toBe("12 dari 170 aktivitas")
    expect(listCountText("activities", filtered, false, "footer")).toBe("12 dari 170 aktivitas")
  })

  it("keeps X dari Y when the filter happens to match everything", () => {
    expect(listCountText("reports", { shown: 40, total: 40, narrowed: true }, false, "footer")).toBe("40 dari 40 laporan")
  })

  it("says Menyaring… in both places while the next query loads, filtered or not", () => {
    for (const facts of [unfiltered, filtered]) {
      expect(listCountText("prospects", facts, true, "phone")).toBe("Menyaring…")
      expect(listCountText("prospects", facts, true, "footer")).toBe("Menyaring…")
    }
  })

  it("uses each list's own word for its records", () => {
    expect(LIST_NOUNS).toEqual({ activities: "aktivitas", prospects: "prospek", reports: "laporan" })
    expect(listCountText("prospects", filtered, false, "footer")).toBe("12 dari 170 prospek")
    expect(listCountText("reports", unfiltered, false, "phone")).toBe("170 laporan")
  })
})
