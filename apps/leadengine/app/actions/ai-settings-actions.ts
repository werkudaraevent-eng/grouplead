"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createServiceClient } from "@/utils/supabase/service"
import { requirePermission } from "@/lib/require-permission"
import { readAiKey, readAiSettings, storeAiKey, type AiSettings } from "@/lib/ai/ai-settings"
import { chatComplete, describeAiError, listModels, normalizeEndpoint, type AiModel } from "@/lib/ai/ai-proxy"
import { recordAiUsage } from "@/lib/ai/ai-usage"
import type { ActionResult } from "@/types/action-result"

const connectionSchema = z.object({
  endpoint: z.string().trim().max(500),
  /** Empty means "keep the stored key". */
  apiKey: z.string().trim().max(500),
})

export interface AiTestResult {
  models: AiModel[]
}

const ENDPOINT_MESSAGE = "The endpoint must be an http(s) address, for example https://proxy.example.com/v1."

/**
 * Try the endpoint: list its models with the key typed in the form, or the
 * stored key when the field was left empty. Nothing is saved.
 */
export async function testAiConnection(input: unknown): Promise<ActionResult<AiTestResult>> {
  const guard = await requirePermission("settings", "update")
  if (!guard.allowed) return guard.error

  const parsed = connectionSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: "Invalid input." }
  const endpoint = normalizeEndpoint(parsed.data.endpoint)
  if (!endpoint) return { success: false, error: ENDPOINT_MESSAGE }
  const apiKey = parsed.data.apiKey || (await readAiKey())
  if (!apiKey) return { success: false, error: "Enter the API key first; none is stored yet." }

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
 * the grant check; the row keeps the rest. The endpoint is tested once more
 * on save so the stored status describes what was stored.
 */
export async function saveAiSettings(input: unknown): Promise<ActionResult<AiSettings>> {
  const guard = await requirePermission("settings", "update")
  if (!guard.allowed) return guard.error

  const parsed = saveSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: "Invalid input." }
  const endpoint = normalizeEndpoint(parsed.data.endpoint)
  if (!endpoint) return { success: false, error: ENDPOINT_MESSAGE }

  try {
    if (parsed.data.apiKey) await storeAiKey(parsed.data.apiKey)
  } catch (error) {
    console.error("[saveAiSettings] vault", error)
    return { success: false, error: "The API key could not be stored in Vault. Make sure migration 20260920100000 has been applied." }
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
    // A model that lists but does not answer is caught here, not on the dashboard.
    if (testOk) {
      const chosen = [...new Set([parsed.data.modelFast, parsed.data.modelReasoning].filter(Boolean))]
      for (const model of chosen) {
        try {
          await chatComplete({ endpoint, apiKey }, { model, messages: [{ role: "user", content: "Reply with one word only: OK" }] })
          void recordAiUsage({ feature: "uji_model", model, promptTokens: null, completionTokens: null, ok: true })
        } catch (error) {
          void recordAiUsage({ feature: "uji_model", model, promptTokens: null, completionTokens: null, ok: false })
          testOk = false
          testError = `Model ${model} did not answer: ${describeAiError(error)}`
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
      updated_by: guard.userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1)
  if (error) {
    console.error("[saveAiSettings]", error.code, error.message)
    return { success: false, error: `Settings could not be saved: ${error.message}` }
  }

  revalidatePath("/settings/ai")
  return { success: true, data: await readAiSettings() }
}
