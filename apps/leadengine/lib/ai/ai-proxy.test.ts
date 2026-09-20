import { describe, expect, it } from "vitest"
import { normalizeEndpoint, parseCompletion, parseModels } from "./ai-proxy"

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
})
