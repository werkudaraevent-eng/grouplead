"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/utils/supabase/client"
import { useCompany } from "@/contexts/company-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, PieChart } from "lucide-react"
import { classifyLeadBySegment } from "@/features/goals/lib/classification-engine"
import type { GoalSegment } from "@/types/goals"

function formatIDR(value: number): string {
  if (value >= 1_000_000_000) return `Rp${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `Rp${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `Rp${(value / 1_000).toFixed(0)}K`
  return `Rp${value.toLocaleString("id-ID")}`
}

const COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-purple-500",
  "bg-rose-500", "bg-cyan-500", "bg-orange-500", "bg-indigo-500",
]

interface SegmentRow {
  name: string
  wonRevenue: number
}

interface SegmentBreakdownWidgetProps {
  goalId: string | null
  loading: boolean
  onDrillDown: (label: string, filterType: string, filterValue: string) => void
}

export function SegmentBreakdownWidget({ goalId, loading: parentLoading, onDrillDown }: SegmentBreakdownWidgetProps) {
  const supabase = createClient()
  const { activeCompany } = useCompany()
  const [rows, setRows] = useState<SegmentRow[]>([])
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async () => {
    if (!activeCompany?.id) {
      setRows([])
      return
    }
    setLoading(true)

    const [segmentsRes, leadsRes] = await Promise.all([
      supabase.from("goal_segments").select("*").eq("company_id", activeCompany.id),
      supabase
        .from("leads")
        .select("id, actual_value, pipeline_stage:pipeline_stages!pipeline_stage_id(closed_status), category, lead_source, main_stream, grade_lead, stream_type, business_purpose, tipe, nationality, sector, area, referral_source, event_format")
        .eq("company_id", activeCompany.id),
    ])

    const segments = (segmentsRes.data as GoalSegment[]) ?? []
    const leads = (leadsRes.data ?? []) as Array<{
      id: number
      actual_value: number | null
      pipeline_stage: { closed_status: string | null } | null
      [key: string]: unknown
    }>

    if (segments.length === 0) {
      setRows([])
      setLoading(false)
      return
    }

    // Use the first segment for breakdown display
    const primarySegment = segments[0]
    const segmentTotals = new Map<string, number>()

    for (const lead of leads) {
      const isWon = lead.pipeline_stage?.closed_status === "won"
      if (!isWon) continue

      const rawValue = lead[primarySegment.source_field] as string | null
      const segName = classifyLeadBySegment(rawValue, primarySegment)

      segmentTotals.set(segName, (segmentTotals.get(segName) ?? 0) + (lead.actual_value ?? 0))
    }

    const segRows: SegmentRow[] = Array.from(segmentTotals.entries())
      .map(([name, wonRevenue]) => ({ name, wonRevenue }))
      .sort((a, b) => b.wonRevenue - a.wonRevenue)
      .slice(0, 8)

    setRows(segRows)
    setLoading(false)
  }, [activeCompany?.id, supabase])

  useEffect(() => {
    loadData()
  }, [loadData])

  const isLoading = parentLoading || loading
  const totalAttainment = rows.reduce((s, r) => s + r.wonRevenue, 0)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <PieChart className="h-4 w-4" />
          By Segment
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">No segment data.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((row, i) => {
              const share = totalAttainment > 0 ? (row.wonRevenue / totalAttainment) * 100 : 0
              return (
                <button
                  key={row.name}
                  onClick={() => onDrillDown(row.name, "segment", row.name)}
                  className="w-full text-left hover:bg-slate-50 rounded p-1.5 -mx-1.5 transition-colors"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${COLORS[i % COLORS.length]}`} />
                      <span className="font-medium truncate">{row.name}</span>
                    </div>
                    <span className="text-muted-foreground">
                      {formatIDR(row.wonRevenue)} ({share.toFixed(0)}%)
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
