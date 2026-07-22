"use server"

/**
 * Server actions for the user_list_views table.
 *
 * Page-scoped saved views: each user can save their preferred filter +
 * sort + column setup per list page (contacts / companies / leads / etc).
 *
 * RLS handles ownership — the action only needs to scope by `page_key`
 * and let the database reject unauthorised reads/writes.
 */

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import type { ActionResult } from "@/types/action-result"

/* ────────────────────────────────────────────────────────────────── */

export interface SavedListViewRow {
    id: string
    name: string
    page_key: string
    is_default: boolean
    sort_order: number
    config: Record<string, unknown>
    created_at: string
    updated_at: string
}

interface ViewConfigInput {
    config: Record<string, unknown>
}

/* ────────────────────────────────────────────────────────────────── */

export async function listUserListViewsAction(
    pageKey: string,
): Promise<ActionResult<SavedListViewRow[]>> {
    try {
        const supabase = await createClient()
        const { data, error } = await supabase
            .from("user_list_views")
            .select("id, name, page_key, is_default, sort_order, config, created_at, updated_at")
            .eq("page_key", pageKey)
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true })

        if (error) return { success: false, error: error.message }
        return { success: true, data: (data as SavedListViewRow[]) ?? [] }
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "Unknown error" }
    }
}

/* ────────────────────────────────────────────────────────────────── */

export async function createUserListViewAction(
    pageKey: string,
    name: string,
    input: ViewConfigInput & { isDefault?: boolean },
): Promise<ActionResult<SavedListViewRow>> {
    try {
        const trimmed = name.trim()
        if (!trimmed) return { success: false, error: "View name is required." }

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: "Not authenticated." }

        // If marking default, unset previous default first.
        if (input.isDefault) {
            await supabase
                .from("user_list_views")
                .update({ is_default: false })
                .eq("user_id", user.id)
                .eq("page_key", pageKey)
                .eq("is_default", true)
        }

        const { data, error } = await supabase
            .from("user_list_views")
            .insert({
                user_id: user.id,
                page_key: pageKey,
                name: trimmed,
                config: input.config,
                is_default: input.isDefault ?? false,
            })
            .select("id, name, page_key, is_default, sort_order, config, created_at, updated_at")
            .single()

        if (error) return { success: false, error: error.message }
        revalidatePath("/")
        return { success: true, data: data as SavedListViewRow }
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "Unknown error" }
    }
}

/* ────────────────────────────────────────────────────────────────── */

export async function updateUserListViewAction(
    id: string,
    patch: { name?: string; config?: Record<string, unknown>; sort_order?: number },
): Promise<ActionResult<SavedListViewRow>> {
    try {
        const supabase = await createClient()
        const update: Record<string, unknown> = {}
        if (patch.name != null) {
            const trimmed = patch.name.trim()
            if (!trimmed) return { success: false, error: "Name cannot be empty." }
            update.name = trimmed
        }
        if (patch.config != null) update.config = patch.config
        if (patch.sort_order != null) update.sort_order = patch.sort_order

        if (Object.keys(update).length === 0) {
            return { success: false, error: "No fields to update." }
        }

        const { data, error } = await supabase
            .from("user_list_views")
            .update(update)
            .eq("id", id)
            .select("id, name, page_key, is_default, sort_order, config, created_at, updated_at")
            .single()

        if (error) return { success: false, error: error.message }
        return { success: true, data: data as SavedListViewRow }
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "Unknown error" }
    }
}

/* ────────────────────────────────────────────────────────────────── */

export async function setUserListViewDefaultAction(
    id: string,
    pageKey: string,
): Promise<ActionResult<true>> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: "Not authenticated." }

        // Atomic-ish: clear current default then set new one. RLS limits
        // these queries to the calling user's rows.
        const { error: clearErr } = await supabase
            .from("user_list_views")
            .update({ is_default: false })
            .eq("user_id", user.id)
            .eq("page_key", pageKey)
            .eq("is_default", true)
        if (clearErr) return { success: false, error: clearErr.message }

        const { error } = await supabase
            .from("user_list_views")
            .update({ is_default: true })
            .eq("id", id)
        if (error) return { success: false, error: error.message }

        return { success: true, data: true }
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "Unknown error" }
    }
}

/* ────────────────────────────────────────────────────────────────── */

export async function deleteUserListViewAction(id: string): Promise<ActionResult<true>> {
    try {
        const supabase = await createClient()
        const { error } = await supabase
            .from("user_list_views")
            .delete()
            .eq("id", id)
        if (error) return { success: false, error: error.message }
        return { success: true, data: true }
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "Unknown error" }
    }
}
