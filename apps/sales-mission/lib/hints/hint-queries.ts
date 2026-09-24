import { createClient } from "@/utils/supabase/server"
import type { SalesMissionAccess } from "@/lib/sales-mission-access"

export { HINT_KEY } from "./hint-key"

/**
 * The hints this person has already dismissed, on any device.
 *
 * Read once per workspace render and handed to the client, so a coach
 * mark decides synchronously whether to appear; a failure here means
 * "seen nothing", which at worst repeats a lesson.
 */
export async function listSeenHints(access: SalesMissionAccess): Promise<string[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .schema("sales_mission")
    .from("user_hints")
    .select("key")
    .eq("user_id", access.userId)
  if (error || !data) return []
  return data.map((row) => row.key as string)
}
