"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/utils/supabase/client"
import { useCompany } from "@/contexts/company-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Users } from "lucide-react"
import type { GoalUserTarget } from "@/types/goals"

function formatIDR(value: number): string {
  if (value >= 1_000_000_000) return `Rp${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `Rp${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `Rp${(value / 1_000).toFixed(0)}K`
  return `Rp${value.toLocaleString("id-ID")}`
}

interface SalesRow {
  userId: string
  userName: string
  target: number
  wonRevenue: number
  wonCount: number
}

interface SalesContributionWidgetProps {
  goalId: string | null
  loading: boolean
  onDrillDown: (label: string, filterType: string, filterValue: string) => void
}

export function SalesContributionWidget({ goalId, loading: parentLoading, onDrillDown }: SalesContributionWidgetProps) {
  const supabase = createClient()
  const { activeCompany } = useCompany()
  const [rows, setRows] = useState<SalesRow[]>([])
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async () => {
    if (!goalId || !activeCompany?.id) {
      setRows([])
      return
    }
    setLoading(true)

    const [targetsRes, leadsRes, profilesRes] = await Promise.all([
      supabase
        .from("goal_user_targets")
        .select("*")
        .eq("goal_id", goalId)
        .eq("company_id", activeCompany.id),
      supabase
        .from("leads")
        .select("id, actual_value, pic_sales_id, pipeline_stage:pipeline_stages!pipeline_stage_id(closed_status)")
        .eq("company_id", activeCompany.id),
      supabase.from("profiles").select("id, full_name"),
    ])

    const targets = (targetsRes.data as GoalUserTarget[]) ?? []
    const leads = (leadsRes.data ?? []) as Array<{
      id: number
      actual_value: number | null
      pic_sales_id: string | null
      pipeline_stage: { closed_status: string | null } | null
    }>
    const profiles = (profilesRes.data ?? []) as Array<{ id: string; full_name: string | null }>
    const profileMap = new Map(profiles.map((p) => [p.id, p.full_name ?? p.id]))

    // Aggregate won revenue per sales owner
    const wonByUser = new Map<string, { revenue: number; count: number }>()
    for (const lead of leads) {
      if (lead.pipeline_stage?.closed_status !== "won") continue
      if (!lead.pic_sales_id) continue
      const existing = wonByUser.get(lead.pic_sales_id) ?? { revenue: 0, count: 0 }
      wonByUser.set(lead.pic_sales_id, {
        revenue: existing.revenue + (lead.actual_value ?? 0),
        count: existing.count + 1,
      })
    }

    // Aggregate targets per user (sum across periods)
    const targetByUser = new Map<string, number>()
    for (const t of targets) {
      targetByUser.set(t.user_id, (targetByUser.get(t.user_id) ?? 0) + t.target_amount)
    }

    // Build rows — include users with targets or won revenue
    const userIds = new Set([...targetByUser.keys(), ...wonByUser.keys()])
    const salesRows: SalesRow[] = Array.from(userIds).map((userId) => ({
      userId,
      userName: profileMap.get(userId) ?? userId,
      target: targetByUser.get(userId) ?? 0,
      wonRevenue: wonByUser.get(userId)?.revenue ?? 0,
      wonCount: wonByUser.get(userId)?.count ?? 0,
    }))

    salesRows.sort((a, b) => b.wonRevenue - a.wonRevenue)
    setRows(salesRows.slice(0, 8))
    setLoading(false)
  }, [goalId, activeCompany?.id, supabase])

  useEffect(() => {
    loadData()
  }, [loadData])

  const isLoading = parentLoading || loading

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Users className="h-4 w-4" />
          Sales Contribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">No sales data.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => {
              const pct = row.target > 0 ? (row.wonRevenue / row.target) * 100 : 0
              return (
                <button
                  key={row.userId}
                  onClick={() => onDrillDown(row.userName, "sales", row.userId)}
                  className="w-full text-left hover:bg-slate-50 rounded p-1.5 -mx-1.5 transition-colors"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium truncate">{row.userName}</span>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span>{formatIDR(row.wonRevenue)}</span>
                      {row.target > 0 && (
                        <span className="text-[10px]">{pct.toFixed(0)}% of target</span>
                      )}
                      <span className="text-[10px]">{row.wonCount}W</span>
                    </div>
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
