'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { LEAD_FIELD_REGISTRY } from '@/config/lead-field-registry'
import {
  validateBreakdownConfig,
  validateMonthlyCutoff,
  validateUserTarget,
  validateStageWeights,
  validateGoalNodeInput,
  validateUserTargetNodeRef,
} from '@/features/goals/lib/goal-validation'
import { validateCriticalFieldUpdate } from '@/features/goals/lib/goal-settings-validation'
import { cascadeRecalculate, cascadeMonthlyTarget } from '@/features/goals/lib/cascade-service'
import { validateMonthlyWeights } from '@/features/goals/lib/target-calculator'
import { requirePermission } from '@/lib/require-permission'
import type {
  GoalV2Insert,
  GoalV2Update,
  GoalSegmentInsert,
  GoalSegmentUpdate,
  GoalUserTargetInsert,
  GoalSettingsV2Update,
  SavedViewInsert,
  SavedViewUpdate,
  GoalNodeInsert,
  GoalNodeUpdate,
  ActionResult,
} from '@/types'

const GOALS_PATH = '/settings/goals'

// ═══════════════════════════════════════════════════════════════════
// Goal V2 CRUD
// ═══════════════════════════════════════════════════════════════════

export async function createGoalV2Action(data: GoalV2Insert): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    const guard = await requirePermission('goal_settings', 'create')
    if (!guard.allowed) return guard.error

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

    // Generate slug from name
    const baseSlug = data.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
    
    // Check for existing slugs in the same company to avoid duplicates
    let slug = baseSlug
    let suffix = 0
    while (true) {
      const { data: existing } = await supabase
        .from('goals_v2')
        .select('id')
        .eq('company_id', data.company_id)
        .eq('slug', slug)
        .maybeSingle()
      if (!existing) break
      suffix++
      slug = `${baseSlug}-${suffix}`
    }

    const { data: goal, error } = await supabase
      .from('goals_v2')
      .insert({ ...data, slug, created_by: user.id })
      .select('id, slug')
      .single()

    if (error) return { success: false, error: error.message }
    revalidatePath(GOALS_PATH)
    return { success: true, data: { id: goal.id, slug: goal.slug } }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function updateGoalV2Action(goalId: string, data: GoalV2Update): Promise<ActionResult> {
  try {
    const guard = await requirePermission('goal_settings', 'update')
    if (!guard.allowed) return guard.error

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

    if (data.monthly_weights != null) {
      const weightsCheck = validateMonthlyWeights(data.monthly_weights)
      if (!weightsCheck.valid) return { success: false, error: weightsCheck.error }
    }

    // Regenerate slug if name changes
    let updatePayload: Record<string, unknown> = { ...data, updated_at: new Date().toISOString() }
    if (data.name != null) {
      const baseSlug = data.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
      
      // Get the goal's company_id
      const { data: currentGoal } = await supabase
        .from('goals_v2')
        .select('company_id')
        .eq('id', goalId)
        .single()
      
      if (currentGoal) {
        let slug = baseSlug
        let suffix = 0
        while (true) {
          const { data: existing } = await supabase
            .from('goals_v2')
            .select('id')
            .eq('company_id', currentGoal.company_id)
            .eq('slug', slug)
            .neq('id', goalId)
            .maybeSingle()
          if (!existing) break
          suffix++
          slug = `${baseSlug}-${suffix}`
        }
        updatePayload.slug = slug
      }
    }

    // Use service client to bypass RLS for goal updates
    const serviceClient = createServiceClient();
    const { error } = await serviceClient
      .from('goals_v2')
      .update(updatePayload)
      .eq('id', goalId)

    if (error) return { success: false, error: error.message }

    // When target_amount changes, cascade recalculate root-level nodes
    if (data.target_amount != null) {
      const { data: rootNodes } = await serviceClient
        .from('goal_nodes')
        .select('*')
        .eq('goal_id', goalId)
        .is('parent_node_id', null)
        .order('sort_order')

      if (rootNodes && rootNodes.length > 0) {
        const updates = cascadeRecalculate(data.target_amount, rootNodes)
        for (const upd of updates) {
          await serviceClient
            .from('goal_nodes')
            .update({
              target_amount: upd.target_amount,
              percentage: upd.percentage,
              updated_at: new Date().toISOString(),
            })
            .eq('id', upd.id)
        }
      }
    }

    revalidatePath(GOALS_PATH)
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function deleteGoalV2Action(goalId: string): Promise<ActionResult> {
  try {
    const guard = await requirePermission('goal_settings', 'delete')
    if (!guard.allowed) return guard.error

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

export async function upsertGoalSegmentAction(data: GoalSegmentInsert): Promise<ActionResult<{ id: string }>> {
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

export async function upsertGoalUserTargetAction(data: GoalUserTargetInsert): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const targetCheck = validateUserTarget(data.period_start, data.period_end, data.target_amount)
    if (!targetCheck.valid) return { success: false, error: targetCheck.error }

    // Validate node_id belongs to the same goal_id
    if (data.node_id) {
      const { data: node, error: nodeError } = await supabase
        .from('goal_nodes')
        .select('goal_id')
        .eq('id', data.node_id)
        .single()

      if (nodeError || !node) {
        return { success: false, error: 'Referenced node not found' }
      }

      const nodeRefCheck = validateUserTargetNodeRef(data.goal_id, node.goal_id)
      if (!nodeRefCheck.valid) return { success: false, error: nodeRefCheck.error }
    }

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

export async function createSavedViewAction(data: SavedViewInsert): Promise<ActionResult<{ id: string }>> {
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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

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


// ═══════════════════════════════════════════════════════════════════
// Goal Node CRUD
// ═══════════════════════════════════════════════════════════════════

export async function createGoalNodeAction(data: GoalNodeInsert): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    // Fetch siblings for validation (same parent_node_id within same goal)
    const siblingQuery = supabase
      .from('goal_nodes')
      .select('allocation_mode')
      .eq('goal_id', data.goal_id)

    if (data.parent_node_id) {
      siblingQuery.eq('parent_node_id', data.parent_node_id)
    } else {
      siblingQuery.is('parent_node_id', null)
    }

    const { data: siblings } = await siblingQuery

    const inputCheck = validateGoalNodeInput(
      {
        reference_field: data.reference_field,
        allocation_mode: data.allocation_mode,
        percentage: data.percentage,
        target_amount: data.target_amount,
      },
      siblings ?? []
    )
    if (!inputCheck.valid) return { success: false, error: inputCheck.error }

    const { data: node, error } = await supabase
      .from('goal_nodes')
      .insert(data)
      .select('id, parent_node_id, goal_id')
      .single()

    if (error) return { success: false, error: error.message }

    // Trigger cascade if parent has percentage-mode children
    if (node.parent_node_id) {
      const { data: parentNode } = await supabase
        .from('goal_nodes')
        .select('target_amount')
        .eq('id', node.parent_node_id)
        .single()

      if (parentNode) {
        const { data: children } = await supabase
          .from('goal_nodes')
          .select('*')
          .eq('parent_node_id', node.parent_node_id)
          .order('sort_order')

        if (children && children.some((c) => c.allocation_mode === 'percentage')) {
          const updates = cascadeRecalculate(parentNode.target_amount, children)
          for (const upd of updates) {
            await supabase
              .from('goal_nodes')
              .update({
                target_amount: upd.target_amount,
                percentage: upd.percentage,
                updated_at: new Date().toISOString(),
              })
              .eq('id', upd.id)
          }
        }
      }
    }

    revalidatePath(GOALS_PATH)
    return { success: true, data: { id: node.id } }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function updateGoalNodeAction(
  nodeId: string,
  data: GoalNodeUpdate
): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    // Fetch current node to get goal_id and parent_node_id
    const { data: currentNode, error: fetchError } = await supabase
      .from('goal_nodes')
      .select('*')
      .eq('id', nodeId)
      .single()

    if (fetchError || !currentNode) {
      return { success: false, error: 'Node not found' }
    }

    // Fetch siblings for validation
    const siblingQuery = supabase
      .from('goal_nodes')
      .select('allocation_mode')
      .eq('goal_id', currentNode.goal_id)
      .neq('id', nodeId)

    if (currentNode.parent_node_id) {
      siblingQuery.eq('parent_node_id', currentNode.parent_node_id)
    } else {
      siblingQuery.is('parent_node_id', null)
    }

    const { data: siblings } = await siblingQuery

    // Validate if relevant fields are being updated
    const refField = data.reference_field ?? currentNode.reference_field
    const allocMode = data.allocation_mode ?? currentNode.allocation_mode
    const pct = data.percentage !== undefined ? data.percentage : currentNode.percentage
    const targetAmt = data.target_amount ?? currentNode.target_amount

    const inputCheck = validateGoalNodeInput(
      {
        reference_field: refField,
        allocation_mode: allocMode,
        percentage: pct,
        target_amount: targetAmt,
      },
      siblings ?? []
    )
    if (!inputCheck.valid) return { success: false, error: inputCheck.error }

    const { error } = await supabase
      .from('goal_nodes')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', nodeId)

    if (error) return { success: false, error: error.message }

    // Cascade recalculate children if target_amount changed
    if (data.target_amount != null) {
      const { data: children } = await supabase
        .from('goal_nodes')
        .select('*')
        .eq('parent_node_id', nodeId)
        .order('sort_order')

      if (children && children.length > 0) {
        const updates = cascadeRecalculate(data.target_amount, children)
        for (const upd of updates) {
          await supabase
            .from('goal_nodes')
            .update({
              target_amount: upd.target_amount,
              percentage: upd.percentage,
              updated_at: new Date().toISOString(),
            })
            .eq('id', upd.id)
        }
      }
    }

    // Cascade monthly_targets if updated
    if (data.monthly_targets != null) {
      const { data: children } = await supabase
        .from('goal_nodes')
        .select('*')
        .eq('parent_node_id', nodeId)
        .order('sort_order')

      if (children && children.length > 0) {
        for (const [month, amount] of Object.entries(data.monthly_targets)) {
          const monthUpdates = cascadeMonthlyTarget(amount, Number(month), children)
          for (const upd of monthUpdates) {
            await supabase
              .from('goal_nodes')
              .update({
                monthly_targets: upd.monthly_targets,
                updated_at: new Date().toISOString(),
              })
              .eq('id', upd.id)
          }
        }
      }
    }

    revalidatePath(GOALS_PATH)
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function deleteGoalNodeAction(nodeId: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { error } = await supabase.from('goal_nodes').delete().eq('id', nodeId)
    if (error) return { success: false, error: error.message }

    revalidatePath(GOALS_PATH)
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function reorderGoalNodesAction(nodeIds: string[]): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    for (let i = 0; i < nodeIds.length; i++) {
      const { error } = await supabase
        .from('goal_nodes')
        .update({ sort_order: i, updated_at: new Date().toISOString() })
        .eq('id', nodeIds[i])

      if (error) return { success: false, error: error.message }
    }

    revalidatePath(GOALS_PATH)
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function deleteGoalLevelAction(
  goalId: string, 
  dimensionType: string
): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { error } = await supabase
      .from('goal_nodes')
      .delete()
      .eq('goal_id', goalId)
      .eq('dimension_type', dimensionType)

    if (error) return { success: false, error: error.message }
    revalidatePath(GOALS_PATH)
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

export async function autoInsertGoalHierarchyAction(
  goalId: string,
  companyId: string,
  dimensionType: string,
  parentIds: string[] | null
): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    // First attempt to find the field in our registry
    const fieldEntry = LEAD_FIELD_REGISTRY.find(f => f.key === dimensionType)

    // Resolve the canonical lead column for this dimension. Entity-typed
    // dimensions (sales_owner, subsidiary, client_company) DO NOT match
    // their dimension_type — they live on the lead row under a different
    // column. Storing reference_field = dimensionType for these creates
    // orphan goal_nodes that can never be joined back to leads.
    const ENTITY_FIELD_MAP: Record<string, string> = {
       sales_owner: 'pic_sales_id',
       subsidiary: 'company_id',
       client_company: 'client_company_id',
    }
    const referenceField = ENTITY_FIELD_MAP[dimensionType]
       ?? fieldEntry?.key
       ?? dimensionType

    let options: { value: string, label: string }[] = []

    if (dimensionType.startsWith('segment:')) {
       // Segment-based: resolve from goal_segments mappings
       const segmentId = dimensionType.split(':')[1]
       const { data } = await supabase.from('goal_segments').select('id, name, fallback_name, mappings').eq('id', segmentId).single()
       if (data && Array.isArray(data.mappings)) {
           options = data.mappings.map((m: any) => ({ value: m.segment_name, label: m.segment_name }))
           if (data.fallback_name) {
               options.push({ value: data.fallback_name, label: data.fallback_name })
           }
       }
    } else if (dimensionType === 'subsidiary') {
       // Entity: Subsidiary → companies
       const { data } = await supabase.from('companies').select('id, name').eq('is_holding', false)
       options = (data || []).map(d => ({ value: d.id, label: d.name }))
    } else if (dimensionType === 'sales_owner') {
       // Entity: Sales Owner → profiles
       const { data } = await supabase.from('profiles').select('id, full_name')
       options = (data || []).map(d => ({ value: d.id, label: d.full_name || 'User' }))
    } else if (dimensionType === 'client_company') {
       // Entity: Client Company → client_companies
       const { data } = await supabase.from('client_companies').select('id, name').order('name')
       options = (data || []).map(d => ({ value: d.id, label: d.name }))
    } else {
       // Attribute-based: resolve from master_options by option_type
       // The dimensionType IS the option_type (e.g. 'category', 'main_stream', 'lead_source')
       const optionType = fieldEntry?.valueSource.type === 'master_options'
         ? (fieldEntry.valueSource as { type: 'master_options'; optionType: string }).optionType
         : dimensionType
       const { data } = await supabase.from('master_options')
           .select('id, label')
           .eq('option_type', optionType)
           .eq('is_active', true)
           .or(`company_id.eq.${companyId},company_id.is.null`)
           .order('sort_order')
       options = (data || []).map(d => ({ value: d.label, label: d.label }))
    }

    if (options.length === 0) {
       options = [{ value: `new-${Date.now()}`, label: `New ${dimensionType}` }]
    }

    const inserts: GoalNodeInsert[] = []
    const parents = (parentIds && parentIds.length > 0) ? parentIds : [null]
    
    for (const pId of parents) {
       for (let i = 0; i < options.length; i++) {
         const opt = options[i]
         inserts.push({
           goal_id: goalId,
           company_id: companyId,
           parent_node_id: pId,
           name: opt.label,
           dimension_type: dimensionType,
           reference_field: referenceField,
           reference_value: opt.value,
           allocation_mode: 'absolute',
           percentage: 0,
           target_amount: 0,
           monthly_targets: {},
           sort_order: i
         })
       }
    }

    const { error } = await supabase.from('goal_nodes').insert(inserts)
    if (error) return { success: false, error: error.message }

    revalidatePath(GOALS_PATH)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
