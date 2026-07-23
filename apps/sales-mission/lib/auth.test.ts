import { describe, expect, it } from "vitest"
import { resolveProviderDisplayName } from "./auth"

describe("resolveProviderDisplayName", () => {
  it("prefers full_name", () => {
    expect(resolveProviderDisplayName({ full_name: "Yulia Wijaya", given_name: "Other" })).toBe("Yulia Wijaya")
  })

  it("combines given and family names", () => {
    expect(resolveProviderDisplayName({ given_name: "Yulia", family_name: "Wijaya" })).toBe("Yulia Wijaya")
  })

  it("uses neutral fallback when claims are missing", () => {
    expect(resolveProviderDisplayName({})).toBe("New User")
  })

  it("does not use email as display name", () => {
    expect(resolveProviderDisplayName({ email: "yulia@example.com" })).toBe("New User")
  })
})