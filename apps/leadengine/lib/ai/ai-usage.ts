import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceClient } from "@/utils/supabase/service"

/**
 * The AI proxy's bill, in tokens. Every call from either app writes one
 * row to `public.ai_usage` (service role; the caller has already passed
 * its own grant check), and Settings → AI sums the last 30 days into what
 * a week and a month cost, per feature and per model. Tokens, not money:
 * the price is the proxy's. The summary is a pure function, tested.
 */

export type AiFeature = "insight" | "tanya_ai" | "ask_ai" | "analyze" | "uji_model"

export interface AiUsageEntry {
  feature: AiFeature
  model: string | null
  promptTokens: number | null
  completionTokens: number | null
  ok: boolean
  companyId?: string | null
  userId?: string | null
}

const APP = "leadengine"

/** Fire and forget: a failed log line never fails the answer it describes. */
export async function recordAiUsage(entry: AiUsageEntry): Promise<void> {
  try {
    const { error } = await createServiceClient().from("ai_usage").insert({
      app: APP,
      feature: entry.feature,
      model: entry.model,
      prompt_tokens: entry.promptTokens,
      completion_tokens: entry.completionTokens,
      ok: entry.ok,
      company_id: entry.companyId ?? null,
      user_id: entry.userId ?? null,
    })
    if (error) console.error("[recordAiUsage]", error.code, error.message)
  } catch (error) {
    console.error("[recordAiUsage]", error)
  }
}

export interface UsageRow {
  app: string
  feature: string
  model: string | null
  prompt_tokens: number | null
  completion_tokens: number | null
  ok: boolean
  created_at: string
}

export interface UsageTotals {
  calls: number
  failed: number
  promptTokens: number
  completionTokens: number
  total: number
}

export interface UsageSummary {
  /** When the oldest row in the window was written, so a young log is read as such. */
  since: string | null
  last7: UsageTotals
  last30: UsageTotals
  /** Last 7 days scaled to a week and to 30 days. */
  projectedWeek: number
  projectedMonth: number
  byFeature: Array<{ key: string; app: string } & UsageTotals>
  byModel: Array<{ key: string } & UsageTotals>
}

const DAY_MS = 86_400_000

function empty(): UsageTotals {
  return { calls: 0, failed: 0, promptTokens: 0, completionTokens: 0, total: 0 }
}

function add(into: UsageTotals, row: UsageRow): void {
  into.calls += 1
  if (!row.ok) into.failed += 1
  into.promptTokens += row.prompt_tokens ?? 0
  into.completionTokens += row.completion_tokens ?? 0
  into.total = into.promptTokens + into.completionTokens
}

/** Rows from the last 30 days → the card. `now` is the right edge of the window. */
export function summarizeUsage(rows: UsageRow[], now: Date): UsageSummary {
  const last7 = empty()
  const last30 = empty()
  const features = new Map<string, { key: string; app: string } & UsageTotals>()
  const models = new Map<string, { key: string } & UsageTotals>()
  let since: string | null = null
  const cutoff7 = now.getTime() - 7 * DAY_MS
  const cutoff30 = now.getTime() - 30 * DAY_MS
  for (const row of rows) {
    const at = Date.parse(row.created_at)
    if (Number.isNaN(at) || at < cutoff30 || at > now.getTime()) continue
    if (!since || row.created_at < since) since = row.created_at
    add(last30, row)
    if (at >= cutoff7) add(last7, row)
    const featureKey = `${row.app}:${row.feature}`
    const feature = features.get(featureKey) ?? { key: row.feature, app: row.app, ...empty() }
    add(feature, row)
    features.set(featureKey, feature)
    const modelKey = row.model ?? "?"
    const model = models.get(modelKey) ?? { key: modelKey, ...empty() }
    add(model, row)
    models.set(modelKey, model)
  }
  // A log younger than a week is scaled from the calendar days it covers
  // (today counts), not from seven.
  const coveredDays = since ? Math.min(7, Math.floor((now.getTime() - Date.parse(since)) / DAY_MS) + 1) : 7
  const perDay = last7.total / coveredDays
  return {
    since,
    last7,
    last30,
    projectedWeek: Math.round(perDay * 7),
    projectedMonth: Math.round(perDay * 30),
    byFeature: [...features.values()].sort((a, b) => b.total - a.total),
    byModel: [...models.values()].sort((a, b) => b.total - a.total),
  }
}

/** The last 30 days of the log, summed. The caller has checked the person's grant. */
export async function readAiUsage(service: SupabaseClient, now = new Date()): Promise<UsageSummary> {
  const since = new Date(now.getTime() - 30 * DAY_MS).toISOString()
  const { data, error } = await service
    .from("ai_usage")
    .select("app, feature, model, prompt_tokens, completion_tokens, ok, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20_000)
  if (error) {
    console.error("[readAiUsage]", error.code, error.message)
    return summarizeUsage([], now)
  }
  return summarizeUsage((data ?? []) as UsageRow[], now)
}
