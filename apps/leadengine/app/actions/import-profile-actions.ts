"use server"

import { createClient } from "@/utils/supabase/server"
import type { ActionResult } from "@/types"
import { revalidatePath } from "next/cache"

// ── Stage Mappings ──────────────────────────────────────────────────────

export interface StageMappingRow {
    id: string
    pipeline_id: string
    source_value: string
    target_stage_id: string
}

/**
 * Load all stage mappings for a pipeline, in display order.
 */
export async function getStageMappings(
    pipelineId: string,
): Promise<ActionResult<StageMappingRow[]>> {
    if (!pipelineId) return { success: true, data: [] }
    try {
        const supabase = await createClient()
        const { data, error } = await supabase
            .from("import_stage_mappings")
            .select("id, pipeline_id, source_value, target_stage_id")
            .eq("pipeline_id", pipelineId)
            .order("source_value", { ascending: true })
        if (error) return { success: false, error: error.message }
        return { success: true, data: data ?? [] }
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
        }
    }
}

/**
 * Replace the entire stage-mapping set for a pipeline. We do this as
 * delete-then-insert in a single round-trip so the DB always reflects the
 * exact mappings the user configured (no orphan rules from previous edits).
 */
export async function saveStageMappings(
    pipelineId: string,
    mappings: Array<{ source_value: string; target_stage_id: string }>,
): Promise<ActionResult<{ count: number }>> {
    if (!pipelineId) {
        return { success: false, error: "pipelineId is required" }
    }
    try {
        const supabase = await createClient()
        // Wipe existing rules for this pipeline.
        const { error: delErr } = await supabase
            .from("import_stage_mappings")
            .delete()
            .eq("pipeline_id", pipelineId)
        if (delErr) return { success: false, error: delErr.message }

        // Filter out empty entries.
        const cleaned = mappings
            .map((m) => ({
                pipeline_id: pipelineId,
                source_value: m.source_value.trim(),
                target_stage_id: m.target_stage_id,
            }))
            .filter((m) => m.source_value && m.target_stage_id)

        if (cleaned.length === 0) {
            revalidatePath("/", "layout")
            return { success: true, data: { count: 0 } }
        }

        const { error: insErr } = await supabase
            .from("import_stage_mappings")
            .insert(cleaned)
        if (insErr) return { success: false, error: insErr.message }

        revalidatePath("/", "layout")
        return { success: true, data: { count: cleaned.length } }
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
        }
    }
}

// ── Import Profiles ─────────────────────────────────────────────────────

export interface ImportProfileRow {
    id: string
    name: string
    description: string | null
    pipeline_id: string | null
    is_historical: boolean
    column_mapping: Record<string, string>
    stage_mapping: Record<string, string>
    status_source_field: string | null
    created_at: string
    updated_at: string
}

/**
 * List saved import profiles. Optionally filter by pipeline.
 */
export async function listImportProfiles(
    pipelineId?: string,
): Promise<ActionResult<ImportProfileRow[]>> {
    try {
        const supabase = await createClient()
        let q = supabase
            .from("import_profiles")
            .select("id, name, description, pipeline_id, is_historical, column_mapping, stage_mapping, status_source_field, created_at, updated_at")
            .order("updated_at", { ascending: false })
        if (pipelineId) q = q.or(`pipeline_id.eq.${pipelineId},pipeline_id.is.null`)
        const { data, error } = await q
        if (error) return { success: false, error: error.message }
        return { success: true, data: (data ?? []) as ImportProfileRow[] }
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
        }
    }
}

export interface SaveImportProfileInput {
    id?: string // present → update
    name: string
    description?: string | null
    pipeline_id?: string | null
    is_historical: boolean
    column_mapping: Record<string, string>
    stage_mapping?: Record<string, string>
    status_source_field?: string | null
}

/**
 * Upsert an import profile by name within the current company scope.
 * Useful flow: user finishes a successful import → "Save as profile" →
 * next time they pick the profile and skip Step 2 entirely.
 */
export async function saveImportProfile(
    input: SaveImportProfileInput,
): Promise<ActionResult<{ id: string }>> {
    if (!input.name?.trim()) {
        return { success: false, error: "Profile name is required" }
    }
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        const payload = {
            name: input.name.trim(),
            description: input.description ?? null,
            pipeline_id: input.pipeline_id ?? null,
            is_historical: input.is_historical,
            column_mapping: input.column_mapping ?? {},
            stage_mapping: input.stage_mapping ?? {},
            status_source_field: input.status_source_field ?? null,
            created_by: user?.id ?? null,
        }

        if (input.id) {
            const { error } = await supabase
                .from("import_profiles")
                .update(payload)
                .eq("id", input.id)
            if (error) return { success: false, error: error.message }
            revalidatePath("/", "layout")
            return { success: true, data: { id: input.id } }
        }

        const { data, error } = await supabase
            .from("import_profiles")
            .insert(payload)
            .select("id")
            .single()
        if (error) return { success: false, error: error.message }
        revalidatePath("/", "layout")
        return { success: true, data: { id: data.id } }
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
        }
    }
}

export async function deleteImportProfile(
    id: string,
): Promise<ActionResult<{ id: string }>> {
    if (!id) return { success: false, error: "id is required" }
    try {
        const supabase = await createClient()
        const { error } = await supabase
            .from("import_profiles")
            .delete()
            .eq("id", id)
        if (error) return { success: false, error: error.message }
        revalidatePath("/", "layout")
        return { success: true, data: { id } }
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
        }
    }
}
