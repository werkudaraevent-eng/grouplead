"use client"

import { AlertTriangle } from "lucide-react"
import { computeMonthlyTarget } from "@/features/goals/lib/target-calculator"
import type { GoalNodeTree, MonthlyWeights } from "@/types/goals"
import { useCurrency } from "@/contexts/currency-context"

const MONTH_COL_MIN = 100
const ROW_HEIGHT = 40
const HIERARCHY_COL_WIDTH = 280
const LEVEL_INDENT = 24

interface GoalUnallocatedRowProps {
  parentNode: GoalNodeTree
  months: number[]
  monthlyWeights: MonthlyWeights | null
  level: number
}

/**
 * Displays an unallocated/over-allocated warning row beneath a parent node's children.
 * Amber for under-allocated, red for over-allocated.
 * Shows gap amount per month column.
 */
export function GoalUnallocatedRow({
  parentNode, months, monthlyWeights, level,
}: GoalUnallocatedRowProps) {
  const { fmt } = useCurrency()
  // Compute gap per month
  const gaps: Record<number, number> = {}
  let hasGap = false

  for (const m of months) {
    const parentMonthly = computeMonthlyTarget(
      parentNode.target_amount, monthlyWeights, m, parentNode.monthly_targets
    )
    let childrenSum = 0
    for (const child of parentNode.children) {
      childrenSum += computeMonthlyTarget(
        child.target_amount, monthlyWeights, m, child.monthly_targets
      )
    }
    const gap = parentMonthly - childrenSum
    gaps[m] = gap
    if (Math.abs(gap) > 0.01) hasGap = true
  }

  if (!hasGap) return null

  // Determine overall status
  const totalGap = Object.values(gaps).reduce((a, b) => a + b, 0)
  const isOverAllocated = totalGap < -0.01
  const bgClass = isOverAllocated ? "bg-red-50" : "bg-amber-50"
  const textClass = isOverAllocated ? "text-red-600" : "text-amber-600"
  const label = isOverAllocated ? "Over-allocated" : "Unallocated"

  return (
    <tr className={`${bgClass} border-b border-slate-100`}>
      <td
        className={`sticky left-0 z-10 ${bgClass} border-r px-2`}
        style={{ width: HIERARCHY_COL_WIDTH, minWidth: HIERARCHY_COL_WIDTH, height: ROW_HEIGHT }}
      >
        <div
          className={`flex items-center gap-1.5 italic ${textClass}`}
          style={{ paddingLeft: 14 + level * LEVEL_INDENT }}
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="text-xs">{label}</span>
        </div>
      </td>
      {months.map((m) => {
        const gap = gaps[m]
        if (Math.abs(gap) < 0.01) {
          return <td key={m} className="px-2 py-1" style={{ minWidth: MONTH_COL_MIN }} />
        }
        return (
          <td
            key={m}
            className={`px-2 py-1 text-right ${textClass}`}
            style={{ minWidth: MONTH_COL_MIN }}
          >
            <span className="text-xs italic tabular-nums">
              {gap > 0 ? "+" : "-"}{fmt(Math.round(Math.abs(gap)))}
            </span>
          </td>
        )
      })}
      {/* Q1-Q4 + YTD empty columns */}
      {Array.from({ length: 5 }).map((_, i) => (
        <td key={`gap-${i}`} className={`px-2 py-1 text-right ${bgClass} border-l`} style={{ minWidth: MONTH_COL_MIN }} />
      ))}
    </tr>
  )
}
