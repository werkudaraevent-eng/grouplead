import OpenAI from "openai"

/**
 * AI client configured to use enowxai proxy (or any OpenAI-compatible endpoint).
 * Reads from env:
 *   AI_PROXY_URL         — base URL (default: http://localhost:1430/v1)
 *   AI_PROXY_KEY         — API key for the proxy
 *   AI_MODEL_FAST        — fast model for Ask AI (default: gemini-3.1-flash-lite)
 *   AI_MODEL_REASONING   — reasoning model for Analyze (default: gemini-2.5-flash)
 */
export function createAIClient() {
  const baseURL = process.env.AI_PROXY_URL || "http://localhost:1430/v1"
  const apiKey = process.env.AI_PROXY_KEY || ""

  if (!apiKey) {
    throw new Error("AI_PROXY_KEY is not configured in environment variables")
  }

  return new OpenAI({ baseURL, apiKey })
}

/** Fast model for quick Q&A (low latency) */
export function getAIModelFast() {
  return process.env.AI_MODEL_FAST || "gemini-3.1-flash-lite"
}

/** Reasoning model for deep analysis (higher quality, slower) */
export function getAIModelReasoning() {
  return process.env.AI_MODEL_REASONING || "gemini-2.5-flash"
}
