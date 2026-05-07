type LeadWithDates = {
    created_at?: string | null
    month_event?: string | null
    event_date_end?: string | null
    event_date_start?: string | null
    closed_won_date?: string | null
}

type DashboardPeriod = "this_month" | "this_quarter" | "this_year" | "all_time" | "custom"

type DateRange = {
    start: Date
    end: Date
}

/**
 * Resolve the revenue recognition date for a lead.
 * Priority: month_event → event_date_end → event_date_start → closed_won_date → created_at
 */
const MONTH_MAP: Record<string, number> = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
}

export function getRevenueDate(lead: LeadWithDates): Date | null {
    // 1. month_event: "April 2026" → first day of that month
    if (lead.month_event && typeof lead.month_event === "string") {
        const parts = lead.month_event.trim().split(/\s+/)
        if (parts.length === 2) {
            const monthIdx = MONTH_MAP[parts[0].toLowerCase()]
            const year = parseInt(parts[1], 10)
            if (monthIdx !== undefined && !isNaN(year)) {
                return new Date(year, monthIdx, 1)
            }
        }
    }

    // 2. event_date_end
    if (lead.event_date_end) {
        const d = new Date(lead.event_date_end)
        if (!isNaN(d.getTime())) return d
    }

    // 3. event_date_start
    if (lead.event_date_start) {
        const d = new Date(lead.event_date_start)
        if (!isNaN(d.getTime())) return d
    }

    // 4. closed_won_date
    if (lead.closed_won_date) {
        const d = new Date(lead.closed_won_date)
        if (!isNaN(d.getTime())) return d
    }

    // 5. Fallback: created_at
    if (lead.created_at) {
        const d = new Date(lead.created_at)
        if (!isNaN(d.getTime())) return d
    }

    return null
}

function startOfMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date: Date, months: number) {
    return new Date(date.getFullYear(), date.getMonth() + months, 1)
}

function startOfQuarter(date: Date) {
    const quarterStartMonth = Math.floor(date.getMonth() / 3) * 3
    return new Date(date.getFullYear(), quarterStartMonth, 1)
}

function addYears(date: Date, years: number) {
    return new Date(date.getFullYear() + years, date.getMonth(), date.getDate())
}

function getPeriodRanges(period: DashboardPeriod, now: Date, customRange?: { start: string; end: string }): { current: DateRange; previous: DateRange } {
    if (period === "this_month") {
        const start = startOfMonth(now)
        return {
            current: { start, end: addMonths(start, 1) },
            previous: { start: addYears(start, -1), end: addYears(addMonths(start, 1), -1) },
        }
    }

    if (period === "this_quarter") {
        const start = startOfQuarter(now)
        return {
            current: { start, end: addMonths(start, 3) },
            previous: { start: addYears(start, -1), end: addYears(addMonths(start, 3), -1) },
        }
    }

    if (period === "this_year") {
        const start = new Date(now.getFullYear(), 0, 1)
        const end = new Date(now.getFullYear() + 1, 0, 1)
        return {
            current: { start, end },
            previous: { start: new Date(now.getFullYear() - 1, 0, 1), end: start },
        }
    }

    // Custom range with explicit dates
    if (period === "custom" && customRange?.start && customRange?.end) {
        const start = new Date(customRange.start)
        const end = new Date(customRange.end)
        end.setDate(end.getDate() + 1) // Include end date
        const durationMs = end.getTime() - start.getTime()
        return {
            current: { start, end },
            previous: { start: new Date(start.getTime() - durationMs), end: start },
        }
    }

    // all_time or custom without dates
    const previousYearStart = new Date(now.getFullYear() - 1, 0, 1)
    const previousYearEnd = new Date(now.getFullYear(), 0, 1)
    return {
        current: { start: new Date(0), end: new Date(8640000000000000) },
        previous: { start: previousYearStart, end: previousYearEnd },
    }
}

function isWithinRange(value: Date, range: DateRange) {
    return value >= range.start && value < range.end
}

export function splitDashboardLeadsByPeriod<T extends LeadWithDates>(
    leads: T[],
    period: DashboardPeriod,
    now = new Date(),
    customRange?: { start: string; end: string }
) {
    const ranges = getPeriodRanges(period, now, customRange)
    const current: T[] = []
    const previous: T[] = []

    for (const lead of leads) {
        const revenueDate = getRevenueDate(lead)
        if (!revenueDate) continue

        if (isWithinRange(revenueDate, ranges.current)) current.push(lead)
        if (isWithinRange(revenueDate, ranges.previous)) previous.push(lead)
    }

    return { current, previous }
}
