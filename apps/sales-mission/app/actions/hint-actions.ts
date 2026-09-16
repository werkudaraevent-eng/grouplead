"use server"

import { createClient } from "@/utils/supabase/server"
import { getSalesMissionAccess } from "@/lib/sales-mission-access"
import { HINT_KEY } from "@/lib/hints/hint-queries"
import type { ActionResult } from "@/types/action-result"
import { NO_ACCESS_MESSAGE } from "@/lib/brand"

/**
 * Record that this person has dismissed a coach mark, so it is not shown
 * again on any of their devices. Idempotent: seeing it twice is one row.
 */
export async function markHintSeen(key: string): Promise<ActionResult> {
  const access = await getSalesMissionAccess()
  if (!access) return { success: false, error: NO_ACCESS_MESSAGE }
  if (!HINT_KEY.test(key)) return { success: false, error: "Kunci panduan tidak dikenal." }

  const supabase = await createClient()
  const { error } = await supabase
    .schema("sales_mission")
    .from("user_hints")
    .upsert({ user_id: access.userId, key }, { onConflict: "user_id,key", ignoreDuplicates: true })
  if (error) return { success: false, error: "Tidak bisa menyimpan tanda sudah dibaca." }
  return { success: true }
}
