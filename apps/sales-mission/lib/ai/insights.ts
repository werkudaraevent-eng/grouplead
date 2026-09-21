/**
 * The daily insight: a few sentences the AI writes from the day's facts.
 *
 * One row per unit per day, and one per person per day when a role's reach
 * is narrower than the unit. Rows are written only with the service client
 * after the caller checked the person's grant (the server actions) or the
 * cron secret (the run route). The model gets the facts as JSON and must
 * answer with JSON; anything else is a failed row with the reason kept.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { chatCompleteDetailed, describeAiError } from "./ai-proxy"
import { resolveAiConfig } from "./ai-settings"
import { recordAiUsage } from "./ai-usage"
import { plainText } from "./answer-format"
import { loadInsightFacts, wibDayOf, wibHourOf, type InsightFacts } from "./insight-facts"
import { paths } from "@/lib/paths"

export const INSIGHT_KINDS = ["naik", "turun", "perlu_tindakan", "info"] as const
export type InsightKind = (typeof INSIGHT_KINDS)[number]

/** Where a sentence can point. The model picks a key; the app turns it into a link it controls. */
export const INSIGHT_LINKS = ["laporan_hari_ini", "laporan_tertunda", "prospek_jatuh_tempo", "aktivitas_hari_ini", "aktivitas_besok", "ringkasan_minggu"] as const
export type InsightLink = (typeof INSIGHT_LINKS)[number]

export interface InsightItem {
  text: string
  kind: InsightKind
  link: InsightLink | null
}

export type InsightScope = "unit" | "person"
export type InsightTrigger = "schedule" | "report" | "view" | "manual"
export type InsightStatus = "pending" | "ready" | "failed"

export interface InsightRecord {
  id: string
  scope: InsightScope
  userId: string | null
  day: string
  status: InsightStatus
  items: InsightItem[]
  model: string | null
  error: string | null
  trigger: InsightTrigger
  reportsSeen: number
  regenerations: number
  generatedAt: string | null
}

const MAX_ITEMS = 5
const MAX_TEXT = 220

/** The link key as a URL into the app, for the day the insight is about. */
export function insightHref(link: InsightLink | null, day: string): string | null {
  switch (link) {
    case "laporan_hari_ini":
      return paths.reportList({ date: "custom", from: day, to: day })
    case "laporan_tertunda":
      return paths.activities({ report: "needs_report", date: "past" })
    case "prospek_jatuh_tempo":
      return paths.prospectList({ due: "1" })
    case "aktivitas_hari_ini":
      return paths.activities({ date: "custom", from: day, to: day })
    case "aktivitas_besok": {
      const next = new Date(`${day}T00:00:00+07:00`)
      next.setUTCDate(next.getUTCDate() + 1)
      const tomorrow = wibDayOf(next)
      return paths.activities({ date: "custom", from: tomorrow, to: tomorrow })
    }
    case "ringkasan_minggu":
      return paths.reportSummary({ date: "week" })
    default:
      return null
  }
}

/**
 * The model's answer as items, or null when it is not the shape asked for.
 * Fences are stripped, unknown kinds become "info", unknown links are
 * dropped, and the list is capped, so a slightly sloppy answer still lands.
 */
export function parseInsightItems(raw: string): InsightItem[] | null {
  let text = raw.trim()
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) text = fenced[1].trim()
  const start = text.indexOf("{")
  const arrayStart = text.indexOf("[")
  if (start === -1 && arrayStart === -1) return null
  const from = start === -1 ? arrayStart : arrayStart === -1 ? start : Math.min(start, arrayStart)
  let parsed: unknown
  try {
    parsed = JSON.parse(text.slice(from, text.lastIndexOf(text[from] === "{" ? "}" : "]") + 1))
  } catch {
    return null
  }
  const list = Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object" && Array.isArray((parsed as { items?: unknown }).items) ? (parsed as { items: unknown[] }).items : null
  if (!list) return null
  const items: InsightItem[] = []
  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue
    const record = entry as Record<string, unknown>
    const body = typeof record.text === "string" ? plainText(record.text.replace(/\s+/g, " ")) : ""
    if (!body) continue
    const kind = (INSIGHT_KINDS as readonly string[]).includes(String(record.kind)) ? (record.kind as InsightKind) : "info"
    const link = (INSIGHT_LINKS as readonly string[]).includes(String(record.link)) ? (record.link as InsightLink) : null
    items.push({ text: body.slice(0, MAX_TEXT), kind, link })
    if (items.length === MAX_ITEMS) break
  }
  return items.length ? items : null
}

