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

import { LEAD_FIELD_REGISTRY } from '@/config/lead-field-registry'

// UUID v4 pattern for segment:{uuid} validation
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Validates goal node input data.
 * - reference_field must be in Lead_Field_Registry or match segment:{uuid} pattern
 * - percentage must be in [0, 100] for percentage mode
 * - target_amount must be non-negative
 * - allocation_mode must be consistent with siblings
 */
export function validateGoalNodeInput(
  data: {
    reference_field: string
    allocation_mode: string
    percentage?: number | null
    target_amount: number
  },
  siblings: { allocation_mode: string }[]
): { valid: boolean; error?: string } {
  // Validate reference_field
  const isRegistryField = LEAD_FIELD_REGISTRY.some((f) => f.key === data.reference_field)
  const isSegmentField =
    data.reference_field.startsWith('segment:') &&
    UUID_PATTERN.test(data.reference_field.replace('segment:', ''))

  if (!isRegistryField && !isSegmentField) {
    return { valid: false, error: `Invalid reference field: ${data.reference_field}` }
  }

  // Validate percentage range for percentage mode
  if (data.allocation_mode === 'percentage' && data.percentage != null) {
    if (data.percentage < 0 || data.percentage > 100) {
      return { valid: false, error: 'Percentage must be between 0 and 100' }
    }
  }

  // Validate non-negative target_amount
  if (data.target_amount < 0) {
    return { valid: false, error: 'Target amount must be non-negative' }
  }

  // Validate sibling allocation_mode consistency
  if (siblings.length > 0) {
    const siblingMode = siblings[0].allocation_mode
    if (data.allocation_mode !== siblingMode) {
      return { valid: false, error: 'All siblings must use the same allocation mode' }
    }
  }

  return { valid: true }
}

/**
 * Validates that a node's goal_id matches its parent's goal_id.
 * Rejects cross-goal parent references.
 */
export function validateNodeCrossReference(
  nodeGoalId: string,
  parentGoalId: string
): { valid: boolean; error?: string } {
  if (nodeGoalId !== parentGoalId) {
    return { valid: false, error: 'Parent node must belong to the same goal' }
  }
  return { valid: true }
}

/**
 * Validates that a user target's goal_id matches the referenced node's goal_id.
 * Rejects cross-goal node_id on user targets.
 */
export function validateUserTargetNodeRef(
  targetGoalId: string,
  nodeGoalId: string
): { valid: boolean; error?: string } {
  if (targetGoalId !== nodeGoalId) {
    return { valid: false, error: 'Node must belong to the same goal as the target' }
  }
  return { valid: true }
}
