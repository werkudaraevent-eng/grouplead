"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/utils/supabase/server"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import type { ActionResult } from "@/types/action-result"
import { paths } from "@/lib/paths"
import { NO_ACCESS_MESSAGE } from "@/lib/brand"

const settingsSchema = z.object({
  conflictCheckEnabled: z.boolean(),
  travelBufferMinutes: z.number().int().min(0).max(480),
  allowSameLocationBackToBack: z.boolean(),
  maxSupporting: z.number().int().min(0).max(20),
  requireAssignmentConfirmation: z.boolean(),
  primaryCanReschedule: z.boolean(),
  reportEditWindowDays: z.number().int().min(0, "Minimal 0 hari").max(365, "Maksimal 365 hari"),
  reportAfterVisitOnly: z.boolean(),
  /** Empty means the app's default line. */
  whatsappGreeting: z.string().trim().max(500, "Maksimal 500 karakter"),
  /** Empty means the app's default template. */
  reportShareTemplate: z.string().trim().max(2000, "Maksimal 2000 karakter"),
  reportSharePrompt: z.boolean(),
  contactDiscEnabled: z.boolean(),
  aiInsightsEnabled: z.boolean(),
  aiInsightsHour: z.number().int().min(0, "Jam antara 0 dan 23").max(23, "Jam antara 0 dan 23"),
  aiAskEnabled: z.boolean(),
})

export type MissionSettingsInput = z.infer<typeof settingsSchema>

/**
 * Save the tenant's mission rules.
 *
 * One row per tenant, upserted. The bounds mirror the CHECK constraints on the
 * table, so a bad value is refused with a sentence rather than a constraint
 * name.
 */
export async function updateMissionSettings(input: unknown): Promise<ActionResult> {
  const access = await getSalesMissionAccess()
  if (!access) return { success: false, error: NO_ACCESS_MESSAGE }
  if (!(await canPerform(access, "sales_mission_settings", "update"))) {
    return { success: false, error: "Anda tidak punya izin mengubah pengaturan aktivitas." }
  }

  const parsed = settingsSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Pengaturan tidak valid." }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .schema("sales_mission")
    .from("mission_settings")
    .upsert(
      {
        company_id: access.companyId,
        conflict_check_enabled: parsed.data.conflictCheckEnabled,
        default_travel_buffer_minutes: parsed.data.travelBufferMinutes,
        allow_same_location_back_to_back: parsed.data.allowSameLocationBackToBack,
        max_supporting_per_mission: parsed.data.maxSupporting,
        require_assignment_confirmation: parsed.data.requireAssignmentConfirmation,
        primary_can_reschedule: parsed.data.primaryCanReschedule,
        report_edit_window_days: parsed.data.reportEditWindowDays,
        report_after_visit_only: parsed.data.reportAfterVisitOnly,
        whatsapp_greeting: parsed.data.whatsappGreeting || null,
        report_share_template: parsed.data.reportShareTemplate || null,
        report_share_prompt: parsed.data.reportSharePrompt,
        contact_disc_enabled: parsed.data.contactDiscEnabled,
        ai_insights_enabled: parsed.data.aiInsightsEnabled,
        ai_insights_hour: parsed.data.aiInsightsHour,
        ai_ask_enabled: parsed.data.aiAskEnabled,
        updated_by: access.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_id" }
    )

  if (error) {
    // The admin is the one person who can act on the real reason (a stale
    // API schema, a constraint), so it is said in the toast, not only logged.
    console.error("[updateMissionSettings]", error.code, error.message, error.details ?? "")
    return { success: false, error: `Pengaturan gagal disimpan: ${error.message}` }
  }

  revalidatePath("/workspace")
  revalidatePath(paths.activities())
  revalidatePath("/workspace/calendar")
  revalidatePath(paths.settings.activities)
  revalidatePath(paths.prospects)
  return { success: true }
}