const SYSTEM_PROMPT = `Anda menulis insight harian untuk atasan dan tim sales lapangan di Indonesia.
Anda menerima FAKTA berupa JSON: angka yang sudah dihitung aplikasi untuk hari "day" (WIB) dan pembandingnya.
Aturan:
- Tulis SELALU 3 sampai 5 poin. Setiap poin satu kalimat, maksimal 30 kata, bahasa Indonesia yang lugas, tanpa sapaan dan tanpa basa-basi.
- Teks polos di dalam "text": tanpa Markdown, tanpa tanda ** atau #.
- Hanya pakai angka yang ada di FAKTA. Jangan menghitung ulang, jangan menebak, jangan menambah data. Angka boleh dibandingkan (misalnya minggu ini vs minggu lalu) hanya dari angka yang ada.
- Urutan prioritas: (1) yang perlu ditindak: laporan tertunda (sebut siapa yang paling banyak), prospek lewat tanggal hubungi lagi; (2) laporan yang masuk hari ini: sebut klien, hasil, minat, peluang; (3) perbandingan minggu ini vs minggu lalu untuk laporan dan aktivitas; (4) pola: jam tersibuk (byHour), industri terbanyak (byIndustry), hasil kunjungan terbanyak (byOutcome), klien paling sering (topClients); (5) yang akan datang: besok dan tujuh hari ke depan (nextWeek), termasuk siapa yang paling padat dan hari terpadat.
- Kalau hari ini tidak ada laporan dan tidak ada aktivitas (akhir pekan, libur), tetap tulis 3 poin dari minggu ini vs minggu lalu, pola minggu ini, dan jadwal yang akan datang.
- Sebut nama orang kalau satu orang menonjol. Sebut jam sebagai "jam 10.00", industri dengan namanya.
- Lewati topik yang angkanya nol. Hanya kalau seluruh FAKTA nol, tulis satu poin yang mengatakan belum ada data.
- Kalau "people" terisi, tulis dari sudut pandang orang-orang itu ("Anda" untuk satu orang).
Jawab HANYA dengan JSON: {"items":[{"text":"...","kind":"naik|turun|perlu_tindakan|info","link":"laporan_hari_ini|laporan_tertunda|prospek_jatuh_tempo|aktivitas_hari_ini|aktivitas_besok|ringkasan_minggu|null"}]}
"kind": naik untuk kabar baik atau kenaikan, turun untuk penurunan, perlu_tindakan untuk hal yang harus ditindak, info untuk sisanya. "link" adalah halaman yang menjawab poin itu, atau null.`

function toRecord(row: Record<string, unknown>): InsightRecord {
  return {
    id: row.id as string,
    scope: row.scope as InsightScope,
    userId: (row.user_id as string | null) ?? null,
    day: row.day as string,
    status: row.status as InsightStatus,
    items: Array.isArray(row.items) ? (row.items as InsightItem[]) : [],
    model: (row.model as string | null) ?? null,
    error: (row.error as string | null) ?? null,
    trigger: (row.trigger as InsightTrigger) ?? "view",
    reportsSeen: Number(row.reports_seen ?? 0),
    regenerations: Number(row.regenerations ?? 0),
    generatedAt: (row.generated_at as string | null) ?? null,
  }
}

const COLUMNS = "id, scope, user_id, day, status, items, model, error, trigger, reports_seen, regenerations, generated_at"

/** The stored insight, through whichever client the caller has (RLS applies to a session client). */
export async function readInsight(
  supabase: SupabaseClient,
  companyId: string,
  day: string,
  scope: InsightScope,
  userId: string | null
): Promise<InsightRecord | null> {
  let query = supabase.schema("sales_mission").from("ai_insights").select(COLUMNS).eq("company_id", companyId).eq("day", day).eq("scope", scope)
  query = scope === "person" && userId ? query.eq("user_id", userId) : query.is("user_id", null)
  const { data } = await query.maybeSingle()
  return data ? toRecord(data as Record<string, unknown>) : null
}

export interface GenerateOptions {
  companyId: string
  day: string
  scope: InsightScope
  userId: string | null
  /** For a person-scoped insight: whose numbers. Null for the unit. */
  salesIds: ReadonlySet<string> | null
  trigger: InsightTrigger
  now: Date
}

/**
 * Write (or rewrite) the insight for one scope and day. The row is claimed
 * as "pending" first so two callers a second apart do not both pay for a
 * model call; the loser reads the winner's result.
 */
