import { generateBoardToken, hashBoardToken, hashesMatch } from "@/lib/board/board-access"
import { createServiceClient } from "@/utils/supabase/service"

/**
 * The calendar feed's credential.
 *
 * A calendar server fetches the feed with no session, so the URL is the
 * whole authorisation. Same shape as the board link: random, URL-safe,
 * stored only as a hash, returned once. It resolves to one person and
 * their tenant, and every read the feed makes is scoped to both.
 */

export const hashCalendarToken = hashBoardToken
export const generateCalendarToken = generateBoardToken

export interface CalendarTokenResolution {
  tokenId: string
  userId: string
  companyId: string
}

/**
 * Resolve a raw token to the person whose calendar it serves, or null for
 * anything not currently usable (unknown or retired), without saying which.
 */
export async function resolveCalendarToken(token: string): Promise<CalendarTokenResolution | null> {
  const trimmed = token.trim()
  if (!trimmed) return null

  const supabase = createServiceClient()
  const hash = hashCalendarToken(trimmed)

  const { data } = await supabase
    .schema("sales_mission")
    .from("calendar_tokens")
    .select("id, user_id, company_id, token_hash, revoked_at")
    .eq("token_hash", hash)
    .maybeSingle()

  if (!data) return null
  if (!hashesMatch(data.token_hash as string, hash)) return null
  if (data.revoked_at) return null

  // Best-effort: "last used" tells the person whether their phone is still
  // fetching. Failing to record it must not break the feed.
  await supabase
    .schema("sales_mission")
    .from("calendar_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)

  return {
    tokenId: data.id as string,
    userId: data.user_id as string,
    companyId: data.company_id as string,
  }
}
