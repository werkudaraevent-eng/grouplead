"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createServiceClient } from "@/utils/supabase/service"
import { requirePermission } from "@/lib/require-permission"
import { announcementKeys } from "@/lib/announcements/announcements"
import type { ActionResult } from "@/types/action-result"

/**
 * Settings → Announcements writes. public.release_announcements is readable
 * by every signed-in person (the dialog needs to know what is on) and has no
 * write policy: a write happens here, with the service client, only after
 * the settings.update grant, the same arrangement as the AI settings.
 */

const keySchema = z.string().refine((key) => announcementKeys().has(key), "Unknown announcement.")
const toggleSchema = z.object({ key: keySchema, enabled: z.boolean() })
const reannounceSchema = z.object({ key: keySchema })

const MISSING_TABLE = "Announcements are not set up in the database yet. Apply migration 20260923110000 first."

/** The table is not there yet: the deploy landed before its migration. */
function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205"
}

function refresh() {
  revalidatePath("/settings/announcements")
  revalidatePath("/")
}

/** Switch one announcement on or off for everyone. Off never touches who has seen it. */
export async function setAnnouncementEnabled(input: unknown): Promise<ActionResult> {
  const guard = await requirePermission("settings", "update")
  if (!guard.allowed) return guard.error

  const parsed = toggleSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: "Unknown announcement." }

  try {
    const now = new Date().toISOString()
    // announced_at is left out on purpose: a first switch inserts null (the
    // release date stays the stamp) and a later one keeps the stored stamp,
    // so switching back on never repeats the dialog for people who closed it.
    const { error } = await createServiceClient()
      .from("release_announcements")
      .upsert(
        { key: parsed.data.key, enabled: parsed.data.enabled, updated_by: guard.userId, updated_at: now },
        { onConflict: "key" },
      )
    if (error) {
      console.error("[setAnnouncementEnabled]", error)
      return { success: false, error: isMissingTable(error) ? MISSING_TABLE : "The announcement setting could not be saved." }
    }
  } catch (error) {
    console.error("[setAnnouncementEnabled]", error)
    return { success: false, error: "The announcement setting could not be saved." }
  }
  refresh()
  return { success: true }
}

/**
 * Announce again: on, and stamped now, so every person's earlier seen mark
 * no longer matches and the dialog shows once more for everyone.
 */
export async function reannounce(input: unknown): Promise<ActionResult<{ announcedAt: string }>> {
  const guard = await requirePermission("settings", "update")
  if (!guard.allowed) return guard.error

  const parsed = reannounceSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: "Unknown announcement." }

  const now = new Date().toISOString()
  try {
    const { error } = await createServiceClient()
      .from("release_announcements")
      .upsert(
        { key: parsed.data.key, enabled: true, announced_at: now, updated_by: guard.userId, updated_at: now },
        { onConflict: "key" },
      )
    if (error) {
      console.error("[reannounce]", error)
      return { success: false, error: isMissingTable(error) ? MISSING_TABLE : "The announcement could not be sent again." }
    }
  } catch (error) {
    console.error("[reannounce]", error)
    return { success: false, error: "The announcement could not be sent again." }
  }
  refresh()
  return { success: true, data: { announcedAt: now } }
}
