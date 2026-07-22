/**
 * Single active session enforcement (client-side, "last login wins").
 *
 * On each successful login we mint a fresh session id, store it both in the
 * `profiles.active_session_id` column and in this browser's localStorage.
 * A guard mounted in the app shell compares the two: if the DB value changes
 * (a newer login elsewhere), the older session signs itself out.
 *
 * This is a UX/anti-sharing guard, not a hard security boundary — it runs in
 * the browser. For strict server-side enforcement, the same id would also be
 * checked in middleware on every request.
 */
export const ACTIVE_SESSION_STORAGE_KEY = "le_active_session_id"

/** Generate a new session id. Uses crypto.randomUUID where available. */
export function newSessionId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID()
    }
    // Fallback for older environments.
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}
