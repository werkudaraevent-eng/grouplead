"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { announcementKeys } from "@/lib/announcements/announcements"
import type { ActionResult } from "@/types/action-result"
import { paths } from "@/lib/paths"
import { NO_ACCESS_MESSAGE } from "@/lib/brand"

async function guard(key: string) {
  const access = await getSalesMissionAccess()
  if (!access) return { error: NO_ACCESS_MESSAGE } as const
  if (!(await canPerform(access, "sales_mission_settings", "update"))) return { error: "Hanya admin Sales Activity yang mengatur pengumuman." } as const
  if (!announcementKeys().has(key)) return { error: "Pengumuman itu tidak dikenal." } as const
  return { access } as const
}

function refresh() {
  revalidatePath(paths.settings.announcements)
  revalidatePath(paths.workspace)
  revalidatePath(paths.whatsNew)
}

/** Switch one announcement on or off for the unit. Off never touches who has seen it. */
export async function setAnnouncementEnabled(key: string, enabled: boolean): Promise<ActionResult> {
  const guarded = await guard(key)
  if ("error" in guarded) return { success: false, error: guarded.error }
  const supabase = await createClient()
  const now = new Date().toISOString()
  const { error } = await supabase
    .schema("sales_mission")
    .from("release_announcements")
    .upsert({ company_id: guarded.access.companyId, key, enabled, updated_by: guarded.access.userId, updated_at: now }, { onConflict: "company_id,key" })
  if (error) return { success: false, error: "Pengaturan pengumuman tidak bisa disimpan." }
  refresh()
  return { success: true }
}

/**
 * Announce again: on, and stamped now, so every person's earlier "seen"
 * mark no longer matches and the dialog shows once more for everyone.
 */
export async function reannounce(key: string): Promise<ActionResult> {
  const guarded = await guard(key)
  if ("error" in guarded) return { success: false, error: guarded.error }
  const supabase = await createClient()
  const now = new Date().toISOString()
  const { error } = await supabase
    .schema("sales_mission")
    .from("release_announcements")
    .upsert({ company_id: guarded.access.companyId, key, enabled: true, announced_at: now, updated_by: guarded.access.userId, updated_at: now }, { onConflict: "company_id,key" })
  if (error) return { success: false, error: "Pengumuman tidak bisa diulang." }
  refresh()
  return { success: true }
}
