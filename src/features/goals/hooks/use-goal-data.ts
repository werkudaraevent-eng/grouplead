"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/utils/supabase/client"
import { useCompany } from "@/contexts/company-context"
import { calculateAttainmentV2 } from "@/features/goals/lib/attainment-calculator"
import { calculateForecastV2 } from "@/features/goals/lib/forecast-calculator"
import { attributeLeadToPeriodV2 } from "@/features/goals/lib/attribution-engine"
import type {
  GoalV2,
  GoalSettingsV2,
  LeadAttainmentInput,
  LeadForecastInput,
  StageWeightsMap,
} from "@/types/goals"

export interface GoalData {
  attainment: number
  forecastRaw: number
  forecastWeighted: number
  target: number
  loading: boolean
  goal: GoalV2 | null
}

/**
 * Fetches goal data for the active company using the V2 schema.
 * Accepts an optional goalId; if not provided, uses the first active goal.
 * Accepts optional period boundaries (periodStart/periodEnd as YYYY-MM-DD strings).
 * If no period boundaries are provided, all leads are included.
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
      setData({ attainment: 0, forecastRaw: 0, forecastWeighted: 0, target: 0, loading: false, goal: null })
      return
    }

    // Fetch settings for stage weights
    const { data: settingsRow } = await supabase
      .from("goal_settings_v2")
      .select("stage_weights")
      .eq("company_id", activeCompany.id)
      .maybeSingle()

    const stageWeights: StageWeightsMap = (settingsRow as GoalSettingsV2 | null)?.stage_weights ?? {}

    // Fetch leads
    const { data: leadsRaw } = await supabase
      .from("leads")
      .select(
        "id, actual_value, estimated_value, event_date_start, event_date_end, closed_won_date, pipeline_stage_id, pipeline_stage:pipeline_stages!pipeline_stage_id(id, closed_status)"
      )
      .eq("company_id", activeCompany.id)

    const leads = (leadsRaw ?? []) as Array<{
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

    // Attainment
    const attainmentInputs: LeadAttainmentInput[] = filteredLeads.map((l) => ({
      id: l.id,
      actual_value: l.actual_value ?? l.estimated_value,
      is_closed_won: l.pipeline_stage?.closed_status === "won",
    }))
    const attainment = calculateAttainmentV2(attainmentInputs)

    // Forecast
    const forecastInputs: LeadForecastInput[] = filteredLeads.map((l) => ({
      id: l.id,
      estimated_value: l.estimated_value,
      actual_value: l.actual_value,
      stage_id: l.pipeline_stage_id ?? "",
      is_closed_won: l.pipeline_stage?.closed_status === "won",
      is_lost: l.pipeline_stage?.closed_status === "lost",
    }))
    const forecast = calculateForecastV2(
      forecastInputs,
      stageWeights,
      goal.weighted_forecast_enabled
    )

    setData({
      attainment: attainment.total,
      forecastRaw: forecast.total_raw,
      forecastWeighted: forecast.total_weighted,
      target: goal.target_amount,
      loading: false,
      goal,
    })
  }, [activeCompany?.id, goalId, periodStart, periodEnd])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return data
}
