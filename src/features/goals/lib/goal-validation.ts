import type { BreakdownLevelConfig, StageWeightsMap } from '@/types/goals'

/**
 * Validates that a breakdown_config array has at most 10 levels.
 */
export function validateBreakdownConfig(
  config: BreakdownLevelConfig[]
): { valid: boolean; error?: string } {
  if (config.length > 10) {
    return { valid: false, error: 'Breakdown config cannot exceed 10 levels' }
  }
  return { valid: true }
}

/**
 * Validates that a monthly_cutoff_day is within [1, 28].
 */
export function validateMonthlyCutoff(
  day: number
): { valid: boolean; error?: string } {
  if (!Number.isInteger(day) || day < 1 || day > 28) {
    return { valid: false, error: 'Monthly cutoff day must be an integer between 1 and 28' }
  }
  return { valid: true }
}

/**
 * Validates a user target: period_start must be before period_end,
 * and target_amount must be non-negative.
 */
export function validateUserTarget(
  periodStart: string,
  periodEnd: string,
  targetAmount: number
): { valid: boolean; error?: string } {
  if (periodStart >= periodEnd) {
    return { valid: false, error: 'period_start must be before period_end' }
  }
  if (targetAmount < 0) {
    return { valid: false, error: 'target_amount must be non-negative' }
  }
  return { valid: true }
}

/**
 * Validates that all weight_percent values in a StageWeightsMap are
 * integers in [0, 100].
 */
export function validateStageWeights(
  weights: StageWeightsMap
): { valid: boolean; error?: string } {
  for (const [pipelineId, stages] of Object.entries(weights)) {
    for (const [stageId, weight] of Object.entries(stages)) {
      if (!Number.isInteger(weight) || weight < 0 || weight > 100) {
        return {
          valid: false,
          error: `Stage weight for pipeline ${pipelineId}, stage ${stageId} must be an integer between 0 and 100`,
        }
      }
    }
  }
  return { valid: true }
}
