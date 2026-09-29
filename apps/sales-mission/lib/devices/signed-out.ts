/**
 * Telling "this device was signed out" apart from everything else that can
 * go wrong when asking Supabase Auth who is here.
 *
 * Signing a device out (Perangkat aktif, LeadEngine's Active devices, an
 * admin's Sign out everywhere, a password change) deletes its row in
 * auth.sessions. From then on GoTrue answers that device's access token
 * with 403 `session_not_found` on /user (auth-js turns it into an
 * AuthSessionMissingError and drops the stored session), and its refresh
 * token with `refresh_token_not_found`. A network failure is not a sign
 * out: the device is still signed in and should stay so.
 *
 * Kept in step with `apps/leadengine/lib/devices/signed-out.ts`.
 */

/** `?reason=` on /login after a sign-out the person did not do here. */
export const SIGNED_OUT_REASON = "signed-out"

export const SIGNED_OUT_LOGIN_PATH = `/login?reason=${SIGNED_OUT_REASON}`

export const SIGNED_OUT_MESSAGE = "Kamu dikeluarkan dari perangkat ini."

/** GoTrue's error codes for a session that no longer exists or may no longer be used. */
const SESSION_GONE_CODES = new Set([
  "session_not_found",
  "session_expired",
  "refresh_token_not_found",
  "refresh_token_already_used",
  "user_not_found",
])

export function isSignedOutError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const { name, code } = error as { name?: unknown; code?: unknown }
  if (name === "AuthRetryableFetchError") return false
  if (name === "AuthSessionMissingError") return true
  return typeof code === "string" && SESSION_GONE_CODES.has(code)
}

/** Supabase's session cookie, whole or in chunks: `sb-<project>-auth-token`, `…-auth-token.0`. */
const AUTH_COOKIE = /^sb-.+-auth-token(?:\.\d+)?$/

/** Whether the request came with a session at all, so a failure means it ended rather than never began. */
export function hasAuthCookie(names: readonly string[]): boolean {
  return names.some((name) => AUTH_COOKIE.test(name))
}
