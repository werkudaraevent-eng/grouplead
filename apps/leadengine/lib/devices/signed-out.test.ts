import { describe, expect, it } from "vitest"
import { hasAuthCookie, isSignedOutError, SIGNED_OUT_LOGIN_PATH } from "./signed-out"

describe("isSignedOutError", () => {
  it("reads a session that no longer exists as signed out", () => {
    // What auth-js makes of GoTrue's 403 session_not_found on /user.
    expect(isSignedOutError({ name: "AuthSessionMissingError", status: 400 })).toBe(true)
    // A refresh after the session row was deleted.
    expect(isSignedOutError({ name: "AuthApiError", status: 400, code: "refresh_token_not_found" })).toBe(true)
    expect(isSignedOutError({ name: "AuthApiError", status: 403, code: "session_not_found" })).toBe(true)
    expect(isSignedOutError({ name: "AuthApiError", status: 400, code: "session_expired" })).toBe(true)
  })

  it("does not read a network failure or another error as signed out", () => {
    expect(isSignedOutError({ name: "AuthRetryableFetchError", status: 0 })).toBe(false)
    expect(isSignedOutError({ name: "AuthRetryableFetchError", status: 503, code: "session_not_found" })).toBe(false)
    expect(isSignedOutError({ name: "AuthApiError", status: 429, code: "over_request_rate_limit" })).toBe(false)
    expect(isSignedOutError(new Error("boom"))).toBe(false)
    expect(isSignedOutError(null)).toBe(false)
    expect(isSignedOutError("session_not_found")).toBe(false)
  })
})

describe("hasAuthCookie", () => {
  it("finds Supabase's session cookie, whole or chunked", () => {
    expect(hasAuthCookie(["sb-abcdefgh-auth-token"])).toBe(true)
    expect(hasAuthCookie(["theme", "sb-abcdefgh-auth-token.0", "sb-abcdefgh-auth-token.1"])).toBe(true)
  })
  it("ignores everything else", () => {
    expect(hasAuthCookie([])).toBe(false)
    expect(hasAuthCookie(["sidebar-collapsed", "le_active_session_id", "sb-abcdefgh-auth-token-code-verifier"])).toBe(false)
  })
})

describe("SIGNED_OUT_LOGIN_PATH", () => {
  it("is the login page with the reason", () => {
    expect(SIGNED_OUT_LOGIN_PATH).toBe("/login?reason=signed-out")
  })
})
