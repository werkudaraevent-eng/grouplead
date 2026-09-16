import { createClient } from "@/utils/supabase/server"
import type { SalesMissionAccess } from "@/lib/sales-mission-access"

export interface CalendarTokenStatus {
  id: string
  createdAt: string
  lastUsedAt: string | null
}

/** The person's active feed link, if any: when it was made and last fetched. Never the token. */
export async function getActiveCalendarToken(access: SalesMissionAccess): Promise<CalendarTokenStatus | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .schema("sales_mission")
    .from("calendar_tokens")
    .select("id, created_at, last_used_at")
    .eq("user_id", access.userId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data) return null
  return {
    id: data.id as string,
    createdAt: data.created_at as string,
    lastUsedAt: (data.last_used_at as string | null) ?? null,
  }
}
