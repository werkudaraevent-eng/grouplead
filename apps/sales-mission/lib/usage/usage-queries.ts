import { createClient } from "@/utils/supabase/server"
import type { SalesMissionAccess } from "@/lib/sales-mission-access"
import type { UsageDayRow, UsageLastSeen, UsagePageRow } from "./usage-stats"

/**
 * Reads for Pengaturan → Pemakaian, through the admin's own session: row
 * security keeps them inside the unit, the page keeps them to admins, and
 * every query still names the company.
 */

/** PostgREST returns at most this many rows per request, so windows are read in pages. */
const PAGE_SIZE = 1000
/** Enough for a hundred people over the longest window (90 days, the chart's), twice over. */
const MAX_PAGES = 20

type Client = Awaited<ReturnType<typeof createClient>>

async function readAll<T>(label: string, fetchPage: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { code?: string; message: string } | null }>): Promise<T[]> {
  const rows: T[] = []
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1)
    if (error) {
      console.error(`[${label}]`, error.code, error.message)
      break
    }
    const batch = (data ?? []) as T[]
    rows.push(...batch)
    if (batch.length < PAGE_SIZE) return rows
  }
  if (rows.length >= PAGE_SIZE * MAX_PAGES) console.warn(`[${label}] stopped at ${rows.length} rows`)
  return rows
}

/** Day rows from `from` (inclusive) on, for the whole unit. */
export async function listUsageDays(access: SalesMissionAccess, from: string, client?: Client): Promise<UsageDayRow[]> {
  const supabase = client ?? (await createClient())
  const rows = await readAll<{ user_id: string; day: string; last_seen_at: string; views: number; last_path: string | null }>("usage_days", (start, end) =>
    supabase
      .schema("sales_mission")
      .from("usage_days")
      .select("user_id, day, last_seen_at, views, last_path")
      .eq("company_id", access.companyId)
      .gte("day", from)
      .order("day", { ascending: true })
      .order("id", { ascending: true })
      .range(start, end)
  )
  return rows.map((row) => ({ userId: row.user_id, day: row.day, lastSeenAt: row.last_seen_at, views: Number(row.views) || 0, lastPath: row.last_path ?? null }))
}

/** Page counters from `from` (inclusive) on, for the whole unit. */
export async function listUsagePages(access: SalesMissionAccess, from: string, client?: Client): Promise<UsagePageRow[]> {
  const supabase = client ?? (await createClient())
  const rows = await readAll<{ day: string; path: string; views: number }>("usage_pages", (start, end) =>
    supabase
      .schema("sales_mission")
      .from("usage_pages")
      .select("day, path, views")
      .eq("company_id", access.companyId)
      .gte("day", from)
      .order("day", { ascending: true })
      .order("id", { ascending: true })
      .range(start, end)
  )
  return rows.map((row) => ({ day: row.day, path: row.path, views: Number(row.views) || 0 }))
}

/** Each person's most recent day, however long ago. */
export async function listUsageLastSeen(access: SalesMissionAccess, client?: Client): Promise<UsageLastSeen[]> {
  const supabase = client ?? (await createClient())
  const { data, error } = await supabase.schema("sales_mission").rpc("usage_last_seen", { p_company_id: access.companyId })
  if (error) {
    console.error("[usage_last_seen]", error.code, error.message)
    return []
  }
  return ((data ?? []) as Array<{ user_id: string; day: string; last_seen_at: string; last_path: string | null }>).map((row) => ({
    userId: row.user_id,
    day: row.day,
    lastSeenAt: row.last_seen_at,
    lastPath: row.last_path ?? null,
  }))
}

/** The first day anything was recorded for the unit, or null before the first. */
export async function firstUsageDay(access: SalesMissionAccess, client?: Client): Promise<string | null> {
  const supabase = client ?? (await createClient())
  const { data, error } = await supabase
    .schema("sales_mission")
    .from("usage_days")
    .select("day")
    .eq("company_id", access.companyId)
    .order("day", { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error("[usage_days first]", error.code, error.message)
    return null
  }
  return (data?.day as string | undefined) ?? null
}

/** Names for people the rows name who are no longer on the people list. */
export async function resolveUsageNames(ids: string[], client?: Client): Promise<Map<string, { name: string; avatarUrl: string | null }>> {
  const names = new Map<string, { name: string; avatarUrl: string | null }>()
  if (ids.length === 0) return names
  const supabase = client ?? (await createClient())
  const { data } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", ids)
  for (const row of data ?? []) {
    const name = (row.full_name as string | null)?.trim()
    if (name) names.set(row.id as string, { name, avatarUrl: (row.avatar_url as string | null)?.trim() || null })
  }
  return names
}
