type LeadWithDates = {
    created_at?: string | null
    received_date?: string | null
    month_event?: string | null
    event_date_end?: string | null
    event_date_start?: string | null
    closed_won_date?: string | null
    closed_lost_date?: string | null
    target_close_date?: string | null
}

export type DashboardPeriod = "this_month" | "this_quarter" | "this_year" | "all_time" | "custom"

/**
 * Per-metric date basis for the Performance Dashboard.
 *
 * Each KPI on the dashboard is bucketed using the date that matches
 * the question the metric answers. Mixing bases on the same dashboard
 * is intentional — see `docs/sales-performance-widget.md` and the
 * tooltip text inside `analytics-dashboard.tsx`.
 *
 * - received     : when the lead was first received (`received_date` →
 *                  `created_at`). Answers "who came in this period?".
 * - close        : when the deal was settled. For won leads this is
 *                  `closed_won_date`, for lost leads `closed_lost_date`.
 *                  Answers "what got resolved this period?".
 * - revenue      : when revenue is recognized for an event business.
 *                  `month_event` → `event_date_end` → `event_date_start`.
 *                  Answers "when was/will the revenue be earned?".
 * - target_close : the lead's expected close date. Used only for
 *                  forward-looking pipeline metrics. Leads without
 *                  this date are excluded from the bucket so the user
 *                  knows their data is incomplete.
 */
export type DateBasis = "received" | "close" | "revenue" | "target_close"

