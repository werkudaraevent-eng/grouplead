"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/utils/supabase/client"
import { useCompany } from "@/contexts/company-context"
import { calculateAttainmentV2 } from "@/features/goals/lib/attainment-calculator"
import { calculateForecastV2 } from "@/features/goals/lib/forecast-calculator"
import { attributeLeadToPeriodV2 } from "@/features/goals/lib/attribution-engine"
import { buildAncestorPath, matchLeadToNode } from "@/features/goals/lib/node-attribution"
import { computeMonthlyTarget } from "@/features/goals/lib/target-calculator"
import type {
  GoalV2,
  GoalSettingsV2,
  GoalNode,
  GoalNodeTree,
  GoalSegment,
  LeadAttainmentInput,
  LeadForecastInput,
  StageWeightsMap,
  MonthlyWeights,
} from "@/types/goals"

export interface NodeAttainmentData {
  nodeId: string
  attainment: number
  forecastRaw: number
  forecastWeighted: number
}

export interface GoalData {
  attainment: number
  forecastRaw: number
  forecastWeighted: number
  target: number
  loading: boolean
  goal: GoalV2 | null
  nodeTree: GoalNodeTree[]
  nodeAttainment: Map<string, NodeAttainmentData>
}

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

/**
 * Fetches goal data for the active company using the V2 schema.
 * Accepts an optional goalId; if not provided, uses the first active goal.
 * Accepts optional period boundaries (periodStart/periodEnd as YYYY-MM-DD strings).
 * Fetches goal_nodes and computes per-node attainment/forecast.
 */
