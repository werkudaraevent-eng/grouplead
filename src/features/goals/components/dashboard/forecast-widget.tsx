"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Target } from "lucide-react"
import { useCurrency } from "@/contexts/currency-context"

interface ForecastWidgetProps {
  forecastWeighted: number
  loading: boolean
}

/**
 * Displays the weighted forecast value.
 * Stage weights are read from goal_settings_v2.stage_weights JSONB
 * and applied via calculateForecastV2 in use-goal-data.ts.
 */
export function ForecastWidget({ forecastWeighted, loading }: ForecastWidgetProps) {
  const { fmt } = useCurrency()
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Target className="h-4 w-4" />
          Weighted Forecast
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <>
            <div className="text-2xl font-bold tracking-tight">{fmt(forecastWeighted)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Stage-weighted pipeline forecast
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
