/**
 * Talking to the AI proxy.
 *
 * The proxy is any OpenAI-compatible endpoint: GET /models lists what it
 * serves, POST /chat/completions answers. Plain fetch, no SDK, so the same
 * file works in both apps and the request shape is visible here. Pure
 * helpers (endpoint normalising, response parsing) are separate so they can
 * be tested without a network.
 */

export interface AiConnection {
  /** Base URL including the version path, e.g. https://proxy.example.com/v1 */
  endpoint: string
  apiKey: string
}

export interface AiModel {
  id: string
  ownedBy: string | null
}

/**
 * The base URL as the proxy expects it: trimmed, no trailing slash, and with
 * the /v1 path added when the person typed only the host. Null when it is not
 * an http(s) URL at all.
 */
export function normalizeEndpoint(raw: string): string | null {
  const trimmed = raw.trim().replace(/\/+$/, "")
  if (!trimmed) return null
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null
  if (url.pathname === "" || url.pathname === "/") url.pathname = "/v1"
  return url.toString().replace(/\/+$/, "")
}

/** The model ids out of a GET /models body, tolerant of the proxies that wrap or rename things. */
export function parseModels(body: unknown): AiModel[] {
  const list = Array.isArray(body)
    ? body
    : body && typeof body === "object" && Array.isArray((body as { data?: unknown }).data)
      ? ((body as { data: unknown[] }).data)
      : body && typeof body === "object" && Array.isArray((body as { models?: unknown }).models)
        ? ((body as { models: unknown[] }).models)
        : []
  const models: AiModel[] = []
  for (const item of list) {
    if (typeof item === "string") {
      models.push({ id: item, ownedBy: null })
      continue
    }
    if (!item || typeof item !== "object") continue
    const record = item as Record<string, unknown>
    const id = typeof record.id === "string" ? record.id : typeof record.name === "string" ? record.name : null
    if (!id) continue
    models.push({ id, ownedBy: typeof record.owned_by === "string" ? record.owned_by : null })
  }
  return models.sort((a, b) => a.id.localeCompare(b.id))
}

/** The assistant's text out of a chat completion, tolerant of proxies that put it elsewhere. */
export function parseCompletion(body: unknown): string | null {
  if (!body || typeof body !== "object") return null
  const record = body as Record<string, unknown>
  const choices = Array.isArray(record.choices) ? record.choices : []
  const first = choices[0] as Record<string, unknown> | undefined
  const message = first?.message as Record<string, unknown> | undefined
  for (const candidate of [message?.content, message?.reasoning_content]) {
    if (typeof candidate === "string" && candidate.trim()) return candidate
  }
  if (typeof record.output === "string" && record.output.trim()) return record.output
  return null
}

const TIMEOUT_MS = 20_000

async function call(connection: AiConnection, path: string, init: RequestInit = {}): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(`${connection.endpoint}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${connection.apiKey}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
      cache: "no-store",
    })
    const text = await response.text()
    let body: unknown = null
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      body = null
    }
    if (!response.ok) {
      const detail =
        body && typeof body === "object" && (body as { error?: { message?: string } }).error?.message
          ? (body as { error: { message: string } }).error.message
          : text.slice(0, 200)
      throw new Error(`HTTP ${response.status}${detail ? `: ${detail}` : ""}`)
    }
    return body
  } finally {
    clearTimeout(timer)
  }
}

/** What the proxy serves. Throws with a readable reason when it cannot be reached or refuses the key. */
export async function listModels(connection: AiConnection): Promise<AiModel[]> {
  return parseModels(await call(connection, "/models"))
}

export interface ChatRequest {
  model: string
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
  temperature?: number
  maxTokens?: number
}

export interface ChatResult {
  text: string
  promptTokens: number | null
  completionTokens: number | null
}

/** One chat completion, with the token counts the proxy reports (null when it reports none). */
export async function chatCompleteDetailed(connection: AiConnection, request: ChatRequest): Promise<ChatResult> {
  const body = await call(connection, "/chat/completions", {
    method: "POST",
    body: JSON.stringify({
      model: request.model,
      messages: request.messages,
      temperature: request.temperature ?? 0.3,
      ...(request.maxTokens ? { max_tokens: request.maxTokens } : {}),
    }),
  })
  const text = parseCompletion(body)
  if (!text) throw new Error(`EMPTY_ANSWER:${request.model}`)
  const usage = body && typeof body === "object" ? (body as { usage?: Record<string, unknown> }).usage : undefined
  const count = (key: string) => (usage && typeof usage[key] === "number" ? (usage[key] as number) : null)
  return { text, promptTokens: count("prompt_tokens"), completionTokens: count("completion_tokens") }
}

/** One chat completion, returned as the assistant's text. */
export async function chatComplete(connection: AiConnection, request: ChatRequest): Promise<string> {
  const body = await call(connection, "/chat/completions", {
    method: "POST",
    body: JSON.stringify({
      model: request.model,
      messages: request.messages,
      temperature: request.temperature ?? 0.3,
      ...(request.maxTokens ? { max_tokens: request.maxTokens } : {}),
    }),
  })
  const text = parseCompletion(body)
  if (!text) throw new Error(`Model ${request.model} mengembalikan jawaban kosong.`)
  return text
}

/** A readable sentence for the settings page, from whatever fetch threw. */
export function describeAiError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "AbortError") return "Endpoint tidak menjawab dalam 20 detik."
    if (/HTTP 401|HTTP 403/.test(error.message)) return "Endpoint menolak kunci API (401/403)."
    if (/HTTP 404/.test(error.message)) return "Endpoint ditemukan tapi tidak punya /models. Periksa apakah alamatnya perlu diakhiri /v1."
    if (/fetch failed|ENOTFOUND|ECONNREFUSED/.test(error.message)) return "Endpoint tidak bisa dihubungi. Periksa alamatnya."
    return error.message
  }
  return "Gagal menghubungi endpoint."
}
