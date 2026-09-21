"use server"

import { z } from "zod"
import { createServiceClient, hasServiceClientConfig } from "@/utils/supabase/service"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { getMissionSettings, listTenantSales } from "@/lib/missions/mission-queries"
import { listReportChoices } from "@/lib/missions/report-choice-queries"
import { resolveAiConfig } from "@/lib/ai/ai-settings"
import { chatCompleteDetailed, describeAiError } from "@/lib/ai/ai-proxy"
import { buildAskContext } from "@/lib/ai/ask-context"
import { recordAiUsage } from "@/lib/ai/ai-usage"
import type { ActionResult } from "@/types/action-result"
import { NO_ACCESS_MESSAGE } from "@/lib/brand"

const askSchema = z.object({
  question: z.string().trim().min(3, "Tulis pertanyaannya dulu.").max(300, "Maksimal 300 karakter."),
  range: z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  sales: z.array(z.string().uuid()).max(50).default([]),
  /** Earlier turns of this sitting, newest last, so a follow-up question reads in context. */
  history: z.array(z.object({ question: z.string().max(300), answer: z.string().max(2000) })).max(6).default([]),
})

export interface AskAnswer {
  answer: string
  model: string
}

const SYSTEM_PROMPT = `Anda asisten data untuk tim sales lapangan di Indonesia (aplikasi Sales Activity).
Anda menerima DATA berupa JSON tentang periode dan sales yang sedang dilihat pengguna, sudah dihitung aplikasi. Jawab pertanyaan pengguna HANYA dari DATA itu.
Isi DATA:
- totals dan breakdowns: angka rekap periode (laporan, aktivitas, peluang, nilai estimasi, per sales/industri/hasil/minat/klien/minggu).
- daftar_sales: semua orang di daftar sales. Orang yang tidak muncul di laporan_per_sales berarti belum punya laporan pada periode ini.
- aktivitas_hari_ini, aktivitas_besok: janji temu hari ini dan besok (jam WIB, klien, sales, lokasi, industri), apa pun periodenya.
- aktivitas_periode, laporan_periode, prospek_jatuh_tempo: baris-baris pada periode; kalau terpotong=true, sebutkan bahwa daftarnya dipotong dan pakai total untuk jumlahnya.
- aktivitas_periode_per_jam: jumlah aktivitas per jam WIB.
Aturan:
- Bahasa Indonesia yang lugas. Maksimal 150 kata. Boleh daftar pendek kalau menyebut beberapa hal.
- "pagi" = sebelum 12.00 WIB, "siang" = 12.00–15.00, "sore" = setelah 15.00. "hari ini" = hari_ini di DATA.
- Sebut angka dan nama apa adanya dari DATA. Jangan menghitung yang tidak bisa dihitung dari DATA, jangan menebak, jangan menambah data dari luar.
- Kalau DATA tidak memuat jawabannya, katakan itu dalam satu kalimat dan sebut tab atau kartu mana (Aktivitas, Daftar laporan, Prospek, Ringkasan) yang mungkin menjawab.
- "laporan" = kunjungan yang terjadi dan dilaporkan; "aktivitas" = janji temu terjadwal; "prospek" = calon klien sebelum ada janji temu.
- Jangan menyapa, jangan menutup dengan basa-basi.`

/**
 * One question about the period, answered from the board's own numbers.
 * The context is built through the person's session, so it holds exactly
 * what the board would show them; the answer is logged with the model and
 * the token counts for the cost view later.
 */
export async function askSalesData(input: unknown): Promise<ActionResult<AskAnswer>> {
  const access = await getSalesMissionAccess()
  if (!access) return { success: false, error: NO_ACCESS_MESSAGE }
  if (!(await canPerform(access, "sales_mission_ai", "read"))) return { success: false, error: "Anda tidak punya izin memakai Tanya AI." }
  const settings = await getMissionSettings(access)
  if (!settings.aiAskEnabled) return { success: false, error: "Tanya AI belum dinyalakan di Pengaturan → Aturan aktivitas." }

  const parsed = askSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Pertanyaan tidak valid." }
  const { question, range, sales, history } = parsed.data
  if (range.from > range.to) return { success: false, error: "Periode tidak valid." }

  const config = await resolveAiConfig()
  if (!config) return { success: false, error: "Koneksi AI belum diatur di Pengaturan → AI." }

  const [people, choices, canSeeProspects] = await Promise.all([
    listTenantSales(access),
    listReportChoices(access),
    canPerform(access, "sales_mission_prospect", "read"),
  ])
  const ctx = { people: new Map(people.map((person) => [person.id, person.name])), choices }
  const context = await buildAskContext(access, range, sales, ctx, canSeeProspects, { now: new Date(), choices, roster: people.map((person) => ({ id: person.id, name: person.name })) })

  // The data rides in the system message: one system turn, then the
  // conversation, which every OpenAI-compatible proxy accepts as is.
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: `${SYSTEM_PROMPT}\n\nDATA:\n${JSON.stringify(context)}` },
  ]
  for (const turn of history) {
    messages.push({ role: "user", content: turn.question })
    messages.push({ role: "assistant", content: turn.answer })
  }
  messages.push({ role: "user", content: question })

  const log = hasServiceClientConfig() ? createServiceClient() : null
  try {
    // No max_tokens, like LeadEngine's Ask AI on the same proxy: there the
    // budget covers the model's thinking too, and a small cap came back as
    // an empty answer. The prompt keeps the answer short.
    const result = await chatCompleteDetailed(config, { model: config.modelFast, temperature: 0.2, messages })
    void recordAiUsage({ feature: "tanya_ai", model: config.modelFast, promptTokens: result.promptTokens, completionTokens: result.completionTokens, ok: true, companyId: access.companyId, userId: access.userId })
    if (log) {
      await log.schema("sales_mission").from("ai_questions").insert({
        company_id: access.companyId,
        user_id: access.userId,
        question,
        answer: result.text,
        model: config.modelFast,
        prompt_tokens: result.promptTokens,
        completion_tokens: result.completionTokens,
        range_from: range.from,
        range_to: range.to,
      })
    }
    return { success: true, data: { answer: result.text.trim(), model: config.modelFast } }
  } catch (error) {
    const message = describeAiError(error)
    void recordAiUsage({ feature: "tanya_ai", model: config.modelFast, promptTokens: null, completionTokens: null, ok: false, companyId: access.companyId, userId: access.userId })
    if (log) {
      await log.schema("sales_mission").from("ai_questions").insert({
        company_id: access.companyId,
        user_id: access.userId,
        question,
        error: message,
        model: config.modelFast,
        range_from: range.from,
        range_to: range.to,
      })
    }
    return { success: false, error: message }
  }
}
