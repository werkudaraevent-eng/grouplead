"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, AlertTriangle } from "lucide-react"

function formatIDR(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) return `Rp${(value / 1_000_000_000).toFixed(1)}B`
  if (Math.abs(value) >= 1_000_000) return `Rp${(value / 1_000_000).toFixed(1)}M`
  if (Math.abs(value) >= 1_000) return `Rp${(value / 1_000).toFixed(0)}K`
  return `Rp${value.toLocaleString("id-ID")}`
}

interface ExceptionListWidgetProps {
  attainment: number
  target: number
  loading: boolean
  onDrillDown: (label: string, filterType: string, filterValue: string) => void
}

/**
 * Shows a summary exception when overall attainment is below 50% of target.
 * For per-breakdown exceptions, see company-breakdown-widget and segment-breakdown-widget.
 */
export function ExceptionListWidget({ attainment, target, loading, onDrillDown }: ExceptionListWidgetProps) {
  const pct = target > 0 ? (attainment / target) * 100 : 0
  const gap = target - attainment
  const isBelowThreshold = target > 0 && pct < 50

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Exceptions &amp; Gaps
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : !isBelowThreshold ? (
          <p className="text-xs text-muted-foreground">
            No notable exceptions — goal attainment is on track ({pct.toFixed(0)}% of target).
          </p>
        ) : (
          <button
            onClick={() => onDrillDown("Overall Goal", "goal", "overall")}
            className="w-full text-left hover:bg-red-50 rounded p-2 -mx-1 transition-colors border border-red-100"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">Overall Goal</span>
              <span className="text-red-600 font-medium">-{formatIDR(gap)}</span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-0.5">
              <span>{pct.toFixed(0)}% of target</span>
              <span>Target: {formatIDR(target)}</span>
            </div>
          </button>
        )}
      </CardContent>
    </Card>
  )
}
