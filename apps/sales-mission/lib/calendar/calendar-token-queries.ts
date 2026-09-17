import { createClient } from "@/utils/supabase/server"
import type { SalesMissionAccess } from "@/lib/sales-mission-access"
import type { FeedScope } from "./calendar-feed-queries"

export interface CalendarTokenStatus {
  id: string
  scope: FeedScope
  createdAt: string
  lastUsedAt: string | null
}

/** The person's active feed links, one per scope at most: when made and last fetched. Never the token. */
export async function getActiveCalendarTokens(access: SalesMissionAccess): Promise<Record<FeedScope, CalendarTokenStatus | null>> {
  const supabase = await createClient()
  const { data } = await supabase
    .schema("sales_mission")
    .from("calendar_tokens")
    .select("id, scope, created_at, last_used_at")
    .eq("user_id", access.userId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
  const result: Record<FeedScope, CalendarTokenStatus | null> = { own: null, team: null }
  for (const row of data ?? []) {
    const scope = (row.scope as FeedScope) ?? "own"
    if (result[scope]) continue
    result[scope] = {
      id: row.id as string,
      scope,
      createdAt: row.created_at as string,
      lastUsedAt: (row.last_used_at as string | null) ?? null,
    }
  }
  return result
}
