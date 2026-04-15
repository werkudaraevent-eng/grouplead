"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Layers } from "lucide-react"

function formatIDR(value: number): string {
  if (value >= 1_000_000_000) return `Rp${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `Rp${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `Rp${(value / 1_000).toFixed(0)}K`
  return `Rp${value.toLocaleString("id-ID")}`
}

interface PipelineWidgetProps {
  forecastRaw: number
  loading: boolean
}

export function PipelineWidget({ forecastRaw, loading }: PipelineWidgetProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Layers className="h-4 w-4" />
          Raw Pipeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <>
            <div className="text-2xl font-bold tracking-tight">{formatIDR(forecastRaw)}</div>
            <p className="text-xs text-muted-foreground mt-1">Open pipeline value</p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
