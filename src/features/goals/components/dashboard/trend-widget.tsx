"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/utils/supabase/client"
import { useCompany } from "@/contexts/company-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { calculateAttainmentV2 } from "@/features/goals/lib/attainment-calculator"
import type { GoalV2, LeadAttainmentInput } from "@/types/goals"

function formatIDR(value: number): string {
  if (value >= 1_000_000_000) return `Rp${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `Rp${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `Rp${(value / 1_000).toFixed(0)}K`
  return `Rp${value.toLocaleString("id-ID")}`
}

interface TrendEntry {
  label: string
  attainment: number
  target: number
}

interface TrendWidgetProps {
  goalId: string | null
}

/**
 * Shows monthly attainment trend for the selected goal.
 * Groups Closed Won leads by month using event_date_end.
 */
export function TrendWidget({ goalId }: TrendWidgetProps) {
  const supabase = createClient()
  const { activeCompany } = useCompany()
  const [entries, setEntries] = useState<TrendEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTrend = useCallback(async () => {
    if (!goalId || !activeCompany?.id) {
      setEntries([])
      setLoading(false)
      return
    }
    setLoading(true)

    const [goalRes, leadsRes] = await Promise.all([
      supabase.from("goals_v2").select("target_amount, attribution_basis, monthly_cutoff_day").eq("id", goalId).single(),
      supabase
        .from("leads")
        .select("id, actual_value, event_date_end, event_date_start, closed_won_date, pipeline_stage:pipeline_stages!pipeline_stage_id(closed_status)")
        .eq("company_id", activeCompany.id)
        .order("event_date_end", { ascending: true }),
    ])

    const goal = goalRes.data as Pick<GoalV2, "target_amount" | "attribution_basis" | "monthly_cutoff_day"> | null
    const leads = (leadsRes.data ?? []) as Array<{
      id: number
      actual_value: number | null
      event_date_end: string | null
      event_date_start: string | null
      closed_won_date: string | null
      pipeline_stage: { closed_status: string | null } | null
    }>

    if (!goal) {
      setEntries([])
      setLoading(false)
      return
    }

    // Group Closed Won leads by month (last 12 months)
    const monthMap = new Map<string, LeadAttainmentInput[]>()
    const now = new Date()

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      monthMap.set(key, [])
    }

    for (const lead of leads) {
      const dateStr =
        goal.attribution_basis === "closed_won_date"
          ? lead.closed_won_date
          : (lead.event_date_end ?? lead.event_date_start)
      if (!dateStr) continue

      const d = new Date(dateStr)
      if (isNaN(d.getTime())) continue

      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      if (!monthMap.has(key)) continue

      monthMap.get(key)!.push({
        id: lead.id,
        actual_value: lead.actual_value,
        is_closed_won: lead.pipeline_stage?.closed_status === "won",
      })
    }

    const trendData: TrendEntry[] = Array.from(monthMap.entries()).map(([key, monthLeads]) => {
      const [year, month] = key.split("-")
      const label = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("id-ID", {
        month: "short",
        year: "2-digit",
      })
      const { total } = calculateAttainmentV2(monthLeads)
      return { label, attainment: total, target: goal.target_amount / 12 }
    })

    setEntries(trendData)
    setLoading(false)
  }, [goalId, activeCompany?.id, supabase])

  useEffect(() => {
    fetchTrend()
  }, [fetchTrend])

  const maxVal = Math.max(...entries.map((e) => Math.max(e.attainment, e.target, 1)), 1)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Historical Trend
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : entries.length === 0 ? (
          <p className="text-xs text-muted-foreground">No trend data available.</p>
        ) : (
          <div className="flex items-end gap-2 h-32">
            {entries.map((entry, i) => {
              const attH = (entry.attainment / maxVal) * 100
              const tgtH = (entry.target / maxVal) * 100
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="relative w-full flex items-end justify-center gap-0.5 h-24">
                    <div
                      className="w-3 bg-emerald-500 rounded-t transition-all"
                      style={{ height: `${attH}%` }}
                      title={`Attainment: ${formatIDR(entry.attainment)}`}
                    />
                    <div
                      className="w-3 bg-slate-300 rounded-t transition-all"
                      style={{ height: `${tgtH}%` }}
                      title={`Target: ${formatIDR(entry.target)}`}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{entry.label}</span>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
