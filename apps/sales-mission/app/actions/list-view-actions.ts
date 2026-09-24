"use server"

import { z } from "zod"
import { createClient } from "@/utils/supabase/server"
import { canPerform, getSalesMissionAccess, type SalesMissionAccess } from "@/lib/sales-mission-access"
import {
  listKeySchema,
  normalizeViewConfig,
  viewConfigSchema,
  viewNameSchema,
  type SavedListKey,
  type SavedListView,
} from "@/lib/lists/list-views"
import type { ActionResult } from "@/types/action-result"
import { NO_ACCESS_MESSAGE } from "@/lib/brand"

/**
 * Saved views of the Aktivitas, Prospek and Laporan lists: one person's
 * own named URLs (see lib/lists/list-views.ts).
 *
 * Everything goes through the session client, so row security is the
 * boundary (own rows, own unit); the explicit user and unit filters are
 * there for the index and for a clear "not found". The config is cleaned
 * through the list's own parser before it is stored, so a view can never
 * hold anything the list's URL could not. Before the table's migration
 * every write fails with a sentence, and the page hides the save control
 * anyway (`listSavedViews` reports it unavailable).
 */

const MODULE_OF: Record<SavedListKey, "sales_mission_mission" | "sales_mission_prospect" | "sales_mission_result"> = {
  activities: "sales_mission_mission",
  prospects: "sales_mission_prospect",
  reports: "sales_mission_result",
}

const NOT_READY = "Tampilan tersimpan belum tersedia. Minta admin menjalankan pembaruan database terbaru."

const createSchema = z.object({
  list: listKeySchema,
  name: viewNameSchema,
  config: viewConfigSchema,
  isDefault: z.boolean().optional(),
})

const updateSchema = z.object({
  id: z.string().uuid("Tampilan tidak ditemukan."),
  list: listKeySchema,
  name: viewNameSchema.optional(),
  config: viewConfigSchema.optional(),
})

const defaultSchema = z.object({
  id: z.string().uuid("Tampilan tidak ditemukan."),
  list: listKeySchema,
  isDefault: z.boolean(),
})

const idSchema = z.object({
  id: z.string().uuid("Tampilan tidak ditemukan."),
  list: listKeySchema,
})

type Row = { id: string; name: string | null; is_default: boolean | null; config: unknown }

function toView(list: SavedListKey, row: Row): SavedListView {
  return { id: row.id, name: row.name ?? "Tampilan", isDefault: row.is_default === true, config: normalizeViewConfig(list, row.config) }
}

async function gate(list: SavedListKey): Promise<{ access: SalesMissionAccess } | { error: string }> {
  const access = await getSalesMissionAccess()
  if (!access) return { error: NO_ACCESS_MESSAGE }
  if (!(await canPerform(access, MODULE_OF[list], "read"))) return { error: "Anda tidak punya akses ke daftar ini." }
  return { access }
}

function writeError(label: string, error: { code?: string; message: string }): string {
  console.error(`[${label}]`, error.code, error.message)
  if (error.code === "23505") return "Nama itu sudah dipakai tampilan lain di daftar ini."
  if (error.code === "42P01" || error.code === "PGRST205" || error.code === "PGRST106") return NOT_READY
  return "Tampilan tidak bisa disimpan. Coba lagi."
}

const firstIssue = (error: z.ZodError, fallback: string) => error.issues[0]?.message ?? fallback

/** Save what the screen shows under a new name. */
export async function createListView(input: unknown): Promise<ActionResult<SavedListView>> {
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: firstIssue(parsed.error, "Tampilan tidak valid.") }
  const { list, name, isDefault } = parsed.data
  const g = await gate(list)
  if ("error" in g) return { success: false, error: g.error }
  const config = normalizeViewConfig(list, parsed.data.config)

  const supabase = await createClient()
  const views = supabase.schema("sales_mission").from("list_views")
  if (isDefault) {
    const { error } = await views
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq("user_id", g.access.userId)
      .eq("company_id", g.access.companyId)
      .eq("list_key", list)
      .eq("is_default", true)
    if (error) return { success: false, error: writeError("createListView", error) }
  }
  const { data, error } = await views
    .insert({ company_id: g.access.companyId, user_id: g.access.userId, list_key: list, name, config, is_default: isDefault === true })
    .select("id, name, is_default, config")
    .single()
  if (error || !data) return { success: false, error: error ? writeError("createListView", error) : "Tampilan tidak bisa disimpan." }
  return { success: true, data: toView(list, data as Row) }
}

