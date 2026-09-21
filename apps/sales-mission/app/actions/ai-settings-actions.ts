"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createServiceClient } from "@/utils/supabase/service"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { readAiKey, readAiSettings, storeAiKey, type AiSettings } from "@/lib/ai/ai-settings"
import { chatComplete, describeAiError, listModels, normalizeEndpoint, type AiModel } from "@/lib/ai/ai-proxy"
import { recordAiUsage } from "@/lib/ai/ai-usage"
import type { ActionResult } from "@/types/action-result"
import { paths } from "@/lib/paths"
import { NO_ACCESS_MESSAGE } from "@/lib/brand"

const NO_PERMISSION = "Anda tidak punya izin mengubah pengaturan AI."

async function requireAiAdmin() {
  const access = await getSalesMissionAccess()
  if (!access) return { error: NO_ACCESS_MESSAGE }
  if (!(await canPerform(access, "sales_mission_settings", "update"))) return { error: NO_PERMISSION }
  return { access }
}

const connectionSchema = z.object({
  endpoint: z.string().trim().max(500),
  /** Empty means "keep the stored key". */
  apiKey: z.string().trim().max(500),
})

export interface AiTestResult {
  models: AiModel[]
}

/**
 * Try the endpoint: list its models with the key typed in the form, or the
 * stored key when the field was left empty. Nothing is saved; the form shows
 * the outcome and fills the model pickers from the list.
 */
export async function testAiConnection(input: unknown): Promise<ActionResult<AiTestResult>> {
  const gate = await requireAiAdmin()
  if ("error" in gate) return { success: false, error: gate.error }

  const parsed = connectionSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: "Isian tidak valid." }
  const endpoint = normalizeEndpoint(parsed.data.endpoint)
  if (!endpoint) return { success: false, error: "Endpoint harus berupa alamat http(s), misalnya https://proxy.contoh.com/v1." }
  const apiKey = parsed.data.apiKey || (await readAiKey())
  if (!apiKey) return { success: false, error: "Isi kunci API dulu; belum ada kunci tersimpan." }

  try {
    const models = await listModels({ endpoint, apiKey })
    return { success: true, data: { models } }
  } catch (error) {
    return { success: false, error: describeAiError(error) }
  }
}

const saveSchema = connectionSchema.extend({
  modelFast: z.string().trim().max(200),
  modelReasoning: z.string().trim().max(200),
})

/**
 * Save the connection. The key goes to Vault through the service role after
 * the grant check above; the row keeps everything else. The endpoint is
 * tested once more on save so the stored status is about what was stored,
 * and the model list from that test feeds the pickers next time.
 */
export async function saveAiSettings(input: unknown): Promise<ActionResult<AiSettings>> {
  const gate = await requireAiAdmin()
  if ("error" in gate) return { success: false, error: gate.error }

  const parsed = saveSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: "Isian tidak valid." }
  const endpoint = normalizeEndpoint(parsed.data.endpoint)
  if (!endpoint) return { success: false, error: "Endpoint harus berupa alamat http(s), misalnya https://proxy.contoh.com/v1." }

  try {
    if (parsed.data.apiKey) await storeAiKey(parsed.data.apiKey)
  } catch (error) {
    console.error("[saveAiSettings] vault", error)
    return { success: false, error: "Kunci API gagal disimpan ke Vault. Pastikan migrasi 20260920100000 sudah dijalankan." }
  }

  const apiKey = parsed.data.apiKey || (await readAiKey())
  let models: AiModel[] = []
  let testOk: boolean | null = null
  let testError: string | null = null
  if (apiKey) {
    try {
      models = await listModels({ endpoint, apiKey })
      testOk = true
    } catch (error) {
      testOk = false
      testError = describeAiError(error)
    }
    // A model that lists but does not answer is caught here, not in Tanya AI.
    if (testOk) {
      const chosen = [...new Set([parsed.data.modelFast, parsed.data.modelReasoning].filter(Boolean))]
      for (const model of chosen) {
        try {
          await chatComplete({ endpoint, apiKey }, { model, messages: [{ role: "user", content: "Balas hanya dengan satu kata: OK" }] })
          void recordAiUsage({ feature: "uji_model", model, promptTokens: null, completionTokens: null, ok: true })
        } catch (error) {
          void recordAiUsage({ feature: "uji_model", model, promptTokens: null, completionTokens: null, ok: false })
          testOk = false
          testError = `Model ${model} tidak menjawab: ${describeAiError(error)}`
          break
        }
      }
    }
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from("ai_settings")
    .update({
      endpoint,
      model_fast: parsed.data.modelFast || null,
      model_reasoning: parsed.data.modelReasoning || null,
      ...(testOk === null ? {} : { models, tested_at: new Date().toISOString(), test_ok: testOk, test_error: testError }),
      updated_by: gate.access.userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1)
  if (error) {
    console.error("[saveAiSettings]", error.code, error.message)
    return { success: false, error: `Pengaturan gagal disimpan: ${error.message}` }
  }

  revalidatePath(paths.settings.ai)
  return { success: true, data: await readAiSettings() }
}
