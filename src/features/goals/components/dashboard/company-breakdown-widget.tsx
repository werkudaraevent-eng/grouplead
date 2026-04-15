"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/utils/supabase/client"
import { useCompany } from "@/contexts/company-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Building2 } from "lucide-react"
import { rollUpFromBreakdownConfig } from "@/features/goals/lib/rollup-engine"
import type { GoalV2, GoalSegment, BreakdownTargets } from "@/types/goals"
import type { LeadRow } from "@/features/goals/lib/breakdown-utils"

function formatIDR(value: number): string {
  if (value >= 1_000_000_000) return `Rp${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `Rp${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `Rp${(value / 1_000).toFixed(0)}K`
  return `Rp${value.toLocaleString("id-ID")}`
}

const LEAD_SELECT = `
  id, company_id, actual_value, estimated_value,
  pipeline_stage:pipeline_stages!pipeline_stage_id (stage_type, closed_status),
  client_company_id, client_company:client_companies!client_company_id (id, name, line_industry),
  pic_sales_id, pic_sales_profile:profiles!pic_sales_id (id, full_name),
  category, lead_source, main_stream, grade_lead, stream_type,
  business_purpose, tipe, nationality, sector, area, referral_source, event_format
`.trim()

interface BreakdownRow {
  id: string
  name: string
  wonRevenue: number
  target: number
}

interface CompanyBreakdownWidgetProps {
  goalId: string | null
  loading: boolean
  onDrillDown: (label: string, filterType: string, filterValue: string) => void
}

export function CompanyBreakdownWidget({ goalId, loading: parentLoading, onDrillDown }: CompanyBreakdownWidgetProps) {
  const supabase = createClient()
  const { activeCompany } = useCompany()
  const [rows, setRows] = useState<BreakdownRow[]>([])
  const [loading, setLoading] = useState(false)

  const loadBreakdown = useCallback(async () => {
    if (!goalId || !activeCompany?.id) {
      setRows([])
      return
    }
    setLoading(true)

    const [goalRes, segmentsRes, leadsRes] = await Promise.all([
      supabase.from("goals_v2").select("*").eq("id", goalId).single(),
      supabase.from("goal_segments").select("*").eq("company_id", activeCompany.id),
      supabase.from("leads").select(LEAD_SELECT).eq("company_id", activeCompany.id),
    ])

    const goal = goalRes.data as GoalV2 | null
    const segments = (segmentsRes.data as GoalSegment[]) ?? []
    const leads = (leadsRes.data as unknown as LeadRow[]) ?? []

    if (!goal || goal.breakdown_config.length === 0) {
      setRows([])
      setLoading(false)
      return
    }

    const tree = rollUpFromBreakdownConfig(
      leads,
      goal.breakdown_config,
      segments,
      (goal.breakdown_targets as BreakdownTargets) ?? {},
      new Map()
    )

    const topRows: BreakdownRow[] = (tree.children ?? [])
      .sort((a, b) => b.wonRevenue - a.wonRevenue)
      .slice(0, 8)
      .map((n) => ({ id: n.id, name: n.name, wonRevenue: n.wonRevenue, target: n.target }))

    setRows(topRows)
    setLoading(false)
  }, [goalId, activeCompany?.id, supabase])

  useEffect(() => {
    loadBreakdown()
  }, [loadBreakdown])

  const isLoading = parentLoading || loading

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          By Company
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">No breakdown data.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => {
              const pct = row.target > 0 ? (row.wonRevenue / row.target) * 100 : 0
              return (
                <button
                  key={row.id}
                  onClick={() => onDrillDown(row.name, "company", row.id)}
                  className="w-full text-left hover:bg-slate-50 rounded p-1.5 -mx-1.5 transition-colors"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium truncate">{row.name}</span>
                    <span className="text-muted-foreground">{formatIDR(row.wonRevenue)}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
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
