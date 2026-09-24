import { describe, expect, it } from "vitest"
import { HINT_KEY, listIntroKey } from "./hint-key"

describe("list intro keys", () => {
  it("name the list and pass the table's own check", () => {
    expect(listIntroKey("contacts")).toBe("list-intro-contacts")
    expect(listIntroKey("companies")).toBe("list-intro-companies")
    for (const key of [listIntroKey("contacts"), listIntroKey("companies")]) expect(HINT_KEY.test(key)).toBe(true)
  })
})
