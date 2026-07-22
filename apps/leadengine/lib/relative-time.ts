// Human-friendly "x ago" formatting for data-freshness labels.
//
// Kept dependency-free and locale-light on purpose: the dashboard only needs
// a compact English relative string (e.g. "2 minutes ago", "just now"). For
// anything older than ~30 days we fall back to a short absolute date so the
// label stays meaningful instead of saying "5 weeks ago".

const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * Format an ISO timestamp as a compact relative string.
 * Returns `null` when the input is missing or unparseable, so callers can
 * choose to render nothing rather than a misleading value.
 */
export function formatRelativeTime(iso: string | null | undefined, now: Date = new Date()): string | null {
    if (!iso) return null
    const then = new Date(iso)
    const t = then.getTime()
    if (Number.isNaN(t)) return null

    const diffSec = Math.floor((now.getTime() - t) / 1000)

    // Future or clock-skew within a minute → treat as fresh.
    if (diffSec < 45) return "just now"
    if (diffSec < 90) return "a minute ago"

    if (diffSec < HOUR) {
        const m = Math.round(diffSec / MINUTE)
        return `${m} minutes ago`
    }
    if (diffSec < 2 * HOUR) return "an hour ago"
    if (diffSec < DAY) {
        const h = Math.round(diffSec / HOUR)
        return `${h} hours ago`
    }
    if (diffSec < 2 * DAY) return "yesterday"
    if (diffSec < 30 * DAY) {
        const d = Math.round(diffSec / DAY)
        return `${d} days ago`
    }

    // Older than a month → short absolute date (e.g. "12 May 2026").
    return then.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

/**
 * Pick the most recent `updated_at`/`created_at` from a list of records.
 * Returns the latest ISO string, or `null` when the list is empty / has no
 * usable timestamps.
 */
export function latestTimestamp<T extends { updated_at?: string | null; created_at?: string | null }>(
    records: readonly T[],
): string | null {
    let latest = 0
    let latestIso: string | null = null
    for (const r of records) {
        const iso = r.updated_at ?? r.created_at
        if (!iso) continue
        const t = new Date(iso).getTime()
        if (!Number.isNaN(t) && t > latest) {
            latest = t
            latestIso = iso
        }
    }
    return latestIso
}
