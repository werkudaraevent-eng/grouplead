"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, ArrowDown, ArrowUp } from "lucide-react"

function formatIDR(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) return `Rp${(value / 1_000_000_000).toFixed(1)}B`
  if (Math.abs(value) >= 1_000_000) return `Rp${(value / 1_000_000).toFixed(1)}M`
  if (Math.abs(value) >= 1_000) return `Rp${(value / 1_000).toFixed(0)}K`
  return `Rp${value.toLocaleString("id-ID")}`
}

interface VarianceWidgetProps {
  attainment: number
  forecastRaw: number
  forecastWeighted: number
  target: number
  loading: boolean
}

export function VarianceWidget({ attainment, forecastRaw, forecastWeighted, target, loading }: VarianceWidgetProps) {
  const gapAttainment = target - attainment
  const gapWithForecast = target - (attainment + forecastWeighted)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Variance / Gap</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Gap to Target (Attainment only)</p>
              <div className="flex items-center gap-2">
                {gapAttainment > 0 ? (
                  <ArrowDown className="h-4 w-4 text-red-500" />
                ) : (
                  <ArrowUp className="h-4 w-4 text-emerald-500" />
                )}
                <span className={`text-lg font-bold ${gapAttainment > 0 ? "text-red-600" : "text-emerald-600"}`}>
                  {formatIDR(Math.abs(gapAttainment))}
                </span>
                <span className="text-xs text-muted-foreground">
                  {gapAttainment > 0 ? "below target" : "above target"}
                </span>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Gap to Target (Attainment + Forecast)</p>
              <div className="flex items-center gap-2">
                {gapWithForecast > 0 ? (
                  <ArrowDown className="h-4 w-4 text-amber-500" />
                ) : (
                  <ArrowUp className="h-4 w-4 text-emerald-500" />
                )}
                <span className={`text-lg font-bold ${gapWithForecast > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                  {formatIDR(Math.abs(gapWithForecast))}
                </span>
                <span className="text-xs text-muted-foreground">
                  {gapWithForecast > 0 ? "projected shortfall" : "projected surplus"}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
