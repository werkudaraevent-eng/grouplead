"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import type { ActionResult } from "@/types/action-result"
import type { DashboardView, DashboardViewInput } from "@/types/dashboard-view"

const MAX_VIEWS_PER_USER = 20

/**
 * List all dashboard views for the current user, sorted by sort_order then name.
 * Ensures at least one view exists (creates a "My Dashboard" default on first call).
 */
export async function listDashboardViewsAction(): Promise<ActionResult<DashboardView[]>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Not authenticated" }

  const { data, error } = await supabase
    .from("user_dashboard_views")
    .select("*")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })

  if (error) return { success: false, error: error.message }

  // First-time user: no views yet. Create an empty default so the UI always has one.
  if (!data || data.length === 0) {
    const { data: created, error: createErr } = await supabase
      .from("user_dashboard_views")
      .insert({
        user_id: user.id,
        name: "My Dashboard",
        layout_data: [],
        hidden_widgets: [],
        filters: {},
        is_default: true,
        sort_order: 0,
      })
      .select()
      .single()

    if (createErr) return { success: false, error: createErr.message }
    return { success: true, data: [created as DashboardView] }
  }

  // Guarantee exactly one default. If none is marked default, promote the first.
  const hasDefault = data.some(v => v.is_default)
  if (!hasDefault && data.length > 0) {
    await supabase
      .from("user_dashboard_views")
      .update({ is_default: true })
      .eq("id", data[0].id)
      .eq("user_id", user.id)
    data[0].is_default = true
  }

  return { success: true, data: data as DashboardView[] }
}

/**
 * Create a new dashboard view. Enforces per-user max to avoid unbounded growth.
 */
export async function createDashboardViewAction(
  input: DashboardViewInput,
): Promise<ActionResult<DashboardView>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Not authenticated" }

  const name = input.name.trim()
  if (!name) return { success: false, error: "Name is required" }
  if (name.length > 60) return { success: false, error: "Name must be 60 characters or fewer" }

  const { count } = await supabase
    .from("user_dashboard_views")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)

  if ((count ?? 0) >= MAX_VIEWS_PER_USER) {
    return { success: false, error: `Maximum of ${MAX_VIEWS_PER_USER} views reached. Delete one first.` }
  }

  // If this is being created as default, demote any existing default first.
  if (input.is_default) {
    await supabase
      .from("user_dashboard_views")
      .update({ is_default: false })
      .eq("user_id", user.id)
      .eq("is_default", true)
  }

  const { data, error } = await supabase
    .from("user_dashboard_views")
    .insert({
      user_id: user.id,
      name,
      layout_data: input.layout_data,
      hidden_widgets: input.hidden_widgets,
      filters: input.filters,
      is_default: input.is_default ?? false,
      sort_order: count ?? 0,
    })
    .select()
    .single()

  if (error) return { success: false, error: error.message }
  revalidatePath("/")
  return { success: true, data: data as DashboardView }
}

/**
 * Update an existing view. Only fields present on `input` (besides id) are written.
 */
export async function updateDashboardViewAction(
  input: DashboardViewInput & { id: string },
): Promise<ActionResult<DashboardView>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Not authenticated" }

  const name = input.name.trim()
  if (!name) return { success: false, error: "Name is required" }
  if (name.length > 60) return { success: false, error: "Name must be 60 characters or fewer" }

  const { data, error } = await supabase
    .from("user_dashboard_views")
    .update({
      name,
      layout_data: input.layout_data,
      hidden_widgets: input.hidden_widgets,
      filters: input.filters,
    })
    .eq("id", input.id)
    .eq("user_id", user.id)
    .select()
    .single()

  if (error) return { success: false, error: error.message }
  revalidatePath("/")
  return { success: true, data: data as DashboardView }
}

/**
 * Rename a view without touching layout/filters.
 */
export async function renameDashboardViewAction(
  id: string,
  newName: string,
): Promise<ActionResult<DashboardView>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Not authenticated" }

  const name = newName.trim()
  if (!name) return { success: false, error: "Name is required" }
  if (name.length > 60) return { success: false, error: "Name must be 60 characters or fewer" }

  const { data, error } = await supabase
    .from("user_dashboard_views")
    .update({ name })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single()

  if (error) return { success: false, error: error.message }
  revalidatePath("/")
  return { success: true, data: data as DashboardView }
}

/**
 * Mark one view as default. The partial unique index will auto-demote the previous
 * default via two-step update to avoid index conflicts.
 */
export async function setDefaultDashboardViewAction(
  id: string,
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Not authenticated" }

  // 1. Demote current default (if any).
  const { error: demoteErr } = await supabase
    .from("user_dashboard_views")
    .update({ is_default: false })
    .eq("user_id", user.id)
    .eq("is_default", true)

  if (demoteErr) return { success: false, error: demoteErr.message }

  // 2. Promote target.
  const { error: promoteErr } = await supabase
    .from("user_dashboard_views")
    .update({ is_default: true })
    .eq("id", id)
    .eq("user_id", user.id)

  if (promoteErr) return { success: false, error: promoteErr.message }
  revalidatePath("/")
  return { success: true }
}

/**
 * Duplicate an existing view. Name is "<original> (copy)".
 */
export async function duplicateDashboardViewAction(
  id: string,
): Promise<ActionResult<DashboardView>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Not authenticated" }

  const { data: source, error: fetchErr } = await supabase
    .from("user_dashboard_views")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (fetchErr || !source) return { success: false, error: fetchErr?.message ?? "View not found" }

  const { count } = await supabase
    .from("user_dashboard_views")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)

  if ((count ?? 0) >= MAX_VIEWS_PER_USER) {
    return { success: false, error: `Maximum of ${MAX_VIEWS_PER_USER} views reached.` }
  }

  const copyName = `${source.name} (copy)`.slice(0, 60)

  const { data, error } = await supabase
    .from("user_dashboard_views")
    .insert({
      user_id: user.id,
      name: copyName,
      layout_data: source.layout_data,
      hidden_widgets: source.hidden_widgets,
      filters: source.filters,
      is_default: false,
      sort_order: count ?? 0,
    })
    .select()
    .single()

  if (error) return { success: false, error: error.message }
  revalidatePath("/")
  return { success: true, data: data as DashboardView }
}

/**
 * Delete a view. If the deleted view was default and other views exist,
 * auto-promote the next one (lowest sort_order) as default so the user
 * always has a valid default to return to.
 */
export async function deleteDashboardViewAction(
  id: string,
): Promise<ActionResult<{ newDefaultId?: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Not authenticated" }

  const { data: target, error: fetchErr } = await supabase
    .from("user_dashboard_views")
    .select("id, is_default")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (fetchErr || !target) return { success: false, error: fetchErr?.message ?? "View not found" }

  const { error: delErr } = await supabase
    .from("user_dashboard_views")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)

  if (delErr) return { success: false, error: delErr.message }

  let newDefaultId: string | undefined

  if (target.is_default) {
    const { data: remaining } = await supabase
      .from("user_dashboard_views")
      .select("id")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (remaining) {
      await supabase
        .from("user_dashboard_views")
        .update({ is_default: true })
        .eq("id", remaining.id)
        .eq("user_id", user.id)
      newDefaultId = remaining.id
    }
  }

  revalidatePath("/")
  return { success: true, data: { newDefaultId } }
}
