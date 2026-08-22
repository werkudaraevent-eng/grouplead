import { afterEach, describe, expect, it } from "vitest"
import { authCookieOptions } from "./cookie-options"

const ORIGINAL = process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN
  else process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN = ORIGINAL
})

describe("authCookieOptions", () => {
  it("returns undefined when no domain is configured", () => {
    delete process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN
    expect(authCookieOptions()).toBeUndefined()
  })

  it("treats a blank value as unset so local dev keeps host-only cookies", () => {
    process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN = "   "
    expect(authCookieOptions()).toBeUndefined()
  })

  it("scopes the cookie to the parent domain when configured", () => {
    process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN = ".werkudara.com"
    expect(authCookieOptions()).toEqual({
      domain: ".werkudara.com",
      path: "/",
      sameSite: "lax",
      secure: true,
    })
  })

  it("trims surrounding whitespace from the configured domain", () => {
    process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN = "  .werkudara.com  "
    expect(authCookieOptions()?.domain).toBe(".werkudara.com")
  })
})
