'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { LEAD_FIELD_REGISTRY } from '@/config/lead-field-registry'
import {
  validateBreakdownConfig,
  validateMonthlyCutoff,
  validateUserTarget,
  validateStageWeights,
} from '@/features/goals/lib/goal-validation'
import { validateCriticalFieldUpdate } from '@/features/goals/lib/goal-settings-validation'
import type {
  GoalV2Insert,
  GoalV2Update,
  GoalSegmentInsert,
  GoalSegmentUpdate,
  GoalUserTargetInsert,
  GoalSettingsV2Update,
  SavedViewInsert,
  SavedViewUpdate,
} from '@/types/goals'

type ActionResult = { success: boolean; error?: string; data?: Record<string, unknown> }

const GOALS_PATH = '/settings/goals'

// ═══════════════════════════════════════════════════════════════════
// Goal V2 CRUD
// ═══════════════════════════════════════════════════════════════════

export async function createGoalV2Action(data: GoalV2Insert): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const configCheck = validateBreakdownConfig(data.breakdown_config ?? [])
    if (!configCheck.valid) return { success: false, error: configCheck.error }

    if (data.monthly_cutoff_day != null) {
      const cutoffCheck = validateMonthlyCutoff(data.monthly_cutoff_day)
      if (!cutoffCheck.valid) return { success: false, error: cutoffCheck.error }
    }

    if ((data.target_amount ?? 0) < 0) {
      return { success: false, error: 'target_amount must be non-negative' }
    }

    const { data: goal, error } = await supabase
      .from('goals_v2')
      .insert({ ...data, created_by: user.id })
      .select('id')
      .single()

    if (error) return { success: false, error: error.message }
    revalidatePath(GOALS_PATH)
    return { success: true, data: { id: goal.id } }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function updateGoalV2Action(goalId: string, data: GoalV2Update): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    if (data.breakdown_config != null) {
      const configCheck = validateBreakdownConfig(data.breakdown_config)
      if (!configCheck.valid) return { success: false, error: configCheck.error }
    }

    if (data.monthly_cutoff_day != null) {
      const cutoffCheck = validateMonthlyCutoff(data.monthly_cutoff_day)
      if (!cutoffCheck.valid) return { success: false, error: cutoffCheck.error }
    }

    if (data.target_amount != null && data.target_amount < 0) {
      return { success: false, error: 'target_amount must be non-negative' }
    }

    const { error } = await supabase
      .from('goals_v2')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', goalId)

    if (error) return { success: false, error: error.message }
    revalidatePath(GOALS_PATH)
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function deleteGoalV2Action(goalId: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { error } = await supabase.from('goals_v2').delete().eq('id', goalId)
    if (error) return { success: false, error: error.message }
    revalidatePath(GOALS_PATH)
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ═══════════════════════════════════════════════════════════════════
// Goal Segment CRUD
// ═══════════════════════════════════════════════════════════════════

function validateSegmentSourceField(sourceField: string): { valid: boolean; error?: string } {
  const entry = LEAD_FIELD_REGISTRY.find((f) => f.key === sourceField)
  if (!entry) return { valid: false, error: `Invalid source field: ${sourceField}` }
  if (!entry.supportsSegmentation) {
    return { valid: false, error: `Field '${sourceField}' does not support segmentation` }
  }
  return { valid: true }
}

export async function upsertGoalSegmentAction(data: GoalSegmentInsert): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const fieldCheck = validateSegmentSourceField(data.source_field)
    if (!fieldCheck.valid) return { success: false, error: fieldCheck.error }

    const { data: segment, error } = await supabase
      .from('goal_segments')
      .upsert(data, { onConflict: 'company_id,name' })
      .select('id')
      .single()

    if (error) return { success: false, error: error.message }
    revalidatePath(GOALS_PATH)
    return { success: true, data: { id: segment.id } }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function updateGoalSegmentAction(
  segmentId: string,
  data: GoalSegmentUpdate
): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    if (data.source_field != null) {
      const fieldCheck = validateSegmentSourceField(data.source_field)
      if (!fieldCheck.valid) return { success: false, error: fieldCheck.error }
    }

    const { error } = await supabase
      .from('goal_segments')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', segmentId)

    if (error) return { success: false, error: error.message }
    revalidatePath(GOALS_PATH)
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function deleteGoalSegmentAction(segmentId: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { error } = await supabase.from('goal_segments').delete().eq('id', segmentId)
    if (error) return { success: false, error: error.message }
    revalidatePath(GOALS_PATH)
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ═══════════════════════════════════════════════════════════════════
// Goal User Targets CRUD
// ═══════════════════════════════════════════════════════════════════

export async function upsertGoalUserTargetAction(data: GoalUserTargetInsert): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const targetCheck = validateUserTarget(data.period_start, data.period_end, data.target_amount)
    if (!targetCheck.valid) return { success: false, error: targetCheck.error }

    const { data: target, error } = await supabase
      .from('goal_user_targets')
      .upsert(data, { onConflict: 'goal_id,user_id,period_start' })
      .select('id')
      .single()

    if (error) return { success: false, error: error.message }
    revalidatePath(GOALS_PATH)
    return { success: true, data: { id: target.id } }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function deleteGoalUserTargetAction(targetId: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { error } = await supabase.from('goal_user_targets').delete().eq('id', targetId)
    if (error) return { success: false, error: error.message }
    revalidatePath(GOALS_PATH)
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ═══════════════════════════════════════════════════════════════════
// Goal Settings V2
// ═══════════════════════════════════════════════════════════════════

export async function updateGoalSettingsV2Action(
  companyId: string,
  data: GoalSettingsV2Update
): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    if (data.stage_weights != null) {
      const weightsCheck = validateStageWeights(data.stage_weights)
      if (!weightsCheck.valid) return { success: false, error: weightsCheck.error }
    }

    if (data.reporting_critical_fields != null) {
      // Fetch current fields to validate against
      const { data: current } = await supabase
        .from('goal_settings_v2')
        .select('reporting_critical_fields')
        .eq('company_id', companyId)
        .single()

      const currentFields = current?.reporting_critical_fields ?? []
      const fieldsCheck = validateCriticalFieldUpdate(currentFields, data.reporting_critical_fields)
      if (!fieldsCheck.valid) return { success: false, error: fieldsCheck.error }
    }

    const { error } = await supabase
      .from('goal_settings_v2')
      .upsert(
        { company_id: companyId, ...data, updated_at: new Date().toISOString() },
        { onConflict: 'company_id' }
      )

    if (error) return { success: false, error: error.message }
    revalidatePath(GOALS_PATH)
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ═══════════════════════════════════════════════════════════════════
// Saved Views (preserved unchanged)
// ═══════════════════════════════════════════════════════════════════

export async function createSavedViewAction(data: SavedViewInsert): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { data: view, error } = await supabase
      .from('saved_views')
      .insert({ ...data, user_id: user.id })
      .select('id')
      .single()

    if (error) return { success: false, error: error.message }
    revalidatePath(GOALS_PATH)
    return { success: true, data: { id: view.id } }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function updateSavedViewAction(viewId: string, data: SavedViewUpdate): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('saved_views')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', viewId)

    if (error) return { success: false, error: error.message }
    revalidatePath(GOALS_PATH)
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function deleteSavedViewAction(viewId: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('saved_views')
      .delete()
      .eq('id', viewId)

    if (error) return { success: false, error: error.message }
    revalidatePath(GOALS_PATH)
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
