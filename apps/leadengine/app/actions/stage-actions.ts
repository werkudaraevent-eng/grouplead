"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { requirePermission } from "@/lib/require-permission"
import type { ActionResult, PipelineStage } from "@/types"

/**
 * Server-side stage management actions.
 *
 * All write operations on `pipeline_stages` route through here so they can be
 * gated by the `pipeline` RBAC module — mirroring how leads/companies/contacts
 * mutations are guarded. The client-side kanban/settings UIs still hide the
 * controls when the role lacks the grant, but these guards are the real
 * security boundary (a hand-crafted RPC can't bypass them).
 *
 * Matrix mapping for the `pipeline` module:
 *   - rename  → 'update'
 *   - clone   → 'create'
 *   - delete  → 'delete'
 *   - color   → 'update'
 *   - reorder → 'update'
 */

export async function renameStageAction(
  stageId: string,
  newName: string,
): Promise<ActionResult> {
  try {
    const guard = await requirePermission("pipeline", "update")
    if (!guard.allowed) return guard.error

    const name = newName.trim()
    if (!name) return { success: false, error: "Stage name cannot be empty" }

    const supabase = await createClient()
    const { error } = await supabase
      .from("pipeline_stages")
      .update({ name })
      .eq("id", stageId)

    if (error) return { success: false, error: error.message }

    revalidatePath("/leads")
    revalidatePath("/settings/pipeline")
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" }
  }
}

export async function cloneStageAction(
  stageId: string,
): Promise<ActionResult<PipelineStage>> {
  try {
    const guard = await requirePermission("pipeline", "create")
    if (!guard.allowed) return guard.error

    const supabase = await createClient()

    const { data: source, error: srcErr } = await supabase
      .from("pipeline_stages")
      .select("*")
      .eq("id", stageId)
      .single()
    if (srcErr) return { success: false, error: srcErr.message }
    if (!source) return { success: false, error: "Source stage not found" }

    // Compute next sort order within the same pipeline.
    let maxQuery = supabase
      .from("pipeline_stages")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
    if (source.pipeline_id) {
      maxQuery = maxQuery.eq("pipeline_id", source.pipeline_id)
    }
    const { data: maxRow } = await maxQuery.maybeSingle()
    const nextSort = (maxRow?.sort_order ?? source.sort_order ?? 0) + 1

    const insertPayload: Record<string, unknown> = {
      name: `${source.name} (Copy)`,
      color: source.color,
      sort_order: nextSort,
      is_default: false,
      stage_type: source.stage_type,
      pipeline_id: source.pipeline_id ?? null,
    }
    if (source.stage_type === "closed") {
      insertPayload.closed_status = source.closed_status ?? "lost"
    }

    const { data, error } = await supabase
      .from("pipeline_stages")
      .insert(insertPayload)
      .select()
      .single()

    if (error) {
      const msg = error.message.includes("unique")
        ? "A stage with that name already exists"
        : error.message
      return { success: false, error: msg }
    }

    revalidatePath("/leads")
    revalidatePath("/settings/pipeline")
    return { success: true, data: data as PipelineStage }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" }
  }
}

export async function deleteStageAction(
  stageId: string,
  fallbackStageId?: string | null,
): Promise<ActionResult> {
  try {
    const guard = await requirePermission("pipeline", "delete")
    if (!guard.allowed) return guard.error

    const supabase = await createClient()

    // Reassign any leads sitting in this stage to a fallback stage so we never
    // orphan records on delete. The caller supplies the fallback (the first
    // remaining stage); if none is given we refuse rather than orphan leads.
    const { count } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("pipeline_stage_id", stageId)

    if (count && count > 0) {
      if (!fallbackStageId) {
        return { success: false, error: `Cannot delete — ${count} lead(s) are in this stage and no fallback stage is available` }
      }
      const { error: moveErr } = await supabase
        .from("leads")
        .update({ pipeline_stage_id: fallbackStageId })
        .eq("pipeline_stage_id", stageId)
      if (moveErr) return { success: false, error: `Failed to move leads: ${moveErr.message}` }
    }

    const { error } = await supabase
      .from("pipeline_stages")
      .delete()
      .eq("id", stageId)

    if (error) return { success: false, error: error.message }

    revalidatePath("/leads")
    revalidatePath("/settings/pipeline")
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" }
  }
}

export async function changeStageColorAction(
  stageId: string,
  color: string,
): Promise<ActionResult> {
  try {
    const guard = await requirePermission("pipeline", "update")
    if (!guard.allowed) return guard.error

    const supabase = await createClient()
    const { error } = await supabase
      .from("pipeline_stages")
      .update({ color })
      .eq("id", stageId)

    if (error) return { success: false, error: error.message }

    revalidatePath("/leads")
    revalidatePath("/settings/pipeline")
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" }
  }
}

export interface CreateStageInput {
  pipelineId: string
  name: string
  stageType: "open" | "closed"
  color: string
  sortOrder: number
  closedStatus?: "won" | "lost"
}

export async function createStageAction(
  input: CreateStageInput,
): Promise<ActionResult<PipelineStage>> {
  try {
    const guard = await requirePermission("pipeline", "create")
    if (!guard.allowed) return guard.error

    const name = input.name.trim()
    if (!name) return { success: false, error: "Stage name cannot be empty" }

    const supabase = await createClient()
    const insertPayload: Record<string, unknown> = {
      pipeline_id: input.pipelineId,
      name,
      stage_type: input.stageType,
      color: input.color,
      sort_order: input.sortOrder,
    }
    if (input.stageType === "closed") {
      insertPayload.closed_status = input.closedStatus ?? "lost"
    }

    const { data, error } = await supabase
      .from("pipeline_stages")
      .insert(insertPayload)
      .select()
      .single()

    if (error) {
      const msg = error.message.includes("unique")
        ? "A stage with that name already exists"
        : error.message
      return { success: false, error: msg }
    }

    revalidatePath("/leads")
    revalidatePath("/settings/pipeline")
    return { success: true, data: data as PipelineStage }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" }
  }
}
