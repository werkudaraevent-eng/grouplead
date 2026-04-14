type LeadWithCreatedAt = {
    created_at?: string | null
}

type DashboardPeriod = "this_month" | "this_quarter" | "this_year" | "all_time" | "custom"

type DateRange = {
    start: Date
    end: Date
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

function getPeriodRanges(period: DashboardPeriod, now: Date): { current: DateRange; previous: DateRange } {
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

export function splitDashboardLeadsByPeriod<T extends LeadWithCreatedAt>(
    leads: T[],
    period: DashboardPeriod,
    now = new Date()
) {
    const ranges = getPeriodRanges(period, now)
    const current: T[] = []
    const previous: T[] = []

    for (const lead of leads) {
        if (!lead.created_at) continue
        const createdAt = new Date(lead.created_at)
        if (Number.isNaN(createdAt.getTime())) continue

        if (isWithinRange(createdAt, ranges.current)) current.push(lead)
        if (isWithinRange(createdAt, ranges.previous)) previous.push(lead)
    }

    return { current, previous }
}
