"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"

export type ActionResult = { success: boolean; error?: string }

export async function createLeadAction(
    data: Record<string, unknown>
): Promise<ActionResult> {
    try {
        const supabase = await createClient()

        // Clean payload — strip undefined, convert empty strings to null
        const payload: Record<string, unknown> = {}
        for (const [key, val] of Object.entries(data)) {
            if (val === undefined) continue
            payload[key] = val === "" ? null : val
        }

        const { error } = await supabase.from("leads").insert(payload)
        if (error) return { success: false, error: error.message }

        revalidatePath("/")
        return { success: true }
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
        }
    }
}

export async function updateLeadAction(
    leadId: number,
    data: Record<string, unknown>
): Promise<ActionResult> {
    try {
        const supabase = await createClient()

        const payload: Record<string, unknown> = {}
        for (const [key, val] of Object.entries(data)) {
            if (val === undefined) continue
            payload[key] = val === "" ? null : val
        }

        const { error } = await supabase
            .from("leads")
            .update(payload)
            .eq("id", leadId)

        if (error) return { success: false, error: error.message }

        revalidatePath("/")
        return { success: true }
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
        }
    }
}

export async function updatePipelineStageAction(
    leadId: number,
    stageId: string
): Promise<ActionResult> {
    try {
        const supabase = await createClient()

        const { error } = await supabase
            .from("leads")
            .update({ pipeline_stage_id: stageId })
            .eq("id", leadId)

        if (error) return { success: false, error: error.message }

        revalidatePath("/")
        return { success: true }
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
        }
    }
}

export async function deleteLeadAction(
    leadId: number
): Promise<ActionResult> {
    try {
        const supabase = await createClient()

        const { error } = await supabase
            .from("leads")
            .delete()
            .eq("id", leadId)

        if (error) return { success: false, error: error.message }

        revalidatePath("/")
        return { success: true }
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
        }
    }
}
