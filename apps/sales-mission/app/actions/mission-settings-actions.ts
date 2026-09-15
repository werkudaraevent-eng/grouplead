"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/utils/supabase/server"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import type { ActionResult } from "@/types/action-result"

const settingsSchema = z.object({
  conflictCheckEnabled: z.boolean(),
  travelBufferMinutes: z.number().int().min(0).max(480),
  allowSameLocationBackToBack: z.boolean(),
  maxSupporting: z.number().int().min(0).max(20),
  requireAssignmentConfirmation: z.boolean(),
  primaryCanReschedule: z.boolean(),
  reportEditWindowDays: z.number().int().min(0, "Minimal 0 hari").max(365, "Maksimal 365 hari"),
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
  if (!access) return { success: false, error: "Anda tidak punya akses Sales Mission." }
  if (!(await canPerform(access, "sales_mission_settings", "update"))) {
    return { success: false, error: "Anda tidak punya izin mengubah pengaturan mission." }
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
        updated_by: access.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_id" }
    )

  if (error) return { success: false, error: "Pengaturan gagal disimpan." }

  revalidatePath("/workspace")
  revalidatePath("/workspace/missions")
  revalidatePath("/workspace/calendar")
  revalidatePath("/workspace/settings/missions")
  return { success: true }
}
