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

export interface ParsedCompletion {
  text: string | null
  /** Why the model stopped, as the proxy reports it ("stop", "length", "content_filter", …); null when it says nothing. */
  finishReason: string | null
}

/** A string, or the text of an array of parts ({ type: "text", text } or plain strings), joined; null when empty. */
function textOf(value: unknown): string | null {
  if (typeof value === "string") return value.trim() ? value : null
  if (Array.isArray(value)) {
    const joined = value
      .map((part) => (typeof part === "string" ? part : part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string" ? (part as { text: string }).text : ""))
      .join("")
    return joined.trim() ? joined : null
  }
  return null
}

/**
 * The assistant's text out of a chat completion, tolerant of proxies that
 * put it elsewhere: OpenAI's message.content (a string or an array of
 * parts), reasoning_content, a legacy choices[].text, Gemini's own
 * candidates[].content.parts passed through untouched, or a bare output.
 * The finish reason rides along so an empty answer can say why.
 */
export function parseCompletionDetailed(body: unknown): ParsedCompletion {
  if (!body || typeof body !== "object") return { text: null, finishReason: null }
  const record = body as Record<string, unknown>
  const choices = Array.isArray(record.choices) ? record.choices : []
  const first = choices[0] as Record<string, unknown> | undefined
  const message = first?.message as Record<string, unknown> | undefined
  const finishReason = typeof first?.finish_reason === "string" ? first.finish_reason : null
  for (const candidate of [message?.content, message?.reasoning_content, first?.text]) {
    const text = textOf(candidate)
    if (text) return { text, finishReason }
  }
  const candidates = Array.isArray(record.candidates) ? record.candidates : []
  const candidate = candidates[0] as Record<string, unknown> | undefined
  const content = candidate?.content as Record<string, unknown> | undefined
  const fromParts = textOf(content?.parts)
  if (fromParts) return { text: fromParts, finishReason: typeof candidate?.finishReason === "string" ? candidate.finishReason : finishReason }
  return { text: textOf(record.output), finishReason: finishReason ?? (typeof candidate?.finishReason === "string" ? candidate.finishReason : null) }
}

export function parseCompletion(body: unknown): string | null {
  return parseCompletionDetailed(body).text
}

/** The error an empty completion throws; `describeAiError` turns it into a sentence. */
function emptyAnswer(model: string, body: unknown, finishReason: string | null): Error {
  console.error("[ai-proxy] empty completion", model, finishReason, JSON.stringify(body).slice(0, 600))
  return new Error(`EMPTY_ANSWER:${finishReason ?? "unknown"}`)
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
  const parsed = parseCompletionDetailed(body)
  if (!parsed.text) throw emptyAnswer(request.model, body, parsed.finishReason)
  const text = parsed.text
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
  const parsed = parseCompletionDetailed(body)
  if (!parsed.text) throw emptyAnswer(request.model, body, parsed.finishReason)
  return parsed.text
}

/** A readable sentence for the settings page, from whatever fetch threw. */
export function describeAiError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "AbortError") return "Endpoint tidak menjawab dalam 20 detik."
    if (/HTTP 401|HTTP 403/.test(error.message)) return "Endpoint menolak kunci API (401/403)."
    if (/HTTP 404/.test(error.message)) return "Endpoint ditemukan tapi tidak punya /models. Periksa apakah alamatnya perlu diakhiri /v1."
    if (/fetch failed|ENOTFOUND|ECONNREFUSED/.test(error.message)) return "Endpoint tidak bisa dihubungi. Periksa alamatnya."
    const empty = /^EMPTY_ANSWER:(.*)$/.exec(error.message)
    if (empty) {
      const reason = empty[1]
      if (/length|max_tokens/i.test(reason)) return "Model kehabisan jatah token sebelum sempat menjawab; biasanya model yang berpikir panjang dulu. Coba lagi, atau pilih model lain di Pengaturan → AI."
      if (/content_filter|safety|blocked|recitation/i.test(reason)) return "Jawaban ditahan oleh filter konten model."
      return `Model mengembalikan jawaban kosong${reason && reason !== "unknown" ? ` (alasan berhenti: ${reason})` : ""}. Periksa modelnya di Pengaturan → AI; Simpan di sana mengujinya dengan satu pertanyaan.`
    }
    return error.message
  }
  return "Gagal menghubungi endpoint."
}
