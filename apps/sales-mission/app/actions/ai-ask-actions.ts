"use server"

import { z } from "zod"
import { createServiceClient, hasServiceClientConfig } from "@/utils/supabase/service"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { getMissionSettings, listTenantSales } from "@/lib/missions/mission-queries"
import { listReportChoices } from "@/lib/missions/report-choice-queries"
import { resolveAiConfig } from "@/lib/ai/ai-settings"
import { chatCompleteDetailed, describeAiError } from "@/lib/ai/ai-proxy"
import { buildAskContext } from "@/lib/ai/ask-context"
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
Anda menerima DATA berupa JSON: angka periode yang sedang dilihat pengguna, sudah dihitung aplikasi. Jawab pertanyaan pengguna HANYA dari DATA itu.
Aturan:
- Bahasa Indonesia yang lugas. Maksimal 120 kata. Boleh daftar pendek kalau membandingkan beberapa hal.
- Sebut angka apa adanya dari DATA. Jangan menghitung yang tidak bisa dihitung dari DATA, jangan menebak, jangan menambah data dari luar.
- Kalau DATA tidak memuat jawabannya, katakan itu dalam satu kalimat dan sebut kartu atau saringan mana di Ringkasan yang mungkin menjawab.
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
  const context = await buildAskContext(access, range, sales, ctx, canSeeProspects)

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `DATA:\n${JSON.stringify(context)}` },
    { role: "assistant", content: "Siap. Tanyakan tentang periode ini." },
  ]
  for (const turn of history) {
    messages.push({ role: "user", content: turn.question })
    messages.push({ role: "assistant", content: turn.answer })
  }
  messages.push({ role: "user", content: question })

  const log = hasServiceClientConfig() ? createServiceClient() : null
  try {
    const result = await chatCompleteDetailed(config, { model: config.modelFast, temperature: 0.2, maxTokens: 500, messages })
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
