import { createClient } from "@/utils/supabase/server"

/**
 * The seen marks this person has left, on any device (public.user_hints,
 * own rows only by RLS).
 *
 * Read on the server and handed to the client, so a one-time surface decides
 * synchronously whether to appear. A failure (including the table not
 * existing yet, when a deploy lands before its migration) means "seen
 * nothing", which at worst repeats a dialog once.
 */
export async function listSeenHints(userId: string): Promise<string[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.from("user_hints").select("key").eq("user_id", userId)
    if (error || !data) return []
    return data.map((row) => row.key as string)
  } catch {
    return []
  }
}

/**
 * Whether the signed-in person has left the seen mark `key` (a list's
 * dismissed description). Read on the server so the page's first render is
 * already right; any failure means "not seen", which at worst shows one
 * sentence again.
 */
export async function hasSeenHint(key: string): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    const userId = data?.user?.id
    if (!userId) return false
    const { data: row, error } = await supabase.from("user_hints").select("key").eq("user_id", userId).eq("key", key).maybeSingle()
    return !error && Boolean(row)
  } catch {
    return false
  }
}