export async function generateInsight(service: SupabaseClient, options: GenerateOptions): Promise<InsightRecord> {
  const { companyId, day, scope, userId, salesIds, trigger, now } = options
  const missions = service.schema("sales_mission")
  const existing = await readInsight(service, companyId, day, scope, userId)

  // Claim.
  if (existing?.status === "pending" && existing.generatedAt === null) {
    return existing
  }
  const claim = {
    company_id: companyId,
    scope,
    user_id: userId,
    day,
    status: "pending",
    trigger,
    updated_at: now.toISOString(),
  }
  let id = existing?.id ?? null
  if (id) {
    await missions.from("ai_insights").update({ ...claim, regenerations: (existing?.regenerations ?? 0) + (existing?.status === "ready" ? 1 : 0) }).eq("id", id)
  } else {
    const { data, error } = await missions.from("ai_insights").insert(claim).select("id").single()
    if (error || !data) {
      // A concurrent insert won the unique index: read what it made.
      const winner = await readInsight(service, companyId, day, scope, userId)
      if (winner) return winner
      throw new Error(error?.message ?? "Insight gagal dibuat.")
    }
    id = data.id as string
  }

  const finish = async (patch: Record<string, unknown>) => {
    await missions.from("ai_insights").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id)
    return (await readInsight(service, companyId, day, scope, userId))!
  }

  const config = await resolveAiConfig()
  if (!config) {
    return finish({ status: "failed", error: "Koneksi AI belum diatur di Pengaturan → AI.", generated_at: now.toISOString() })
  }

  let facts: InsightFacts
  try {
    facts = await loadInsightFacts(service, companyId, day, now, salesIds)
  } catch (error) {
    return finish({ status: "failed", error: `Data tidak bisa dibaca: ${error instanceof Error ? error.message : "kesalahan"}`, generated_at: now.toISOString() })
  }

  try {
    const result = await chatCompleteDetailed(config, {
      model: config.modelReasoning,
      temperature: 0.3,
      // Covers a model's reasoning tokens too on most proxies; the answer itself is five short lines of JSON.
      maxTokens: 2000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `FAKTA:\n${JSON.stringify(facts)}` },
      ],
    })
    void recordAiUsage({ feature: "insight", model: config.modelReasoning, promptTokens: result.promptTokens, completionTokens: result.completionTokens, ok: true, companyId, userId: userId ?? null })
    const items = parseInsightItems(result.text)
    if (!items) {
      return finish({ status: "failed", error: "Model tidak menjawab dengan format yang diminta.", facts, model: config.modelReasoning, generated_at: new Date().toISOString() })
    }
    return finish({
      status: "ready",
      items,
      facts,
      model: config.modelReasoning,
      prompt_tokens: result.promptTokens,
      completion_tokens: result.completionTokens,
      error: null,
      reports_seen: facts.today.reportsSubmitted,
      generated_at: new Date().toISOString(),
    })
  } catch (error) {
    void recordAiUsage({ feature: "insight", model: config.modelReasoning, promptTokens: null, completionTokens: null, ok: false, companyId, userId: userId ?? null })
    return finish({ status: "failed", error: describeAiError(error), facts, model: config.modelReasoning, generated_at: new Date().toISOString() })
  }
}

/** Reports sent today, counted the way the facts count them, to tell whether an insight is behind. */
export async function countReportsSubmittedOn(service: SupabaseClient, companyId: string, day: string): Promise<number> {
  const from = new Date(`${day}T00:00:00+07:00`)
  const to = new Date(from)
  to.setUTCDate(to.getUTCDate() + 1)
  const { count } = await service
    .schema("sales_mission")
    .from("visit_reports")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .neq("status", "DRAFT")
    .gte("submitted_at", from.toISOString())
    .lt("submitted_at", to.toISOString())
  return count ?? 0
}

/** At most this many report-triggered rewrites a day, so a busy day does not turn into a bill. */
export const MAX_REGENERATIONS_PER_DAY = 12
/** A rewrite waits this long after the previous one, so five reports in a row cost one call. */
export const REGENERATION_GAP_MS = 10 * 60 * 1000

/**
 * What the ten-minute schedule should do for one unit right now: the
 * morning run once its hour has come, a rewrite when reports arrived after
 * the last one and the gap has passed, otherwise nothing.
 */
export function dueTrigger(
  existing: InsightRecord | null,
  settings: { hour: number },
  reportsToday: number,
  now: Date
): InsightTrigger | null {
  const hour = wibHourOf(now)
  if (!existing) return hour >= settings.hour ? "schedule" : null
  if (existing.status === "pending" && existing.generatedAt === null) return null
  if (existing.trigger !== "schedule" && existing.status !== "failed" && hour >= settings.hour && existing.trigger === "view") {
    // A row made on open before the morning hour: the morning run still owns the day.
    return "schedule"
  }
  const generatedAt = existing.generatedAt ? new Date(existing.generatedAt).getTime() : 0
  const gapPassed = now.getTime() - generatedAt >= REGENERATION_GAP_MS
  if (existing.status === "failed" && gapPassed && existing.regenerations < MAX_REGENERATIONS_PER_DAY) return existing.trigger === "schedule" ? "schedule" : "report"
  if (reportsToday > existing.reportsSeen && gapPassed && existing.regenerations < MAX_REGENERATIONS_PER_DAY) return "report"
  return null
}

export { wibDayOf, wibHourOf }
