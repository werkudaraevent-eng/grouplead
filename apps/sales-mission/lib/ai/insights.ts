/**
 * The daily insight: the analyst brief the AI writes from the day's facts.
 *
 * Three sections, in this order: what has to be acted on, what the reps
 * heard in the field, and what management should decide. The numbers are
 * the app's (`insight-facts.ts` computes them and the prompt forbids
 * arithmetic); the synthesis is the model's, over the reps' own text.
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
import { isLiveClaim, isStaleClaim, parseInsightItems, storedInsightItems, type InsightItem } from "./insight-brief"
import { loadInsightFacts, shiftDay, wibDayOf, wibHourOf, type InsightFacts, serializeFactsForModel } from "./insight-facts"

export {
  INSIGHT_KINDS,
  INSIGHT_LINKS,
  INSIGHT_SECTIONS,
  INSIGHT_SECTION_LABELS,
  insightHref,
  parseInsightItems,
  storedInsightItems,
  teaserInsightItems,
  briefSections,
  briefShareText,
  insightDayLabel,
  insightDayName,
  isLiveClaim,
  isStaleClaim,
  STALE_CLAIM_MS,
  INSIGHT_POLL_MS,
  INSIGHT_POLL_LIMIT_MS,
  INSIGHT_UNFINISHED_MESSAGE,
} from "./insight-brief"
export type { InsightItem, InsightKind, InsightLink, InsightSection } from "./insight-brief"

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
  /** When the row was last written. The claim's lease is measured from it. */
  updatedAt: string | null
}

const SYSTEM_PROMPT = `Anda analis sales untuk sebuah unit sales lapangan di Indonesia. Anda menulis brief harian untuk atasan dan tim.
Anda menerima FAKTA berupa JSON untuk hari "day" (WIB): angka yang sudah dihitung aplikasi, dan teks laporan yang ditulis sales sendiri (summary, clientNeeds, productInterest, competitor, contacts, previousVisit).
Tugas Anda: membaca teks itu, mencari pola, lalu menyimpulkan. Angka tidak boleh Anda hitung sendiri.

Brief punya tiga bagian, dan setiap poin harus menyebut bagiannya di "section":
1. "tindak" (Perlu ditindak) — hal konkret dan bernama: klien berminat tinggi (interestKind "hql" atau "hot") yang belum punya tindak lanjut atau tindak lanjutnya sudah lewat (followUps.lateList), laporan tertunda dan siapa yang paling banyak (pending.byPerson), prospek yang lewat tanggal hubungi lagi (prospects.list), peluang yang belum dikirim ke LeadEngine (week.opportunitiesNotSentToCrm, sentToCrm false). Sebut nama klien dan nama orangnya.
2. "lapangan" (Yang terdengar di lapangan) — sintesis dari teks laporan: tema yang berulang di summary dan clientNeeds, produk yang paling dicari (productInterest), kompetitor yang disebut dan di klien mana (competitor), sinyal dari orang yang ditemui (contacts: pengambil keputusan yang ditemui atau tidak, jabatan, DISC dan cara mendekatinya bila ada), dan perubahan dibanding kunjungan sebelumnya ke klien yang sama (previousVisit).
3. "rekomendasi" (Rekomendasi) — 1 sampai 3 tindakan untuk manajemen atau tim, masing-masing bersandar pada bukti di FAKTA (sebut klien atau orangnya) dan berbentuk keputusan ("prioritaskan", "kirim penawaran", "dampingi"), bukan nasihat umum.

Aturan:
- 2 sampai 4 poin per bagian, maksimal 9 poin seluruhnya. Satu poin satu atau dua kalimat, maksimal 45 kata, bahasa Indonesia yang lugas, tanpa sapaan dan tanpa basa-basi.
- Teks polos di dalam "text": tanpa Markdown, tanpa tanda ** atau #, tanpa daftar bernomor.
- Hanya pakai angka yang ada di FAKTA. Jangan menghitung ulang, jangan menjumlahkan, jangan menebak, jangan menambah data. Kalimat kualitatif boleh menyimpulkan dari teks laporan, tetapi tetap harus bisa ditunjuk ke laporan yang ada.
- Nilai uang selalu dalam bentuk yang sudah diformat aplikasi (estimatedValueText, week.estimatedValueText), misalnya "Rp 4.050.000.000". Jangan menulis angka uang dengan cara lain.
- Perbandingan minggu ini vs minggu lalu hanya kalau ada pembandingnya: kalau week.reportsBaseline atau week.appointmentsBaseline true, sebut angka minggu ini saja tanpa menyebut minggu lalu.
- Sebut nama orang kalau satu orang menonjol. Sebut jam sebagai "jam 10.00", industri dengan namanya.
- Lewati topik yang kosong; bagian yang tidak punya bahan boleh tidak ada. Hanya kalau seluruh FAKTA kosong, tulis satu poin bagian "lapangan" yang mengatakan belum ada data.
- Kalau "people" terisi, tulis dari sudut pandang orang-orang itu ("Anda" untuk satu orang).
- "missionIds": daftar id aktivitas dari today.reports yang menjadi bukti poin itu, maksimal 3, hanya id yang ada di FAKTA. Kosongkan kalau poin itu bukan tentang laporan tertentu.
Jawab HANYA dengan JSON: {"items":[{"text":"...","kind":"naik|turun|perlu_tindakan|info","section":"tindak|lapangan|rekomendasi","link":"laporan_hari_ini|laporan_tertunda|prospek_jatuh_tempo|aktivitas_hari_ini|aktivitas_besok|ringkasan_minggu|null","missionIds":["..."]}]}
"kind": naik untuk kabar baik atau kenaikan, turun untuk penurunan, perlu_tindakan untuk hal yang harus ditindak, info untuk sisanya. "link" adalah halaman yang menjawab poin itu, atau null.`

