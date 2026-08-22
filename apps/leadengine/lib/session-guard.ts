/**
 * Single active session enforcement (client-side, "last login wins").
 *
 * On each successful login we mint a fresh session id, store it both in the
 * `profiles.active_session_id` column and in this browser. A guard mounted in
 * the app shell compares the two: if the DB value changes (a newer login
 * elsewhere), the older session signs itself out.
 *
 * The id lives in a cookie scoped to the parent domain, not localStorage.
 * localStorage is per-origin, so LeadEngine and Sales Mission would each hold
 * their own copy — logging in on one app would look like a "newer login
 * elsewhere" to the other and sign it out, defeating the shared session. A
 * parent-domain cookie gives both apps one value to compare against.
 *
 * This is a UX/anti-sharing guard, not a hard security boundary — it runs in
 * the browser and the id is not a secret. For strict server-side enforcement,
 * the same id would also be checked in middleware on every request.
 */
export const ACTIVE_SESSION_COOKIE = 'le_active_session_id'

/** Legacy localStorage key, still read once so a deploy does not sign everyone out. */
const LEGACY_STORAGE_KEY = 'le_active_session_id'

const MAX_AGE_SECONDS = 60 * 60 * 24 * 30

/** Generate a new session id. Uses crypto.randomUUID where available. */
export function newSessionId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID()
    }
    // Fallback for older environments.
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function cookieAttributes(): string {
    const domain = process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN?.trim()
    const parts = ['path=/', 'samesite=lax']
    if (domain) parts.push(`domain=${domain}`)
    // Secure would make the cookie unwritable over plain http (local dev).
    if (typeof location !== 'undefined' && location.protocol === 'https:') parts.push('secure')
    return parts.join('; ')
}

/**
 * Read the active session id for this browser.
 *
 * Falls back to the pre-cookie localStorage value once and migrates it, so the
 * first load after this change does not read as a stale session.
 */
export function readActiveSessionId(): string | null {
    if (typeof document === 'undefined') return null

    const match = document.cookie
        .split('; ')
        .find((entry) => entry.startsWith(`${ACTIVE_SESSION_COOKIE}=`))

    if (match) return decodeURIComponent(match.slice(ACTIVE_SESSION_COOKIE.length + 1)) || null

    try {
        const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
        if (legacy) {
            writeActiveSessionId(legacy)
            localStorage.removeItem(LEGACY_STORAGE_KEY)
            return legacy
        }
    } catch {
        // localStorage can throw in private modes — treat as "no id".
    }

    return null
}

/** Store the active session id so every Werkudara app sees the same value. */
export function writeActiveSessionId(id: string): void {
    if (typeof document === 'undefined') return
    document.cookie = `${ACTIVE_SESSION_COOKIE}=${encodeURIComponent(id)}; ${cookieAttributes()}; max-age=${MAX_AGE_SECONDS}`
}

/** Drop the stored id. Called on sign-out. */
export function clearActiveSessionId(): void {
    if (typeof document === 'undefined') return
    document.cookie = `${ACTIVE_SESSION_COOKIE}=; ${cookieAttributes()}; max-age=0`
    try {
        localStorage.removeItem(LEGACY_STORAGE_KEY)
    } catch {
        // ignore
    }
}
