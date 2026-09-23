import { createClient } from "@/utils/supabase/server"
import type { UsageDayRow, UsageLastSeen, UsagePageRow, UsagePersonInput } from "./usage-stats"

/**
 * Reads for Settings → Usage, through the admin's own session: row security
 * returns the rows to admins only (`fn_user_is_admin()`), and the page asks
 * for the Settings grant and the admin role before it reads at all.
 *
 * Every read degrades to empty rather than throwing: the code can reach
 * production before migration `20260923120000_leadengine_usage.sql` does,
 * and until then the page shows its "nothing recorded yet" state.
 */

/** PostgREST returns at most this many rows per request, so windows are read in pages. */
const PAGE_SIZE = 1000
/** Enough for a hundred people over the longest window (90 days, the chart's), twice over. */
const MAX_PAGES = 20

type Client = Awaited<ReturnType<typeof createClient>>
type ReadError = { code?: string; message: string }

/**
 * The errors that mean "the migration is not there yet" (table or function
 * unknown to Postgres or to PostgREST's schema cache): expected for a while
 * after a deploy, so they are a warning, not an error.
 */
const MISSING_CODES = new Set(["42P01", "42883", "PGRST202", "PGRST205"])

export function isMissingUsageSchema(error: { code?: string } | null | undefined): boolean {
  return Boolean(error?.code && MISSING_CODES.has(error.code))
}

function logReadError(label: string, error: ReadError) {
  if (isMissingUsageSchema(error)) console.warn(`[${label}] not available yet (migration 20260923120000 not applied?)`, error.code)
  else console.error(`[${label}]`, error.code, error.message)
}

async function readAll<T>(label: string, fetchPage: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: ReadError | null }>): Promise<T[]> {
  const rows: T[] = []
  try {
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const from = page * PAGE_SIZE
      const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1)
      if (error) {
        logReadError(label, error)
        break
      }
      const batch = (data ?? []) as T[]
      rows.push(...batch)
      if (batch.length < PAGE_SIZE) return rows
    }
  } catch (error) {
    console.error(`[${label}]`, error instanceof Error ? error.message : error)
    return rows
  }
  if (rows.length >= PAGE_SIZE * MAX_PAGES) console.warn(`[${label}] stopped at ${rows.length} rows`)
  return rows
}

/** Day rows from `from` (inclusive) on, for everyone. */
export async function listUsageDays(from: string, client?: Client): Promise<UsageDayRow[]> {
  const supabase = client ?? (await createClient())
  const rows = await readAll<{ user_id: string; day: string; last_seen_at: string; views: number; last_path: string | null }>("usage_days", (start, end) =>
    supabase
      .from("usage_days")
      .select("user_id, day, last_seen_at, views, last_path")
      .gte("day", from)
      .order("day", { ascending: true })
      .order("id", { ascending: true })
      .range(start, end)
  )
  return rows.map((row) => ({ userId: row.user_id, day: row.day, lastSeenAt: row.last_seen_at, views: Number(row.views) || 0, lastPath: row.last_path ?? null }))
}

/** Page counters from `from` (inclusive) on. */
export async function listUsagePages(from: string, client?: Client): Promise<UsagePageRow[]> {
  const supabase = client ?? (await createClient())
  const rows = await readAll<{ day: string; path: string; views: number }>("usage_pages", (start, end) =>
    supabase
      .from("usage_pages")
      .select("day, path, views")
      .gte("day", from)
      .order("day", { ascending: true })
      .order("id", { ascending: true })
      .range(start, end)
  )
  return rows.map((row) => ({ day: row.day, path: row.path, views: Number(row.views) || 0 }))
}

/** Each person's most recent day, however long ago. */
export async function listUsageLastSeen(client?: Client): Promise<UsageLastSeen[]> {
  try {
    const supabase = client ?? (await createClient())
    const { data, error } = await supabase.rpc("usage_last_seen")
    if (error) {
      logReadError("usage_last_seen", error)
      return []
    }
    return ((data ?? []) as Array<{ user_id: string; day: string; last_seen_at: string; last_path: string | null }>).map((row) => ({
      userId: row.user_id,
      day: row.day,
      lastSeenAt: row.last_seen_at,
      lastPath: row.last_path ?? null,
    }))
  } catch (error) {
    console.error("[usage_last_seen]", error instanceof Error ? error.message : error)
    return []
  }
}

/** The first day anything was recorded, or null before the first (or before the migration). */
export async function firstUsageDay(client?: Client): Promise<string | null> {
  try {
    const supabase = client ?? (await createClient())
    const { data, error } = await supabase.from("usage_days").select("day").order("day", { ascending: true }).limit(1).maybeSingle()
    if (error) {
      logReadError("usage_days first", error)
      return null
    }
    return (data?.day as string | undefined) ?? null
  } catch (error) {
    console.error("[usage_days first]", error instanceof Error ? error.message : error)
    return null
  }
}

/** The signed-in person's role, for `isUsageAdmin`. */
export async function readViewerRole(userId: string, client?: Client): Promise<string | null> {
  try {
    const supabase = client ?? (await createClient())
    const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle()
    return (data?.role as string | null | undefined) ?? null
  } catch {
    return null
  }
}

export interface UsagePeople {
  /** Everyone who can sign in to LeadEngine: the headcount, listed seen or not. */
  listed: UsagePersonInput[]
  /** Every profile by id, deactivated ones included, to name someone the rows mention who is no longer listed. */
  byId: Map<string, UsagePersonInput>
}

function displayName(row: { full_name: string | null; email: string | null }): string {
  return row.full_name?.trim() || row.email?.trim() || "Unknown user"
}

/**
 * Everyone with access, the way Settings → Users lists them: every profile,
 * active by default (`is_active` false blocks sign-in, so those people are
 * not counted; a null counts as active, as it does there). One login covers
 * both apps and LeadEngine has no per-unit gate on sign-in, so the whole
 * workspace is the headcount, not the active company.
 */
export async function listUsagePeople(client?: Client): Promise<UsagePeople> {
  const listed: UsagePersonInput[] = []
  const byId = new Map<string, UsagePersonInput>()
  try {
    const supabase = client ?? (await createClient())
    const { data, error } = await supabase.from("profiles").select("id, full_name, email, avatar_url, is_active").order("full_name", { ascending: true })
    if (error) {
      console.error("[usage people]", error.code, error.message)
      return { listed, byId }
    }
    for (const row of (data ?? []) as Array<{ id: string; full_name: string | null; email: string | null; avatar_url: string | null; is_active: boolean | null }>) {
      const person: UsagePersonInput = { id: row.id, name: displayName(row), avatarUrl: row.avatar_url?.trim() || null }
      byId.set(row.id, person)
      if (row.is_active !== false) listed.push(person)
    }
  } catch (error) {
    console.error("[usage people]", error instanceof Error ? error.message : error)
  }
  return { listed, byId }
}
