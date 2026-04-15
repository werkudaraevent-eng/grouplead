import type { LeadAttributionInput, GoalV2 } from '@/types/goals'

/**
 * Clamps a cutoff day to the valid range [1, 28].
 */
export function clampCutoff(cutoff: number): number {
  if (!Number.isFinite(cutoff)) return 28
  return Math.max(1, Math.min(28, Math.round(cutoff)))
}

/**
 * Returns the effective cutoff day for a given month, considering
 * per-month overrides and the global default from GoalV2.
 */
export function getEffectiveCutoff(
  month: number,
  goal: Pick<GoalV2, 'monthly_cutoff_day' | 'per_month_cutoffs'>
): number {
  const monthKey = String(month)
  if (goal.per_month_cutoffs && monthKey in goal.per_month_cutoffs) {
    return clampCutoff(goal.per_month_cutoffs[monthKey])
  }
  return clampCutoff(goal.monthly_cutoff_day)
}

/**
 * Formats a Date as YYYY-MM-DD string for date comparison with period boundaries.
 */
export function formatDate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Determines whether a lead falls within a given period based on the goal's
 * attribution settings and monthly cutoff logic.
 *
 * Logic:
 * 1. Determine attributed_date from the lead based on attribution_basis:
 *    - event_date: use event_date_end, fallback to event_date_start if end is null
 *    - closed_won_date: use closed_won_date
 * 2. Get effective cutoff for the attributed_date's month (per-month override or global)
 * 3. If day > cutoff, shift to next month's first day
 * 4. Return true if the (possibly shifted) date falls within [periodStart, periodEnd]
 */
export function attributeLeadToPeriodV2(
  lead: LeadAttributionInput,
  goal: Pick<GoalV2, 'attribution_basis' | 'monthly_cutoff_day' | 'per_month_cutoffs'>,
  periodStart: string,
  periodEnd: string
): boolean {
  // Step 1: Determine attributed date
  let dateStr: string | null = null

  if (goal.attribution_basis === 'event_date') {
    dateStr = lead.event_date_end ?? lead.event_date_start
  } else {
    dateStr = lead.closed_won_date
  }

  if (!dateStr) return false

  const attributed = new Date(dateStr)
  if (isNaN(attributed.getTime())) return false

  // Step 2: Get effective cutoff for this month
  const month = attributed.getMonth() + 1 // 1-12
  const day = attributed.getDate()
  const cutoff = getEffectiveCutoff(month, goal)

  // Step 3: If day > cutoff, shift to next month's first day
  let matchDate: string
  if (day > cutoff) {
    const shifted = new Date(attributed)
    shifted.setMonth(shifted.getMonth() + 1, 1) // first day of next month
    matchDate = formatDate(shifted)
  } else {
    matchDate = formatDate(attributed)
  }

  // Step 4: Check if matchDate falls within the period
  return matchDate >= periodStart && matchDate <= periodEnd
}