export function useGoalData(options?: {
  goalId?: string | null
  periodStart?: string | null
  periodEnd?: string | null
}) {
  const { activeCompany } = useCompany()
  const [data, setData] = useState<GoalData>({
    attainment: 0,
    forecastRaw: 0,
    forecastWeighted: 0,
    target: 0,
    loading: true,
    goal: null,
    nodeTree: [],
    nodeAttainment: new Map(),
  })

  const goalId = options?.goalId
  const periodStart = options?.periodStart
  const periodEnd = options?.periodEnd

  const fetchData = useCallback(async () => {
    if (!activeCompany?.id) {
      setData((prev) => ({ ...prev, loading: false }))
      return
    }

    setData((prev) => ({ ...prev, loading: true }))
    const supabase = createClient()

    // Fetch goal
    let goalQuery = supabase
      .from("goals_v2")
      .select("*")
      .eq("company_id", activeCompany.id)
      .eq("is_active", true)

    if (goalId) {
      goalQuery = goalQuery.eq("id", goalId)
    } else {
      goalQuery = goalQuery.order("created_at", { ascending: false }).limit(1)
    }

    const { data: goalRows } = await goalQuery
    const goal = (goalRows?.[0] as GoalV2) ?? null

    if (!goal) {
      setData({
        attainment: 0, forecastRaw: 0, forecastWeighted: 0, target: 0,
        loading: false, goal: null, nodeTree: [], nodeAttainment: new Map(),
      })
      return
    }

    // Fetch settings, nodes, segments, leads in parallel
    const [settingsRes, nodesRes, segmentsRes, leadsRes] = await Promise.all([
      supabase
        .from("goal_settings_v2")
        .select("stage_weights")
        .eq("company_id", activeCompany.id)
        .maybeSingle(),
      supabase
        .from("goal_nodes")
        .select("*")
        .eq("goal_id", goal.id)
        .order("sort_order"),
      supabase
        .from("goal_segments")
        .select("*")
        .eq("company_id", activeCompany.id),
      supabase
        .from("leads")
        .select(
          "id, actual_value, estimated_value, event_date_start, event_date_end, closed_won_date, pipeline_stage_id, company_id, pic_sales_id, client_company_id, client_company:client_companies!client_company_id(id, name, line_industry), pipeline_stage:pipeline_stages!pipeline_stage_id(id, closed_status), category, lead_source, main_stream, grade_lead, stream_type, business_purpose, tipe, nationality, sector, area, referral_source, event_format"
        )
        .eq("company_id", activeCompany.id),
    ])

    const stageWeights: StageWeightsMap = (settingsRes.data as GoalSettingsV2 | null)?.stage_weights ?? {}
    const allNodes = (nodesRes.data as GoalNode[]) ?? []
    const segments = (segmentsRes.data as GoalSegment[]) ?? []
    const leads = ((leadsRes.data ?? []) as unknown) as Array<Record<string, unknown> & {
      id: number
      actual_value: number | null
      estimated_value: number | null
      event_date_start: string | null
      event_date_end: string | null
      closed_won_date: string | null
      pipeline_stage_id: string
      pipeline_stage: { id: string; closed_status: string | null } | null
    }>

    // Filter by period if boundaries provided
    let filteredLeads = leads
    if (periodStart && periodEnd) {
      filteredLeads = leads.filter((lead) =>
        attributeLeadToPeriodV2(
          {
            id: lead.id,
            event_date_start: lead.event_date_start,
            event_date_end: lead.event_date_end,
            closed_won_date: lead.closed_won_date,
          },
          goal,
          periodStart,
          periodEnd
        )
      )
    }

    // Overall attainment
    const attainmentInputs: LeadAttainmentInput[] = filteredLeads.map((l) => ({
      id: l.id,
      actual_value: l.actual_value ?? l.estimated_value,
      is_closed_won: l.pipeline_stage?.closed_status === "won",
    }))
    const attainment = calculateAttainmentV2(attainmentInputs)

    // Overall forecast
    const forecastInputs: LeadForecastInput[] = filteredLeads.map((l) => ({
      id: l.id,
      estimated_value: l.estimated_value,
      actual_value: l.actual_value,
      stage_id: l.pipeline_stage_id ?? "",
      is_closed_won: l.pipeline_stage?.closed_status === "won",
      is_lost: l.pipeline_stage?.closed_status === "lost",
    }))
    const forecast = calculateForecastV2(forecastInputs, stageWeights, goal.weighted_forecast_enabled)

    // Build node tree and compute per-node attainment
    const nodeTree = buildTree(allNodes)
    const nodeAttainmentMap = new Map<string, NodeAttainmentData>()
    const monthlyWeights: MonthlyWeights | null = goal.monthly_weights

    const computeNodeData = (node: GoalNodeTree) => {
      const path = buildAncestorPath(node.id, allNodes)
      let nodeAtt = 0
      let nodeForecastRaw = 0

      for (const lead of filteredLeads) {
        const cc = lead.client_company as Record<string, unknown> | null
        if (!matchLeadToNode(lead as Record<string, unknown>, path, segments, cc)) continue

        if (lead.pipeline_stage?.closed_status === "won") {
          nodeAtt += (lead.actual_value as number) ?? 0
        } else if (lead.pipeline_stage?.closed_status !== "lost") {
          nodeForecastRaw += (lead.estimated_value as number) ?? 0
        }
      }

      node.attainment = nodeAtt
      node.forecast_raw = nodeForecastRaw

      nodeAttainmentMap.set(node.id, {
        nodeId: node.id,
        attainment: nodeAtt,
        forecastRaw: nodeForecastRaw,
        forecastWeighted: nodeForecastRaw, // simplified
      })

      for (const child of node.children) computeNodeData(child)
    }

    for (const root of nodeTree) computeNodeData(root)

    setData({
      attainment: attainment.total,
      forecastRaw: forecast.total_raw,
      forecastWeighted: forecast.total_weighted,
      target: goal.target_amount,
      loading: false,
      goal,
      nodeTree,
      nodeAttainment: nodeAttainmentMap,
    })
  }, [activeCompany?.id, goalId, periodStart, periodEnd])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return data
}
