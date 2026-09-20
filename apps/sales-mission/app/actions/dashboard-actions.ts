"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { layoutSchema, mergeLayout } from "@/lib/reporting/dashboard-layout"
import { canSeeInsight } from "@/lib/ai/insight-view"
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

  const [canSeeProspects, insight] = await Promise.all([canPerform(access, "sales_mission_prospect", "read"), canSeeInsight(access)])
  const layout = mergeLayout(parsed.data, { canSeeProspects, canSeeInsight: insight })

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

/**
 * The caller's own arrangement becomes the unit's default: everyone who
 * has not arranged their own board sees it from now on, and "Kembali ke
 * susunan awal" returns to it. Pengaturan → ubah, because it reaches
 * every account.
 */
export async function publishDashboardDefault(): Promise<ActionResult> {
  const access = await getSalesMissionAccess()
  if (!access) return { success: false, error: NO_ACCESS_MESSAGE }
  if (!(await canPerform(access, "sales_mission_settings", "update"))) {
    return { success: false, error: "Hanya admin yang bisa menjadikan susunan ini bawaan semua akun." }
  }
  const supabase = await createClient()
  const schema = supabase.schema("sales_mission")
  const { data: own, error: readError } = await schema.from("user_dashboards").select("layout").eq("user_id", access.userId).maybeSingle()
  if (readError) return { success: false, error: "Susunan Anda tidak bisa dibaca." }
  if (!own?.layout) return { success: false, error: "Susun dulu widget di akun Anda; belum ada susunan yang tersimpan." }

  const [canSeeProspects, insight] = await Promise.all([canPerform(access, "sales_mission_prospect", "read"), canSeeInsight(access)])
  const layout = mergeLayout(own.layout, { canSeeProspects, canSeeInsight: insight })
  const { error } = await schema
    .from("company_dashboards")
    .upsert({ company_id: access.companyId, layout, set_by: access.userId, updated_at: new Date().toISOString() }, { onConflict: "company_id" })
  if (error) {
    console.error("[publishDashboardDefault]", error.code, error.message)
    return { success: false, error: "Susunan bawaan tidak bisa disimpan." }
  }
  revalidatePath(paths.reportSummary())
  return { success: true }
}

/** Back to the default arrangement: the person's row goes; the unit's default, or the built-ins, return. */
export async function resetDashboardLayout(): Promise<ActionResult> {
  const access = await getSalesMissionAccess()
  if (!access) return { success: false, error: NO_ACCESS_MESSAGE }
  const supabase = await createClient()
  const { error } = await supabase.schema("sales_mission").from("user_dashboards").delete().eq("user_id", access.userId)
  if (error) return { success: false, error: "Susunan widget tidak bisa dikembalikan." }
  revalidatePath(paths.reportSummary())
  return { success: true }
}
