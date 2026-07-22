"use client"

import { useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { computeMonthlyTarget } from "@/features/goals/lib/target-calculator"
import type { GoalNodeTree, MonthlyWeights } from "@/types/goals"

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

interface GoalExportCsvProps {
  tree: GoalNodeTree[]
  months: number[]
  year: number
  monthlyWeights: MonthlyWeights | null
  goalName: string
}

/**
 * Export current matrix view as CSV with hierarchy indentation.
 */
export function GoalExportCsv({ tree, months, year, monthlyWeights, goalName }: GoalExportCsvProps) {
  const handleExport = useCallback(() => {
    const rows: string[][] = []

    // Header row
    const header = ["Hierarchy"]
    for (const m of months) header.push(`${MONTH_LABELS[m - 1]} ${year}`)
    header.push("Q Total", "YTD Total")
    rows.push(header)

    // Walk tree recursively
    const walkTree = (nodes: GoalNodeTree[], depth: number) => {
      for (const node of nodes) {
        const indent = "  ".repeat(depth)
        const row: string[] = [`${indent}${node.name}`]

        let ytd = 0
        let qTotal = 0
        for (const m of months) {
          const val = computeMonthlyTarget(
            node.target_amount, monthlyWeights, m, node.monthly_targets
          )
          row.push(String(Math.round(val)))
          ytd += val
          qTotal += val
        }
        row.push(String(Math.round(qTotal)))
        row.push(String(Math.round(ytd)))
        rows.push(row)

        if (node.children.length > 0) {
          walkTree(node.children, depth + 1)
        }
      }
    }

    walkTree(tree, 0)

    // Convert to CSV string
    const csvContent = rows
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n")

    // Download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${goalName.replace(/[^a-zA-Z0-9]/g, "_")}_matrix_${year}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }, [tree, months, year, monthlyWeights, goalName])

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 text-xs gap-1.5"
      onClick={handleExport}
      disabled={tree.length === 0}
    >
      <Download className="h-3.5 w-3.5" />
      Export View
    </Button>
  )
}
