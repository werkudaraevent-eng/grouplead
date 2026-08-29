"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { getSalesMissionAccess } from "@/lib/sales-mission-access"
import type { ActionResult } from "@/types/action-result"

/**
 * Marking notifications as read.
 *
 * Scoped to the caller by `recipient_id` as well as by RLS. The policy already
 * limits updates to your own rows; repeating it here keeps the intent visible
 * at the call site.
 */

export async function markNotificationRead(notificationId: string): Promise<ActionResult> {
  const access = await getSalesMissionAccess()
  if (!access) return { success: false, error: "Anda tidak punya akses Sales Mission." }

  const supabase = await createClient()
  const { error } = await supabase
    .schema("sales_mission")
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("recipient_id", access.userId)
    .is("read_at", null)

  if (error) return { success: false, error: "Gagal menandai notifikasi." }

  revalidatePath("/workspace/notifications")
  return { success: true }
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const access = await getSalesMissionAccess()
  if (!access) return { success: false, error: "Anda tidak punya akses Sales Mission." }

  const supabase = await createClient()
  const { error } = await supabase
    .schema("sales_mission")
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", access.userId)
    .is("read_at", null)

  if (error) return { success: false, error: "Gagal menandai notifikasi." }

  revalidatePath("/workspace/notifications")
  return { success: true }
}
