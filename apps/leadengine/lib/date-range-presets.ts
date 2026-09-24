/**
 * The dashboard's date range, in its own model: a named period
 * (`this_month`, `this_quarter`, `this_year`, `all_time`) or `custom` with
 * two ISO days. The quick ranges, what a range reads as, and which quick
 * range a range is, shared by the desk's popover, the phone's date sheet
 * and the phone's Filter sheet (`components/shared/date-range-filter.tsx`).
 */
import { format, parseISO, isValid, startOfMonth, endOfMonth, subMonths, subDays, startOfYear } from "date-fns"

/** The period the dashboard opens on, and the one "Reset" and "Clear all" return to. */
export const DEFAULT_DASHBOARD_PERIOD = "this_quarter"

export interface DateRangePreset {
    key: string
    label: string
    resolve: (now: Date) => { period: string; start: string; end: string }
}

const iso = (d: Date) => format(d, "yyyy-MM-dd")

/** In display order. */
export const DATE_RANGE_PRESETS: DateRangePreset[] = [
    { key: "today", label: "Today", resolve: (n) => ({ period: "custom", start: iso(n), end: iso(n) }) },
    { key: "last7", label: "Last 7 days", resolve: (n) => ({ period: "custom", start: iso(subDays(n, 6)), end: iso(n) }) },
    { key: "last30", label: "Last 30 days", resolve: (n) => ({ period: "custom", start: iso(subDays(n, 29)), end: iso(n) }) },
    { key: "this_month", label: "This Month", resolve: () => ({ period: "this_month", start: "", end: "" }) },
    { key: "last_month", label: "Last Month", resolve: (n) => ({ period: "custom", start: iso(startOfMonth(subMonths(n, 1))), end: iso(endOfMonth(subMonths(n, 1))) }) },
    { key: "this_quarter", label: "This Quarter", resolve: () => ({ period: "this_quarter", start: "", end: "" }) },
    { key: "this_year", label: "This Year", resolve: () => ({ period: "this_year", start: "", end: "" }) },
    { key: "ytd", label: "Year to Date", resolve: (n) => ({ period: "custom", start: iso(startOfYear(n)), end: iso(n) }) },
    { key: "all_time", label: "All Time", resolve: () => ({ period: "all_time", start: "", end: "" }) },
]

const NAMED_LABELS: Record<string, string> = {
    this_month: "This Month",
    this_quarter: "This Quarter",
    this_year: "This Year",
    all_time: "All Time",
}

/** "This Quarter", "3 Mar 2026", "1 Jan – 31 Dec 2025", else "Date Range". */
export function dateRangeLabel(period: string, start: string, end: string): string {
    if (NAMED_LABELS[period]) return NAMED_LABELS[period]
    if (period === "custom" && start && end) {
        const sd = parseISO(start)
        const ed = parseISO(end)
        if (isValid(sd) && isValid(ed)) {
            if (sd.getTime() === ed.getTime()) return format(sd, "d MMM yyyy")
            const sameYear = sd.getFullYear() === ed.getFullYear()
            return `${format(sd, sameYear ? "d MMM" : "d MMM yyyy")} – ${format(ed, "d MMM yyyy")}`
        }
    }
    return "Date Range"
}

/** The quick range a range is, if it is one (a custom range that happens to be "Last 7 days" is). */
export function activeDateRangePreset(period: string, start: string, end: string, now: Date): string | null {
    for (const p of DATE_RANGE_PRESETS) {
        const r = p.resolve(now)
        if (r.period === "custom") {
            if (period === "custom" && r.start === start && r.end === end) return p.key
        } else if (r.period === period) {
            return p.key
        }
    }
    return null
}

/** A range picked on the calendar: custom, and none of the quick ranges. */
export function isCustomDateRange(period: string, start: string, end: string, now: Date): boolean {
    return period === "custom" && activeDateRangePreset(period, start, end, now) === null
}