/** Rename a view, or write the screen's view into it ("Simpan perubahan"). */
export async function updateListView(input: unknown): Promise<ActionResult<SavedListView>> {
  const parsed = updateSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: firstIssue(parsed.error, "Tampilan tidak valid.") }
  const { id, list, name, config } = parsed.data
  if (name === undefined && config === undefined) return { success: false, error: "Tidak ada yang diubah." }
  const g = await gate(list)
  if ("error" in g) return { success: false, error: g.error }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (name !== undefined) patch.name = name
  if (config !== undefined) patch.config = normalizeViewConfig(list, config)
  const supabase = await createClient()
  const { data, error } = await supabase
    .schema("sales_mission")
    .from("list_views")
    .update(patch)
    .eq("id", id)
    .eq("user_id", g.access.userId)
    .eq("company_id", g.access.companyId)
    .eq("list_key", list)
    .select("id, name, is_default, config")
    .maybeSingle()
  if (error) return { success: false, error: writeError("updateListView", error) }
  if (!data) return { success: false, error: "Tampilan tidak ditemukan." }
  return { success: true, data: toView(list, data as Row) }
}

/** Make a view the list's default, or stop it being one. One default per list. */
export async function setListViewDefault(input: unknown): Promise<ActionResult> {
  const parsed = defaultSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: firstIssue(parsed.error, "Tampilan tidak valid.") }
  const { id, list, isDefault } = parsed.data
  const g = await gate(list)
  if ("error" in g) return { success: false, error: g.error }

  const supabase = await createClient()
  const views = supabase.schema("sales_mission").from("list_views")
  const now = new Date().toISOString()
  // Clear the old default first: the unique index allows one per list.
  if (isDefault) {
    const { error } = await views
      .update({ is_default: false, updated_at: now })
      .eq("user_id", g.access.userId)
      .eq("company_id", g.access.companyId)
      .eq("list_key", list)
      .eq("is_default", true)
      .neq("id", id)
    if (error) return { success: false, error: writeError("setListViewDefault", error) }
  }
  const { data, error } = await views
    .update({ is_default: isDefault, updated_at: now })
    .eq("id", id)
    .eq("user_id", g.access.userId)
    .eq("company_id", g.access.companyId)
    .eq("list_key", list)
    .select("id")
    .maybeSingle()
  if (error) return { success: false, error: writeError("setListViewDefault", error) }
  if (!data) return { success: false, error: "Tampilan tidak ditemukan." }
  return { success: true }
}

/**
 * Throw a view away. One person's own shortcut, so nothing to confirm: the
 * snackbar's "Batalkan" puts it back from what this returns.
 */
export async function deleteListView(input: unknown): Promise<ActionResult<SavedListView>> {
  const parsed = idSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: firstIssue(parsed.error, "Tampilan tidak ditemukan.") }
  const { id, list } = parsed.data
  const g = await gate(list)
  if ("error" in g) return { success: false, error: g.error }

  const supabase = await createClient()
  const { data, error } = await supabase
    .schema("sales_mission")
    .from("list_views")
    .delete()
    .eq("id", id)
    .eq("user_id", g.access.userId)
    .eq("company_id", g.access.companyId)
    .eq("list_key", list)
    .select("id, name, is_default, config")
    .maybeSingle()
  if (error) {
    console.error("[deleteListView]", error.code, error.message)
    return { success: false, error: "Tampilan tidak bisa dihapus." }
  }
  if (!data) return { success: false, error: "Tampilan tidak ditemukan." }
  return { success: true, data: toView(list, data as Row) }
}
