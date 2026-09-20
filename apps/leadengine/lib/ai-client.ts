import OpenAI from "openai"
import { resolveAiConfig, type AiConfig } from "@/lib/ai/ai-settings"

/**
 * The AI connection for the dashboard's Ask AI and Analyze.
 *
 * The endpoint, key and models come from Settings → AI (public.ai_settings,
 * key in Vault), shared with Sales Activity, and fall back to the AI_*
 * environment variables while that row is empty:
 *   AI_PROXY_URL, AI_PROXY_KEY, AI_MODEL_FAST, AI_MODEL_REASONING
 */
export async function getAiConfig(): Promise<AiConfig> {
  const config = await resolveAiConfig()
  if (!config) {
    throw new Error("AI is not set up. Enter the endpoint and API key under Settings → AI.")
  }
  return config
}

/** An OpenAI-compatible client on the configured proxy, with the models it should use. */
export async function createAIClient(): Promise<{ client: OpenAI; modelFast: string; modelReasoning: string }> {
  const config = await getAiConfig()
  return {
    client: new OpenAI({ baseURL: config.endpoint, apiKey: config.apiKey }),
    modelFast: config.modelFast,
    modelReasoning: config.modelReasoning,
  }
}
