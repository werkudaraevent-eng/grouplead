import type { GoalNode, MonthlyTargets } from '@/types/goals'

/**
 * Recalculates child targets when a parent's target_amount changes.
 * - Percentage-mode children: target_amount = parentTarget × (percentage / 100)
 * - Absolute-mode children: percentage = (target_amount / parentTarget) × 100
 * Division by zero (parentTarget = 0) → percentage = 0.
 */
export function cascadeRecalculate(
  parentTarget: number,
  children: GoalNode[]
): { id: string; target_amount: number; percentage: number | null }[] {
  return children.map((child) => {
    if (child.allocation_mode === 'percentage') {
      const pct = child.percentage ?? 0
      return {
        id: child.id,
        target_amount: parentTarget * (pct / 100),
        percentage: pct,
      }
    }
    // absolute mode
    const percentage = parentTarget === 0 ? 0 : (child.target_amount / parentTarget) * 100
    return {
      id: child.id,
      target_amount: child.target_amount,
      percentage,
    }
  })
}

/**
 * Cascades a per-month cell edit to children for a specific month.
 * - Percentage-mode children: monthly_targets[month] = parentMonthlyTarget × (child.percentage / 100)
 * - Absolute-mode children: unchanged.
 */
export function cascadeMonthlyTarget(
  parentMonthlyTarget: number,
  month: number,
  children: GoalNode[]
): { id: string; monthly_targets: MonthlyTargets }[] {
  return children.map((child) => {
    const existing: MonthlyTargets = child.monthly_targets ? { ...child.monthly_targets } : {}

    if (child.allocation_mode === 'percentage') {
      const pct = child.percentage ?? 0
      existing[String(month)] = parentMonthlyTarget * (pct / 100)
    }
    // absolute-mode children keep their existing monthly_targets unchanged

    return { id: child.id, monthly_targets: existing }
  })
}

/**
 * Validates that the sum of root-level node targets does not exceed
 * the goal's target_amount. Returns a warning if it does.
 */
export function validateRootNodeSum(
  goalTarget: number,
  rootNodes: Pick<GoalNode, 'target_amount'>[]
): { valid: boolean; warning?: string } {
  const sum = rootNodes.reduce((acc, n) => acc + n.target_amount, 0)
  if (sum > goalTarget) {
    return {
      valid: false,
      warning: `Sum of root node targets (${sum}) exceeds goal target (${goalTarget})`,
    }
  }
  return { valid: true }
}
