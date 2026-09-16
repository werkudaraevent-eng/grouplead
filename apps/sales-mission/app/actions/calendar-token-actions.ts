"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { generateCalendarToken } from "@/lib/calendar/calendar-token"
import { paths } from "@/lib/paths"
import type { ActionResult } from "@/types/action-result"
import { NO_ACCESS_MESSAGE } from "@/lib/brand"

/**
 * A person's own calendar feed link. One active link per person; making a
 * new one retires the old, and the plaintext is returned exactly once.
 */

async function authorize() {
  const access = await getSalesMissionAccess()
  if (!access) return { error: NO_ACCESS_MESSAGE }
  if (!(await canPerform(access, "sales_mission_mission", "read"))) {
    return { error: "Peran Anda tidak mencakup jadwal kunjungan, jadi tidak ada yang bisa dilanggan." as const }
  }
  return { access }
}

export async function createCalendarToken(): Promise<ActionResult<{ token: string }>> {
  const guard = await authorize()
  if ("error" in guard) return { success: false, error: guard.error }
  const { access } = guard

  const supabase = await createClient()
  const schema = supabase.schema("sales_mission")
  const nowIso = new Date().toISOString()

  // The old link stops the moment the new one exists: a phone that kept the
  // old URL must not keep reading, or "buat tautan baru" would mean nothing.
  const retired = await schema.from("calendar_tokens").update({ revoked_at: nowIso }).eq("user_id", access.userId).is("revoked_at", null)
  if (retired.error) return { success: false, error: "Tautan lama gagal dihentikan." }

  const { token, hash } = generateCalendarToken()
  const { error } = await schema.from("calendar_tokens").insert({
    user_id: access.userId,
    company_id: access.companyId,
    token_hash: hash,
  })
  if (error) return { success: false, error: "Tautan gagal dibuat." }

  revalidatePath(paths.myCalendar)
  return { success: true, data: { token } }
}

export async function revokeCalendarToken(): Promise<ActionResult> {
  const guard = await authorize()
  if ("error" in guard) return { success: false, error: guard.error }

  const supabase = await createClient()
  const { error } = await supabase
    .schema("sales_mission")
    .from("calendar_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", guard.access.userId)
    .is("revoked_at", null)
  if (error) return { success: false, error: "Tautan gagal dicabut." }

  revalidatePath(paths.myCalendar)
  return { success: true }
}
