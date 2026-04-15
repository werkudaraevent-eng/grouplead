"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, TrendingUp } from "lucide-react"

function formatIDR(value: number): string {
  if (value >= 1_000_000_000) return `Rp${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `Rp${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `Rp${(value / 1_000).toFixed(0)}K`
  return `Rp${value.toLocaleString("id-ID")}`
}

interface AttainmentSummaryWidgetProps {
  attainment: number
  target: number
  loading: boolean
}

export function AttainmentSummaryWidget({ attainment, target, loading }: AttainmentSummaryWidgetProps) {
  const pct = target > 0 ? (attainment / target) * 100 : 0
  const barWidth = Math.min(pct, 100)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Attainment
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <>
            <div className="text-2xl font-bold tracking-tight">{formatIDR(attainment)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {pct.toFixed(1)}% of {formatIDR(target)} target
            </p>
            <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${barWidth}%` }}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
