import type { MonthlyWeights, MonthlyTargets } from '@/types/goals'

/**
 * Computes a node's target for a specific month.
 * Priority: monthlyTargets[month] → nodeTarget × monthlyWeights[month] → nodeTarget / 12.
 */
export function computeMonthlyTarget(
  nodeTarget: number,
  monthlyWeights: MonthlyWeights | null,
  month: number,
  monthlyTargets?: MonthlyTargets | null
): number {
  const key = String(month)

  // 1. Per-node override takes precedence
  if (monthlyTargets && key in monthlyTargets) {
    return monthlyTargets[key]
  }

  // 2. Goal-level monthly weights
  if (monthlyWeights && key in monthlyWeights) {
    return nodeTarget * monthlyWeights[key]
  }

  // 3. Equal distribution default
  return nodeTarget / 12
}

/**
 * Returns the number of days in a given month (1-indexed).
 */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/**
 * Computes a node's target for a date range by summing applicable monthly values.
 * Full months use their full value; partial months are pro-rated by day fraction.
 * Returns 0 if start > end.
 */
export function computePeriodTarget(
  nodeTarget: number,
  monthlyWeights: MonthlyWeights | null,
  periodStart: string,
  periodEnd: string,
  monthlyTargets?: MonthlyTargets | null
): number {
  if (periodStart > periodEnd) return 0

  const start = new Date(periodStart)
  const end = new Date(periodEnd)

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0

  let total = 0

  // Walk month by month from start to end
  let year = start.getFullYear()
  let month = start.getMonth() + 1 // 1-indexed

  const endYear = end.getFullYear()
  const endMonth = end.getMonth() + 1

  while (year < endYear || (year === endYear && month <= endMonth)) {
    const totalDays = daysInMonth(year, month)
    const monthlyValue = computeMonthlyTarget(nodeTarget, monthlyWeights, month, monthlyTargets)

    // Determine the fraction of this month within the period
    let dayStart = 1
    let dayEnd = totalDays

    if (year === start.getFullYear() && month === start.getMonth() + 1) {
      dayStart = start.getDate()
    }
    if (year === end.getFullYear() && month === end.getMonth() + 1) {
      dayEnd = end.getDate()
    }

    const fraction = (dayEnd - dayStart + 1) / totalDays
    total += monthlyValue * fraction

    // Advance to next month
    month++
    if (month > 12) {
      month = 1
      year++
    }
  }

  return total
}

/**
 * Validates monthly weights: all 12 months present, non-negative, sum to 1.0 within 0.001 tolerance.
 */
export function validateMonthlyWeights(
  weights: MonthlyWeights
): { valid: boolean; error?: string } {
  for (let m = 1; m <= 12; m++) {
    const key = String(m)
    if (!(key in weights)) {
      return { valid: false, error: `Missing weight for month ${m}` }
    }
    if (weights[key] < 0) {
      return { valid: false, error: `Weight for month ${m} must be non-negative` }
    }
  }

  const sum = Object.values(weights).reduce((a, b) => a + b, 0)
  if (Math.abs(sum - 1.0) > 0.001) {
    return { valid: false, error: `Monthly weights must sum to 1.0 (currently: ${sum})` }
  }

  return { valid: true }
}

/**
 * Validates per-node monthly targets: warns if sum ≠ nodeTargetAmount.
 * Does NOT block — returns warning only. Empty object = valid (no override).
 */
export function validateMonthlyTargets(
  monthlyTargets: MonthlyTargets,
  nodeTargetAmount: number
): { valid: boolean; warning?: string } {
  const keys = Object.keys(monthlyTargets)
  if (keys.length === 0) return { valid: true }

  const sum = Object.values(monthlyTargets).reduce((a, b) => a + b, 0)
  if (Math.abs(sum - nodeTargetAmount) > 0.01) {
    return {
      valid: true,
      warning: `Sum of monthly targets (${sum}) does not equal node target amount (${nodeTargetAmount})`,
    }
  }

  return { valid: true }
}
