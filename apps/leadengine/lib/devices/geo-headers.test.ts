import { describe, expect, it } from "vitest"
import { readRequestPlace } from "./geo-headers"

const from = (headers: Record<string, string>) => (name: string) => headers[name] ?? null

describe("readRequestPlace", () => {
  it("decodes Vercel's city and keeps the country code", () => {
    expect(readRequestPlace(from({ "x-vercel-ip-city": "S%C3%A3o%20Paulo", "x-vercel-ip-country": "BR" }))).toEqual({ city: "São Paulo", country: "BR" })
    expect(readRequestPlace(from({ "x-vercel-ip-city": "Jakarta", "x-vercel-ip-country": "id" }))).toEqual({ city: "Jakarta", country: "ID" })
  })

  it("reads nothing locally, where the headers do not exist", () => {
    expect(readRequestPlace(from({}))).toEqual({ city: null, country: null })
  })

  it("keeps a city it cannot decode as written, and drops a malformed country", () => {
    expect(readRequestPlace(from({ "x-vercel-ip-city": "Bad%E0", "x-vercel-ip-country": "Indonesia" }))).toEqual({ city: "Bad%E0", country: null })
    expect(readRequestPlace(from({ "x-vercel-ip-city": "   ", "x-vercel-ip-country": "" }))).toEqual({ city: null, country: null })
  })

  it("caps a city at 120 characters", () => {
    expect(readRequestPlace(from({ "x-vercel-ip-city": "a".repeat(300) })).city).toHaveLength(120)
  })
})
