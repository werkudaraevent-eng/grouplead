"use server"

import { z } from "zod"
import { createClient } from "@/utils/supabase/server"
import { HINT_KEY } from "@/lib/hints/hint-key"
import type { ActionResult } from "@/types/action-result"

const keysSchema = z.array(z.string().regex(HINT_KEY)).min(1).max(10)

/**
 * Record that this person has closed a one-time surface (the What's new
 * dialog), so it is not shown again on any of their devices. Idempotent:
 * closing it twice is one row. Written as the person, under RLS (own rows
 * only), so it needs no permission check beyond being signed in.
 */
export async function markHintsSeen(keys: unknown): Promise<ActionResult> {
  const parsed = keysSchema.safeParse(keys)
  if (!parsed.success) return { success: false, error: "Unknown hint." }

  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    const userId = data?.user?.id
    if (!userId) return { success: false, error: "Not authenticated" }

    const rows = [...new Set(parsed.data)].map((key) => ({ user_id: userId, key }))
    const { error } = await supabase
      .from("user_hints")
      .upsert(rows, { onConflict: "user_id,key", ignoreDuplicates: true })
    if (error) return { success: false, error: "Could not save that you have seen it." }
    return { success: true }
  } catch {
    return { success: false, error: "Could not save that you have seen it." }
  }
}