function toRecord(row: Record<string, unknown>): InsightRecord {
  return {
    id: row.id as string,
    scope: row.scope as InsightScope,
    userId: (row.user_id as string | null) ?? null,
    day: row.day as string,
    status: row.status as InsightStatus,
    items: storedInsightItems(row.items),
    model: (row.model as string | null) ?? null,
    error: (row.error as string | null) ?? null,
    trigger: (row.trigger as InsightTrigger) ?? "view",
    reportsSeen: Number(row.reports_seen ?? 0),
    regenerations: Number(row.regenerations ?? 0),
    generatedAt: (row.generated_at as string | null) ?? null,
    updatedAt: (row.updated_at as string | null) ?? null,
  }
}

const COLUMNS = "id, scope, user_id, day, status, items, model, error, trigger, reports_seen, regenerations, generated_at, updated_at"

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

/**
 * The days that already have a written brief for one scope, newest first.
 * The Insight tab's list: a day with no row is a day with nothing to read,
 * so it is not offered. Through whichever client the caller has, so a
 * session client sees only what RLS allows.
 */
export async function listInsightDays(
  supabase: SupabaseClient,
  companyId: string,
  scope: InsightScope,
  userId: string | null,
  { from, to }: { from: string; to: string }
): Promise<string[]> {
  let query = supabase
    .schema("sales_mission")
    .from("ai_insights")
    .select("day")
    .eq("company_id", companyId)
    .eq("scope", scope)
    .eq("status", "ready")
    .gte("day", from)
    .lte("day", to)
  query = scope === "person" && userId ? query.eq("user_id", userId) : query.is("user_id", null)
  const { data } = await query.order("day", { ascending: false }).limit(60)
  return [...new Set((data ?? []).map((row) => row.day as string))]
}

/** The window the Insight tab offers: today and the 29 days before it. */
export const INSIGHT_HISTORY_DAYS = 30

export function insightHistoryWindow(today: string): { from: string; to: string } {
  return { from: shiftDay(today, -(INSIGHT_HISTORY_DAYS - 1)), to: today }
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
 * model call; the loser reads the winner's result. The claim is a lease:
 * once it is older than `STALE_CLAIM_MS` the holder is assumed gone and the
 * next caller takes the row over, so a server that died halfway cannot leave
 * the day stuck on "Menyusun brief…".
 */
export async function generateInsight(service: SupabaseClient, options: GenerateOptions): Promise<InsightRecord> {
  const { companyId, day, scope, userId, salesIds, trigger, now } = options
  const missions = service.schema("sales_mission")
  const existing = await readInsight(service, companyId, day, scope, userId)

  // Claim. A live one is someone else's model call, already paid for; a
  // stale one is a server that died holding it, and is taken over here.
  if (isLiveClaim(existing, now)) {
    return existing!
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
      // Covers a model's reasoning tokens too on most proxies; the answer
      // itself is at most nine two-sentence items of JSON, and the brief
      // reasons over the day's report texts before writing them.
      maxTokens: 4000,
      // Forty reports through a reasoning model: well past the probe's twenty seconds.
      timeoutMs: 90_000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `FAKTA:\n${serializeFactsForModel(facts)}` },
      ],
    })
    void recordAiUsage({ feature: "insight", model: config.modelReasoning, promptTokens: result.promptTokens, completionTokens: result.completionTokens, ok: true, companyId, userId: userId ?? null })
    // The evidence links are the app's: only an id that was in the facts survives.
    const items = parseInsightItems(result.text, new Set(facts.today.reports.map((report) => report.missionId)))
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
 * the last one and the gap has passed, otherwise nothing. A claim someone
 * is still working on is left alone; a claim left behind by a server that
 * died is written again, because nothing else ever clears it.
 */
export function dueTrigger(
  existing: InsightRecord | null,
  settings: { hour: number },
  reportsToday: number,
  now: Date
): InsightTrigger | null {
  const hour = wibHourOf(now)
  if (!existing) return hour >= settings.hour ? "schedule" : null
  if (isLiveClaim(existing, now)) return null
  if (isStaleClaim(existing, now)) {
    return existing.regenerations >= MAX_REGENERATIONS_PER_DAY ? null : existing.trigger === "schedule" ? "schedule" : "report"
  }
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
