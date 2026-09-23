import { createClient } from "@/utils/supabase/server"
import { listSeenHints } from "@/lib/hints/hint-queries"
import {
  announcementStates,
  pendingAnnouncements,
  type AnnouncementRow,
  type AnnouncementState,
} from "./announcements"

/**
 * The admin's announcement switches applied to the code's announceable
 * releases. Every signed-in person may read public.release_announcements;
 * a failure (including the table not existing yet, when a deploy lands
 * before its migration) means "the defaults", which at worst announces what
 * the code meant to.
 */
export async function listAnnouncements(): Promise<AnnouncementState[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.from("release_announcements").select("key, enabled, announced_at")
    return announcementStates(error || !data ? [] : (data as AnnouncementRow[]))
  } catch {
    return announcementStates([])
  }
}

/**
 * What the dashboard's What's new dialog shows this person: on, not yet
 * closed by them, at most three. Never throws, so the dashboard can start it
 * alongside its own queries and await it last.
 */
export async function pendingAnnouncementsFor(userId: string | null | undefined): Promise<AnnouncementState[]> {
  if (!userId) return []
  try {
    const [states, seen] = await Promise.all([listAnnouncements(), listSeenHints(userId)])
    return pendingAnnouncements(states, new Set(seen))
  } catch {
    return []
  }
}
