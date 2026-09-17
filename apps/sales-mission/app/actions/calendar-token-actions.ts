"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { canPerform, getReadScope, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { generateCalendarToken } from "@/lib/calendar/calendar-token"
import type { FeedScope } from "@/lib/calendar/calendar-feed-queries"
import { paths } from "@/lib/paths"
import type { ActionResult } from "@/types/action-result"
import { NO_ACCESS_MESSAGE } from "@/lib/brand"

/**
 * A person's calendar feed links: one for their own visits, one for the
 * team's when their role may see beyond their own. One active link per
 * scope; making a new one retires the old, and the plaintext is returned
 * exactly once.
 */

async function authorize(scope: FeedScope) {
  const access = await getSalesMissionAccess()
  if (!access) return { error: NO_ACCESS_MESSAGE }
  if (!(await canPerform(access, "sales_mission_mission", "read"))) {
    return { error: "Peran Anda tidak mencakup jadwal kunjungan, jadi tidak ada yang bisa dilanggan." as const }
  }
  if (scope === "team" && (await getReadScope(access, "sales_mission_mission")) === "own") {
    return { error: "Cakupan lihat peran Anda hanya aktivitas sendiri, jadi tidak ada kalender tim." as const }
  }
  return { access }
}

const isScope = (value: unknown): value is FeedScope => value === "own" || value === "team"

export async function createCalendarToken(scopeInput: unknown = "own"): Promise<ActionResult<{ token: string }>> {
  const scope: FeedScope = isScope(scopeInput) ? scopeInput : "own"
  const guard = await authorize(scope)
  if ("error" in guard) return { success: false, error: guard.error }
  const { access } = guard

  const supabase = await createClient()
  const schema = supabase.schema("sales_mission")
  const nowIso = new Date().toISOString()

  // The old link of this scope stops the moment the new one exists: a phone
  // that kept the old URL must not keep reading, or "buat tautan baru"
  // would mean nothing.
  const retired = await schema.from("calendar_tokens").update({ revoked_at: nowIso }).eq("user_id", access.userId).eq("scope", scope).is("revoked_at", null)
  if (retired.error) return { success: false, error: "Tautan lama gagal dihentikan." }

  const { token, hash } = generateCalendarToken()
  const { error } = await schema.from("calendar_tokens").insert({
    user_id: access.userId,
    company_id: access.companyId,
    token_hash: hash,
    scope,
  })
  if (error) return { success: false, error: "Tautan gagal dibuat." }

  revalidatePath(paths.myCalendar)
  return { success: true, data: { token } }
}

export async function revokeCalendarToken(scopeInput: unknown = "own"): Promise<ActionResult> {
  const scope: FeedScope = isScope(scopeInput) ? scopeInput : "own"
  const guard = await authorize(scope)
  if ("error" in guard) return { success: false, error: guard.error }

  const supabase = await createClient()
  const { error } = await supabase
    .schema("sales_mission")
    .from("calendar_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", guard.access.userId)
    .eq("scope", scope)
    .is("revoked_at", null)
  if (error) return { success: false, error: "Tautan gagal dicabut." }

  revalidatePath(paths.myCalendar)
  return { success: true }
}
