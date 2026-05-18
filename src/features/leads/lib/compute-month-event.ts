/**
 * Compute Revenue-Recognition Month for an event.
 *
 * Rule (matches the form-side logic in `lead-form.tsx`):
 *   - Use the LAST date of the event (end date), not the start.
 *   - If the end day-of-month is greater than the company's cut-off date
 *     (default 25), bump the month forward by one. December bumps roll the
 *     year forward.
 *
 * Examples (cutoff = 25):
 *   ["2027-09-13", "2027-10-21"] → "October 2027"   // end 21 ≤ 25, keep Oct
 *   ["2026-10-26", "2026-10-31"] → "November 2026"  // end 31 > 25, bump
 *   ["2026-12-28", "2026-12-30"] → "January 2027"   // year rolls over
 *
 * Returns the canonical "Month YYYY" string consumed by the leads table
 * (`month_event` column) and the dashboard revenue-recognition basis.
 */

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]

export function computeMonthEvent(
    dates: ReadonlyArray<string> | null | undefined,
    cutoffDay: number,
): string | null {
    if (!Array.isArray(dates) || dates.length === 0) return null

    // Sort lexicographically — works because the parser always emits ISO YYYY-MM-DD.
    const sorted = [...dates].sort()
    const last = sorted[sorted.length - 1]
    const d = new Date(last)
    if (isNaN(d.getTime())) return null

    let month = d.getMonth()
    let year = d.getFullYear()
    if (d.getDate() > cutoffDay) {
        month += 1
        if (month > 11) {
            month = 0
            year += 1
        }
    }
    return `${MONTH_NAMES[month]} ${year}`
}
