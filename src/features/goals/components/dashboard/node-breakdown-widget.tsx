"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/utils/supabase/client"
import { useCompany } from "@/contexts/company-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, GitBranch, ChevronDown, ChevronRight } from "lucide-react"
import { buildAncestorPath, matchLeadToNode } from "@/features/goals/lib/node-attribution"
import { computeMonthlyTarget } from "@/features/goals/lib/target-calculator"
import type { GoalNode, GoalNodeTree, GoalSegment, MonthlyWeights } from "@/types/goals"
import { useCurrency } from "@/contexts/currency-context"

function buildTree(nodes: GoalNode[]): GoalNodeTree[] {
  const map = new Map<string, GoalNodeTree>()
  const roots: GoalNodeTree[] = []
  for (const n of nodes) map.set(n.id, { ...n, children: [] })
  for (const n of nodes) {
    const tree = map.get(n.id)!
    if (n.parent_node_id && map.has(n.parent_node_id)) {
      map.get(n.parent_node_id)!.children.push(tree)
    } else {
      roots.push(tree)
    }
  }
  const sortChildren = (items: GoalNodeTree[]) => {
    items.sort((a, b) => a.sort_order - b.sort_order)
    for (const item of items) sortChildren(item.children)
  }
  sortChildren(roots)
  return roots
}

interface NodeRowProps {
  node: GoalNodeTree
  depth: number
  expanded: Set<string>
  onToggle: (id: string) => void
  onDrillDown: (label: string, filterType: string, filterValue: string) => void
  fmt: (amount: number) => string
}

function NodeRow({ node, depth, expanded, onToggle, onDrillDown, fmt }: NodeRowProps) {
  const isExpanded = expanded.has(node.id)
  const hasChildren = node.children.length > 0
  const target = node.target_amount
  const attainment = node.attainment ?? 0
  const pct = target > 0 ? (attainment / target) * 100 : 0

  return (
    <>
      <div
        className="flex items-center gap-1.5 py-1.5 px-1 -mx-1 rounded hover:bg-slate-50 transition-colors cursor-pointer"
        style={{ paddingLeft: depth * 16 }}
        onClick={() => onDrillDown(node.name, node.reference_field, node.reference_value)}
      >
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(node.id) }}
            className="p-0.5 rounded hover:bg-muted shrink-0"
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <span className="text-xs font-medium truncate flex-1">{node.name}</span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground">{fmt(attainment)}</span>
          <span className="text-[10px] text-muted-foreground w-10 text-right">
            {pct.toFixed(0)}%
          </span>
        </div>
      </div>
      <div className="ml-1 h-1 rounded-full bg-slate-100 overflow-hidden" style={{ marginLeft: depth * 16 + 20 }}>
        <div
          className="h-full rounded-full bg-blue-500 transition-all"
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      {isExpanded && hasChildren && node.children.map((child) => (
        <NodeRow
          key={child.id}
          node={child}
          depth={depth + 1}
          expanded={expanded}
          onToggle={onToggle}
          onDrillDown={onDrillDown}
          fmt={fmt}
        />
      ))}
    </>
  )
}

interface NodeBreakdownWidgetProps {
  goalId: string | null
  loading: boolean
  periodStart?: string | null
  periodEnd?: string | null
  onDrillDown: (label: string, filterType: string, filterValue: string) => void
}

export function NodeBreakdownWidget({
  goalId, loading: parentLoading, periodStart, periodEnd, onDrillDown,
}: NodeBreakdownWidgetProps) {
  const supabase = createClient()
  const { activeCompany } = useCompany()
  const { fmt } = useCurrency()
  const [tree, setTree] = useState<GoalNodeTree[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const loadData = useCallback(async () => {
    if (!goalId || !activeCompany?.id) { setTree([]); return }
    setLoading(true)

    const [nodesRes, leadsRes, segmentsRes] = await Promise.all([
      supabase.from("goal_nodes").select("*").eq("goal_id", goalId).order("sort_order"),
      supabase.from("leads").select(
        "id, actual_value, estimated_value, company_id, pic_sales_id, client_company_id, client_company:client_companies!client_company_id(id, name, line_industry), pipeline_stage:pipeline_stages!pipeline_stage_id(closed_status), category, lead_source, main_stream, grade_lead, stream_type, business_purpose, tipe, nationality, sector, area, referral_source, event_format, event_date_start, event_date_end, closed_won_date"
      ).eq("company_id", activeCompany.id),
      supabase.from("goal_segments").select("*").eq("company_id", activeCompany.id),
    ])

    const allNodes = (nodesRes.data as GoalNode[]) ?? []
    const leads = ((leadsRes.data ?? []) as unknown) as Array<Record<string, unknown>>
    const segments = (segmentsRes.data as GoalSegment[]) ?? []

    const builtTree = buildTree(allNodes)

    // Compute attainment per node
    const computeAttainment = (node: GoalNodeTree) => {
      const path = buildAncestorPath(node.id, allNodes)
      let attainment = 0
      for (const lead of leads) {
        const stage = lead.pipeline_stage as { closed_status: string | null } | null
        if (stage?.closed_status !== "won") continue
        const cc = lead.client_company as Record<string, unknown> | null
        if (matchLeadToNode(lead, path, segments, cc)) {
          attainment += (lead.actual_value as number) ?? 0
        }
      }
      node.attainment = attainment
      for (const child of node.children) computeAttainment(child)
    }

    for (const root of builtTree) computeAttainment(root)
    setTree(builtTree)
    setLoading(false)
  }, [goalId, activeCompany?.id, supabase, periodStart, periodEnd])

  useEffect(() => { loadData() }, [loadData])

  const handleToggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const isLoading = parentLoading || loading

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <GitBranch className="h-4 w-4" />
          Goal Node Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : tree.length === 0 ? (
          <p className="text-xs text-muted-foreground">No node breakdown data.</p>
        ) : (
          <div className="space-y-0.5">
            {tree.map((root) => (
              <NodeRow
                key={root.id}
                node={root}
                depth={0}
                expanded={expanded}
                onToggle={handleToggle}
                onDrillDown={onDrillDown}
                fmt={fmt}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
