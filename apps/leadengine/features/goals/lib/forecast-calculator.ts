import type { LeadForecastInput, StageWeightsMap } from '@/types/goals'

/**
 * Calculates forecast from open-stage leads (excluding Closed Won and Lost).
 *
 * Raw forecast: sum of estimated_value for open leads.
 * Weighted forecast: each lead's value multiplied by its stage weight / 100.
 * Stage weights are read from the StageWeightsMap JSONB structure.
 * If weightedEnabled is false, total_weighted mirrors total_raw.
 */
export function calculateForecastV2(
  leads: LeadForecastInput[],
  stageWeights: StageWeightsMap,
  weightedEnabled: boolean
): { total_raw: number; total_weighted: number; lead_count: number } {
  let total_raw = 0
  let total_weighted = 0
  let lead_count = 0

  // Flatten StageWeightsMap to stage_id → weight_percent lookup
  const weightByStage = new Map<string, number>()
  for (const pipelineWeights of Object.values(stageWeights)) {
    for (const [stageId, weight] of Object.entries(pipelineWeights)) {
      weightByStage.set(stageId, weight)
    }
  }

  for (const lead of leads) {
    // Exclude Closed Won and Lost leads
    if (lead.is_closed_won || lead.is_lost) continue

    const rawValue = lead.estimated_value ?? lead.actual_value ?? 0
    const weightPercent = weightedEnabled
      ? (weightByStage.get(lead.stage_id) ?? 0)
      : 100
    const weightedValue = rawValue * (weightPercent / 100)

    total_raw += rawValue
    total_weighted += weightedValue
    lead_count++
  }

  return { total_raw, total_weighted, lead_count }
}
