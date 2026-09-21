import { describe, expect, it } from "vitest"
import { describeAiError, normalizeEndpoint, parseCompletion, parseCompletionDetailed, parseModels } from "./ai-proxy"

describe("normalizeEndpoint", () => {
  it("keeps a full base URL and strips trailing slashes", () => {
    expect(normalizeEndpoint(" https://proxy.example.com/v1/ ")).toBe("https://proxy.example.com/v1")
    expect(normalizeEndpoint("http://localhost:1430/v1")).toBe("http://localhost:1430/v1")
  })
  it("adds /v1 when only the host was typed", () => {
    expect(normalizeEndpoint("https://proxy.example.com")).toBe("https://proxy.example.com/v1")
  })
  it("refuses what is not an http(s) URL", () => {
    expect(normalizeEndpoint("")).toBeNull()
    expect(normalizeEndpoint("proxy.example.com")).toBeNull()
    expect(normalizeEndpoint("ftp://x")).toBeNull()
  })
})

describe("parseModels", () => {
  it("reads the OpenAI shape, sorted by id", () => {
    expect(parseModels({ object: "list", data: [{ id: "gemini-2.5-flash", owned_by: "google" }, { id: "claude-sonnet-5" }] })).toEqual([
      { id: "claude-sonnet-5", ownedBy: null },
      { id: "gemini-2.5-flash", ownedBy: "google" },
    ])
  })
  it("tolerates bare arrays, name fields and junk", () => {
    expect(parseModels(["b", "a"])).toEqual([{ id: "a", ownedBy: null }, { id: "b", ownedBy: null }])
    expect(parseModels({ models: [{ name: "x" }, 42, null] })).toEqual([{ id: "x", ownedBy: null }])
    expect(parseModels(null)).toEqual([])
  })
})

describe("parseCompletion", () => {
  it("prefers message.content, then reasoning_content, then output", () => {
    expect(parseCompletion({ choices: [{ message: { content: "halo" } }] })).toBe("halo")
    expect(parseCompletion({ choices: [{ message: { content: "", reasoning_content: "pikir" } }] })).toBe("pikir")
    expect(parseCompletion({ output: "teks" })).toBe("teks")
    expect(parseCompletion({ choices: [] })).toBeNull()
  })

  it("reads content given as parts, a legacy text choice, and Gemini's own shape", () => {
    expect(parseCompletion({ choices: [{ message: { content: [{ type: "text", text: "satu " }, { type: "text", text: "dua" }] } }] })).toBe("satu dua")
    expect(parseCompletion({ choices: [{ text: "lama" }] })).toBe("lama")
    expect(parseCompletion({ candidates: [{ content: { parts: [{ text: "asli" }] } }] })).toBe("asli")
    expect(parseCompletion({ choices: [{ message: { content: [] } }] })).toBeNull()
  })

  it("keeps the finish reason so an empty answer can say why", () => {
    expect(parseCompletionDetailed({ choices: [{ message: { content: "" }, finish_reason: "length" }] })).toEqual({ text: null, finishReason: "length" })
    expect(parseCompletionDetailed({ candidates: [{ content: { parts: [] }, finishReason: "SAFETY" }] })).toEqual({ text: null, finishReason: "SAFETY" })
    expect(parseCompletionDetailed({ choices: [{ message: { content: "ok" }, finish_reason: "stop" }] })).toEqual({ text: "ok", finishReason: "stop" })
    expect(parseCompletionDetailed(null)).toEqual({ text: null, finishReason: null })
  })
})

describe("describeAiError", () => {
  it("turns a Cloudflare origin error into a sentence, never markup", () => {
    const text = describeAiError(new Error("HTTP 530: Cloudflare error 1033"))
    expect(text).toMatch(/Cloudflare/)
    expect(text).not.toMatch(/</)
  })

  it("names an empty answer's stop reason", () => {
    expect(describeAiError(new Error("EMPTY_ANSWER:length"))).toMatch(/token/i)
    expect(describeAiError(new Error("EMPTY_ANSWER:unknown"))).not.toMatch(/unknown/)
  })
})
