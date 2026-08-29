import { describe, expect, it } from "vitest"
import { generateBoardToken, hashBoardToken, hashesMatch } from "./board-access"

describe("hashBoardToken", () => {
  it("is deterministic", () => {
    expect(hashBoardToken("abc")).toBe(hashBoardToken("abc"))
  })

  it("produces a different digest for a different token", () => {
    expect(hashBoardToken("abc")).not.toBe(hashBoardToken("abd"))
  })

  it("never returns the token itself", () => {
    expect(hashBoardToken("abc")).not.toContain("abc")
  })

  it("returns a 64-character hex digest", () => {
    expect(hashBoardToken("abc")).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe("generateBoardToken", () => {
  it("returns a token with its matching hash", () => {
    const { token, hash } = generateBoardToken()
    expect(hashBoardToken(token)).toBe(hash)
  })

  it("is URL-safe, since the token is typed into a TV's address bar", () => {
    for (let i = 0; i < 20; i += 1) {
      expect(generateBoardToken().token).toMatch(/^[A-Za-z0-9_-]+$/)
    }
  })

  it("does not repeat", () => {
    const seen = new Set(Array.from({ length: 50 }, () => generateBoardToken().token))
    expect(seen.size).toBe(50)
  })

  it("is long enough not to be guessable", () => {
    // 24 random bytes, base64url encoded.
    expect(generateBoardToken().token.length).toBeGreaterThanOrEqual(32)
  })
})

describe("hashesMatch", () => {
  it("matches identical digests", () => {
    const hash = hashBoardToken("same")
    expect(hashesMatch(hash, hash)).toBe(true)
  })

  it("rejects different digests", () => {
    expect(hashesMatch(hashBoardToken("a"), hashBoardToken("b"))).toBe(false)
  })

  it("rejects empty input rather than treating it as a match", () => {
    expect(hashesMatch("", "")).toBe(false)
  })

  it("rejects digests of different lengths without throwing", () => {
    expect(hashesMatch(hashBoardToken("a"), "abcd")).toBe(false)
  })
})
