import { createServiceClient } from "@/utils/supabase/service"
import type { AiConnection, AiModel } from "./ai-proxy"

/**
 * The shared AI connection, as stored in public.ai_settings.
 *
 * Read with the service client because the key lives in Vault behind a
 * function only the service role may call, and the row is one for the whole
 * group rather than one per unit. Every caller is a server action or a
 * server component that has already checked the person's grant; nothing
 * here reaches the browser except the shape below, which carries the key
 * only as its last four characters.
 */
export interface AiSettings {
  endpoint: string
  modelFast: string | null
  modelReasoning: string | null
  hasKey: boolean
  keyHint: string | null
  models: AiModel[]
  testedAt: string | null
  testOk: boolean | null
  testError: string | null
  updatedAt: string | null
}

const SELECT = "endpoint, model_fast, model_reasoning, key_secret_id, key_hint, models, tested_at, test_ok, test_error, updated_at"

export async function readAiSettings(): Promise<AiSettings> {
  const supabase = createServiceClient()
  const { data } = await supabase.from("ai_settings").select(SELECT).eq("id", 1).maybeSingle()
  return {
    endpoint: (data?.endpoint as string | null) ?? "",
    modelFast: (data?.model_fast as string | null) ?? null,
    modelReasoning: (data?.model_reasoning as string | null) ?? null,
    hasKey: Boolean(data?.key_secret_id),
    keyHint: (data?.key_hint as string | null) ?? null,
    models: Array.isArray(data?.models) ? (data!.models as AiModel[]) : [],
    testedAt: (data?.tested_at as string | null) ?? null,
    testOk: (data?.test_ok as boolean | null) ?? null,
    testError: (data?.test_error as string | null) ?? null,
    updatedAt: (data?.updated_at as string | null) ?? null,
  }
}

/** The stored key, or null when none was stored yet. */
export async function readAiKey(): Promise<string | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc("fn_ai_read_key")
  if (error) return null
  return typeof data === "string" && data ? data : null
}

/** Store (or replace) the key. The caller has checked the grant. */
export async function storeAiKey(key: string): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase.rpc("fn_ai_store_key", { p_key: key })
  if (error) throw new Error(error.message)
}

export interface AiConfig extends AiConnection {
  modelFast: string
  modelReasoning: string
}

/**
 * The connection the app should use: the stored settings, else the AI_*
 * environment variables, else null. Null means "AI is not set up", and every
 * feature treats that as off rather than as an error.
 */
export async function resolveAiConfig(): Promise<AiConfig | null> {
  const settings = await readAiSettings()
  const endpoint = settings.endpoint || process.env.AI_PROXY_URL || ""
  const apiKey = (settings.hasKey ? await readAiKey() : null) ?? process.env.AI_PROXY_KEY ?? ""
  if (!endpoint || !apiKey) return null
  return {
    endpoint,
    apiKey,
    modelFast: settings.modelFast || process.env.AI_MODEL_FAST || "gemini-3.1-flash-lite",
    modelReasoning: settings.modelReasoning || process.env.AI_MODEL_REASONING || "gemini-2.5-flash",
  }
}
