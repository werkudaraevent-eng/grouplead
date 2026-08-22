/**
 * Single active session enforcement ("last login wins"), shared with LeadEngine.
 *
 * Both apps read and write the same parent-domain cookie, so signing in on one
 * app does not read as a foreign login to the other. Keep the cookie name and
 * semantics in sync with `apps/leadengine/lib/session-guard.ts`.
 *
 * This is a UX/anti-sharing guard, not a hard security boundary — it runs in
 * the browser and the id is not a secret.
 */
export const ACTIVE_SESSION_COOKIE = "le_active_session_id"

const MAX_AGE_SECONDS = 60 * 60 * 24 * 30

/** Generate a new session id. Uses crypto.randomUUID where available. */
export function newSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function cookieAttributes(): string {
  const domain = process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN?.trim()
  const parts = ["path=/", "samesite=lax"]
  if (domain) parts.push(`domain=${domain}`)
  // Secure would make the cookie unwritable over plain http (local dev).
  if (typeof location !== "undefined" && location.protocol === "https:") parts.push("secure")
  return parts.join("; ")
}

/** Read the active session id for this browser. */
export function readActiveSessionId(): string | null {
  if (typeof document === "undefined") return null

  const match = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${ACTIVE_SESSION_COOKIE}=`))

  return match ? decodeURIComponent(match.slice(ACTIVE_SESSION_COOKIE.length + 1)) || null : null
}

/** Store the active session id so every Werkudara app sees the same value. */
export function writeActiveSessionId(id: string): void {
  if (typeof document === "undefined") return
  document.cookie = `${ACTIVE_SESSION_COOKIE}=${encodeURIComponent(id)}; ${cookieAttributes()}; max-age=${MAX_AGE_SECONDS}`
}

/** Drop the stored id. Called on sign-out. */
export function clearActiveSessionId(): void {
  if (typeof document === "undefined") return
  document.cookie = `${ACTIVE_SESSION_COOKIE}=; ${cookieAttributes()}; max-age=0`
}
