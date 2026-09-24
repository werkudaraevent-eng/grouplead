import { describe, expect, it } from "vitest"
import { HINT_KEY, listIntroKey } from "./hint-key"

describe("list intro keys", () => {
  it("name the list and pass the table's own check", () => {
    expect(listIntroKey("activities")).toBe("list-intro-activities")
    for (const list of ["activities", "prospects", "reports"] as const) expect(HINT_KEY.test(listIntroKey(list))).toBe(true)
  })
})