export type DateRange = {
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

// ─── Per-basis date resolvers ───────────────────────────────────────────────

function parseDate(value: string | null | undefined): Date | null {
    if (!value) return null
    const d = new Date(value)
    return isNaN(d.getTime()) ? null : d
}

/** Received-date basis: when the lead first entered the system. */
export function getReceivedDate(lead: LeadWithDates): Date | null {
    return parseDate(lead.received_date) ?? parseDate(lead.created_at)
}

/**
 * Close-date basis: when the deal was settled. Returns null while the
 * deal is still open. We assume the caller (the dashboard) has already
 * checked the lead's stage — this just resolves the date column.
 */
export function getCloseDate(lead: LeadWithDates): Date | null {
    return parseDate(lead.closed_won_date) ?? parseDate(lead.closed_lost_date)
}

/** Target-close basis: forward-looking pipeline date. No fallback by design. */
export function getTargetCloseDate(lead: LeadWithDates): Date | null {
    return parseDate(lead.target_close_date)
}

/**
 * Generic resolver that switches on basis. Returns null when the lead
 * has no date for the requested basis — caller should treat null as
 * "exclude this lead from this bucket".
 */
export function getDateForBasis(lead: LeadWithDates, basis: DateBasis): Date | null {
    switch (basis) {
        case "received": return getReceivedDate(lead)
        case "close": return getCloseDate(lead)
        case "revenue": return getRevenueDate(lead)
        case "target_close": return getTargetCloseDate(lead)
    }
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

export function getDashboardPeriodRanges(period: DashboardPeriod, now: Date, customRange?: { start: string; end: string }): { current: DateRange; previous: DateRange } {
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
    const ranges = getDashboardPeriodRanges(period, now, customRange)
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

/**
 * Generic basis-aware splitter. Each KPI on the dashboard runs this with
 * the basis appropriate to the metric:
 *   - Total Leads / Lead Conversion (received side)  → "received"
 *   - Deal Win Rate / Lead Conversion (won side)     → "close"
 *   - Won Revenue / Avg Deal                         → "revenue"
 *   - Pipeline Value                                 → "target_close"
 *
 * Leads without a date for the requested basis are excluded from BOTH
 * the current and previous buckets, AND counted in `excluded` so the
 * UI can flag missing data (e.g. "3 active deals excluded — no target
 * close date set").
 */
export function splitLeadsByBasis<T extends LeadWithDates>(
    leads: T[],
    basis: DateBasis,
    period: DashboardPeriod,
    now = new Date(),
    customRange?: { start: string; end: string },
): { current: T[]; previous: T[]; excluded: T[] } {
    const ranges = getDashboardPeriodRanges(period, now, customRange)
    const current: T[] = []
    const previous: T[] = []
    const excluded: T[] = []

    for (const lead of leads) {
        const date = getDateForBasis(lead, basis)
        if (!date) {
            excluded.push(lead)
            continue
        }
        if (isWithinRange(date, ranges.current)) current.push(lead)
        if (isWithinRange(date, ranges.previous)) previous.push(lead)
    }

    return { current, previous, excluded }
}

// ─── Cross-year YoY helpers ──────────────────────────────────────────────────
//
// Pipelines model a fiscal period ("Group Lead 2025"). For honest YoY the
// PREVIOUS bucket must come from the prior YEAR'S PIPELINE, not from same-
// pipeline date math — a pipeline can hold leads dated in other years, so
// date-only comparison double-counts. These helpers pair the active pipeline
// with the one whose fiscal_year is exactly one less.

/**
 * Resolve the pipeline representing the year before the active pipeline.
 * Returns null when the active pipeline has no fiscal_year, or when no
 * pipeline exists for (activeYear - 1). When several pipelines share the
 * prior year, an is_default match wins, else the first encountered.
 */
export function findPriorYearPipelineId(
    pipelines: { id: string; fiscal_year?: number | null; is_default?: boolean }[],
    activePipelineId: string | undefined | null,
): string | null {
    if (!activePipelineId) return null
    const active = pipelines.find((p) => p.id === activePipelineId)
    const activeYear = active?.fiscal_year
    if (activeYear == null) return null

    const candidates = pipelines.filter((p) => p.fiscal_year === activeYear - 1)
    if (candidates.length === 0) return null
    return (candidates.find((p) => p.is_default) ?? candidates[0]).id
}

/**
 * Like splitLeadsByBasis, but the PREVIOUS bucket is computed from a
 * separate set of leads (the prior-year pipeline). The CURRENT bucket and
 * excluded list come from the active set. When priorLeads is empty the
 * previous bucket is empty and callers should suppress YoY deltas.
 */
export function splitLeadsByBasisWithPrior<T extends LeadWithDates>(
    currentLeads: T[],
    priorLeads: T[],
    basis: DateBasis,
    period: DashboardPeriod,
    now = new Date(),
    customRange?: { start: string; end: string },
): { current: T[]; previous: T[]; excluded: T[] } {
    const cur = splitLeadsByBasis(currentLeads, basis, period, now, customRange)
    const prev = splitLeadsByBasis(priorLeads, basis, period, now, customRange)
    return { current: cur.current, previous: prev.previous, excluded: cur.excluded }
}

/**
 * Cross-year variant of splitDashboardLeadsByPeriod (revenue-date basis).
 */
export function splitDashboardLeadsByPeriodWithPrior<T extends LeadWithDates>(
    currentLeads: T[],
    priorLeads: T[],
    period: DashboardPeriod,
    now = new Date(),
    customRange?: { start: string; end: string },
) {
    const cur = splitDashboardLeadsByPeriod(currentLeads, period, now, customRange)
    const prev = splitDashboardLeadsByPeriod(priorLeads, period, now, customRange)
    return { current: cur.current, previous: prev.previous }
}

// ─── Target proration helpers ───────────────────────────────────────────────
//
// Sales targets in LeadEngine are stored at varying period granularities:
//   • goal_user_targets:  has explicit period_start / period_end
//   • goal_nodes monthly: 12 month buckets keyed "1".."12"
//   • goal_nodes total:   single annual amount tied to activeGoal.period
//   • breakdown_config:   nested pct splits of activeGoal.target_amount
//
// When the dashboard period (this_month / this_quarter / custom / etc.)
// differs from the target's natural span, we have to prorate the target
// down to a comparable amount or the achievement % is misleading
// (e.g. quarter-actual vs annual-target = always ~25%).

const MS_PER_DAY = 24 * 60 * 60 * 1000

export function rangesOverlapDays(a: DateRange, b: DateRange): number {
    const start = Math.max(a.start.getTime(), b.start.getTime())
    const end = Math.min(a.end.getTime(), b.end.getTime())
    if (end <= start) return 0
    return (end - start) / MS_PER_DAY
}

export function rangeDurationDays(range: DateRange): number {
    return Math.max(0, (range.end.getTime() - range.start.getTime()) / MS_PER_DAY)
}

/**
 * Linear proration: targetAmount * overlapDays / targetSpanDays.
 * Returns the original amount when dashboardRange fully covers targetRange
 * or when the target is "all_time" (sentinel infinite range).
 */
export function prorateTarget(
    targetAmount: number,
    targetRange: DateRange,
    dashboardRange: DateRange,
): number {
    if (!Number.isFinite(targetAmount) || targetAmount <= 0) return 0
    const span = rangeDurationDays(targetRange)
    if (span <= 0) return 0
    const overlap = rangesOverlapDays(targetRange, dashboardRange)
    if (overlap <= 0) return 0
    if (overlap >= span) return targetAmount
    return targetAmount * (overlap / span)
}

/**
 * Sum monthly target buckets ("1".."12") that overlap dashboardRange.
 * Months are treated as full calendar months in the supplied targetYear.
 * Partial-month overlap (e.g. dashboard ends mid-month) is prorated by days.
 */
export function prorateMonthlyTargets(
    monthlyTargets: Record<string, number> | null | undefined,
    targetYear: number,
    dashboardRange: DateRange,
): number {
    if (!monthlyTargets) return 0
    let total = 0
    for (let m = 0; m < 12; m++) {
        const amount = monthlyTargets[String(m + 1)] || 0
        if (amount <= 0) continue
        const monthRange: DateRange = {
            start: new Date(targetYear, m, 1),
            end: new Date(targetYear, m + 1, 1),
        }
        total += prorateTarget(amount, monthRange, dashboardRange)
    }
    return total
}

/**
 * True when dashboardRange is the "all_time" sentinel (covers everything).
 * Used to short-circuit proration and return raw targets.
 */
export function isAllTimeRange(range: DateRange): boolean {
    return range.start.getTime() <= 0 && range.end.getTime() >= 8640000000000000
}
