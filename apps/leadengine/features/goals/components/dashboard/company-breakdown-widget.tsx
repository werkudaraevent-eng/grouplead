"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/utils/supabase/client"
import { useCompany } from "@/contexts/company-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Building2 } from "lucide-react"
import type { GoalNode } from "@/types/goals"
import { useCurrency } from "@/contexts/currency-context"

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
  const { fmt } = useCurrency()
  const [rows, setRows] = useState<BreakdownRow[]>([])
  const [loading, setLoading] = useState(false)

  const loadBreakdown = useCallback(async () => {
    if (!goalId || !activeCompany?.id) { setRows([]); return }
    setLoading(true)

    // Fetch goal_nodes where reference_field = 'company_id'
    const [nodesRes, leadsRes] = await Promise.all([
      supabase
        .from("goal_nodes")
        .select("*")
        .eq("goal_id", goalId)
        .eq("reference_field", "company_id"),
      supabase
        .from("leads")
        .select("id, actual_value, company_id, pipeline_stage:pipeline_stages!pipeline_stage_id(closed_status)")
        .eq("company_id", activeCompany.id),
    ])

    const nodes = (nodesRes.data as GoalNode[]) ?? []
    const leads = ((leadsRes.data ?? []) as unknown) as Array<{
      id: number; actual_value: number | null; company_id: string
      pipeline_stage: { closed_status: string | null } | null
    }>

    // Aggregate won revenue per company_id (reference_value)
    const wonByCompany = new Map<string, number>()
    for (const lead of leads) {
      if (lead.pipeline_stage?.closed_status !== "won") continue
      wonByCompany.set(lead.company_id, (wonByCompany.get(lead.company_id) ?? 0) + (lead.actual_value ?? 0))
    }

    const breakdownRows: BreakdownRow[] = nodes
      .map((n) => ({
        id: n.id,
        name: n.name,
        wonRevenue: wonByCompany.get(n.reference_value) ?? 0,
        target: n.target_amount,
      }))
      .sort((a, b) => b.wonRevenue - a.wonRevenue)
      .slice(0, 8)

    setRows(breakdownRows)
    setLoading(false)
  }, [goalId, activeCompany?.id, supabase])

  useEffect(() => { loadBreakdown() }, [loadBreakdown])

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
                    <span className="text-muted-foreground">{fmt(row.wonRevenue)}</span>
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
