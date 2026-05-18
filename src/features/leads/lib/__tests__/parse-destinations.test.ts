import { describe, it, expect } from "vitest"
import { parseDestinations } from "../parse-destinations"

const cityMap = new Map<string, string>([
    ["event_city|jakarta", "Jakarta"],
    ["event_city|surabaya", "Surabaya"],
    ["event_city|bandung", "Bandung"],
    ["event_city|yogyakarta", "Yogyakarta"],
    ["event_city|lombok", "Lombok"],
    ["event_city|bali", "Bali"],
    ["event_city|labuan bajo", "Labuan Bajo"],
])

describe("parseDestinations", () => {
    it("splits comma-separated cities", () => {
        const r = parseDestinations("JAKARTA, SURABAYA", "", cityMap)
        expect(r.destinations).toEqual([
            { city: "Jakarta", venue: "" },
            { city: "Surabaya", venue: "" },
        ])
        expect(r.warnings).toEqual([])
    })

    it("splits slash-separated cities", () => {
        const r = parseDestinations("BANDUNG / LOMBOK / LAMPUNG", "", cityMap)
        expect(r.destinations.map((d) => d.city)).toEqual(["Bandung", "Lombok", "Lampung"])
        // "LAMPUNG" not in master options → kept raw + warning
        expect(r.warnings.length).toBe(1)
        expect(r.warnings[0]).toMatch(/Lampung/)
    })

    it("splits AND separator", () => {
        const r = parseDestinations("BALI AND LABUAN BAJO", "", cityMap)
        expect(r.destinations.map((d) => d.city)).toEqual(["Bali", "Labuan Bajo"])
    })

    it("applies single venue to all cities", () => {
        const r = parseDestinations("JAKARTA, BANDUNG", "Mulia Resort", cityMap)
        expect(r.destinations).toEqual([
            { city: "Jakarta", venue: "Mulia Resort" },
            { city: "Bandung", venue: "Mulia Resort" },
        ])
    })

    it("preserves single-city case", () => {
        const r = parseDestinations("JAKARTA", "", cityMap)
        expect(r.destinations).toEqual([{ city: "Jakarta", venue: "" }])
    })

    it("returns empty for blank input", () => {
        const r = parseDestinations("", "", cityMap)
        expect(r.destinations).toEqual([])
    })

    it("trims internal whitespace", () => {
        const r = parseDestinations("  YOGYAKARTA  ,  BANDUNG  ", "", cityMap)
        expect(r.destinations.map((d) => d.city)).toEqual(["Yogyakarta", "Bandung"])
    })

    it("handles multiple separators in one input", () => {
        const r = parseDestinations("JAKARTA, BANDUNG / YOGYAKARTA", "", cityMap)
        expect(r.destinations.map((d) => d.city)).toEqual(["Jakarta", "Bandung", "Yogyakarta"])
    })

    it("dedupes repeated cities", () => {
        const r = parseDestinations("JAKARTA, BANDUNG, JAKARTA", "", cityMap)
        expect(r.destinations).toEqual([
            { city: "Jakarta", venue: "" },
            { city: "Bandung", venue: "" },
        ])
    })

    it("smart-cases unknown cities (no master match)", () => {
        const r = parseDestinations("PADANG, MEDAN", "", cityMap)
        expect(r.destinations.map((d) => d.city)).toEqual(["Padang", "Medan"])
        expect(r.warnings.length).toBe(2)
    })
})
