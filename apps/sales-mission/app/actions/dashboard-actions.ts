"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { layoutSchema, mergeLayout } from "@/lib/reporting/dashboard-layout"
import type { ActionResult } from "@/types/action-result"
import { paths } from "@/lib/paths"
import { NO_ACCESS_MESSAGE } from "@/lib/brand"

/**
 * The person's Ringkasan arrangement. Validated, then normalised against
 * today's built-ins before it is stored, so the row never holds an id
 * the page would not know what to do with.
 */
export async function saveDashboardLayout(input: unknown): Promise<ActionResult> {
  const access = await getSalesMissionAccess()
  if (!access) return { success: false, error: NO_ACCESS_MESSAGE }

  const parsed = layoutSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Susunan widget tidak valid." }

  const canSeeProspects = await canPerform(access, "sales_mission_prospect", "read")
  const layout = mergeLayout(parsed.data, { canSeeProspects })

  const supabase = await createClient()
  const { error } = await supabase
    .schema("sales_mission")
    .from("user_dashboards")
    .upsert({ user_id: access.userId, company_id: access.companyId, layout, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
  if (error) {
    console.error("[saveDashboardLayout]", error.code, error.message)
    return { success: false, error: "Susunan widget tidak bisa disimpan." }
  }
  revalidatePath(paths.reportSummary())
  return { success: true }
}

/** Back to the default arrangement: the row goes, the built-ins return in their own order. */
export async function resetDashboardLayout(): Promise<ActionResult> {
  const access = await getSalesMissionAccess()
  if (!access) return { success: false, error: NO_ACCESS_MESSAGE }
  const supabase = await createClient()
  const { error } = await supabase.schema("sales_mission").from("user_dashboards").delete().eq("user_id", access.userId)
  if (error) return { success: false, error: "Susunan widget tidak bisa dikembalikan." }
  revalidatePath(paths.reportSummary())
  return { success: true }
}
