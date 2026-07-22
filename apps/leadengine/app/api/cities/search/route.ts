import { NextResponse } from "next/server"

/**
 * City autocomplete proxy.
 *
 * Primary provider: Google Places Autocomplete (New). Falls back to GeoNames
 * when GOOGLE_PLACES_API_KEY is not configured, so the endpoint keeps working
 * during the transition.
 *
 * Why a server route and not a direct client fetch:
 *   • Keeps the API key / username out of the browser bundle.
 *   • Normalises every provider into the same { value, label, country } shape.
 *   • Single place to swap providers.
 *
 * Env:
 *   GOOGLE_PLACES_API_KEY — Google Cloud key with "Places API (New)" enabled.
 *   GEONAMES_USERNAME     — optional fallback; register at geonames.org/login.
 *
 * Query params:
 *   q       — search text (required, min 2 chars)
 *   country — optional ISO-2 country used only by the GeoNames fallback to
 *             bias ranking. Google returns globally-ranked results.
 */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export interface CitySuggestion {
    /** Canonical label stored on the lead + cached into master_options. */
    value: string
    /** Display label (same as value today; kept separate for future use). */
    label: string
    /** Country / region for disambiguation in the dropdown. */
    country: string | null
    countryCode: string | null
    /** Google place id when sourced from Google; null for GeoNames. */
    placeId?: string | null
    /** GeoNames id when sourced from GeoNames; absent for Google. */
    geonameId?: number
}

// ─── Google Places Autocomplete (New) ──────────────────────────────────────

interface GooglePrediction {
    placePrediction?: {
        placeId?: string
        structuredFormat?: {
            mainText?: { text?: string }
            secondaryText?: { text?: string }
        }
        text?: { text?: string }
    }
}

interface GoogleAutocompleteResponse {
    suggestions?: GooglePrediction[]
    error?: { message?: string }
}

async function searchGoogle(q: string, apiKey: string): Promise<CitySuggestion[]> {
    const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
        },
        body: JSON.stringify({
            input: q,
            // "(cities)" is the type collection for populated places.
            includedPrimaryTypes: ["(cities)"],
            languageCode: "en",
        }),
        // Cache identical queries for 24h — city data is effectively static.
        next: { revalidate: 60 * 60 * 24 },
    })

    if (!res.ok) {
        let message = `Google HTTP ${res.status}`
        try {
            const body = (await res.json()) as GoogleAutocompleteResponse
            if (body.error?.message) message = body.error.message
        } catch {
            // ignore parse error, keep generic message
        }
        throw new Error(message)
    }

    const data = (await res.json()) as GoogleAutocompleteResponse
    const seen = new Set<string>()
    const cities: CitySuggestion[] = []
    for (const s of data.suggestions ?? []) {
        const pred = s.placePrediction
        if (!pred) continue
        const name = pred.structuredFormat?.mainText?.text?.trim() || pred.text?.text?.trim()
        if (!name) continue
        const key = name.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        cities.push({
            value: name,
            label: name,
            country: pred.structuredFormat?.secondaryText?.text?.trim() || null,
            countryCode: null,
            placeId: pred.placeId ?? null,
        })
    }
    return cities
}

// ─── GeoNames fallback ──────────────────────────────────────────────────────

interface GeoNameRow {
    name: string
    countryName?: string
    countryCode?: string
    adminName1?: string
    geonameId: number
    fcode?: string
}

interface GeoNamesResponse {
    geonames?: GeoNameRow[]
    status?: { message: string; value: number }
}

async function searchGeoNames(q: string, country: string, username: string): Promise<CitySuggestion[]> {
    const url = new URL("https://secure.geonames.org/searchJSON")
    url.searchParams.set("q", q)
    url.searchParams.set("featureClass", "P")
    url.searchParams.set("maxRows", "12")
    url.searchParams.set("orderby", "relevance")
    url.searchParams.set("style", "MEDIUM")
    url.searchParams.set("username", username)
    if (country) url.searchParams.set("countryBias", country)

    const res = await fetch(url.toString(), { next: { revalidate: 60 * 60 * 24 } })
    if (!res.ok) throw new Error(`GeoNames HTTP ${res.status}`)
    const data = (await res.json()) as GeoNamesResponse
    if (data.status) throw new Error(data.status.message)

    const seen = new Set<string>()
    const cities: CitySuggestion[] = []
    for (const row of data.geonames ?? []) {
        const name = row.name?.trim()
        if (!name) continue
        const key = name.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        cities.push({
            value: name,
            label: name,
            country: row.countryName ?? null,
            countryCode: row.countryCode ?? null,
            geonameId: row.geonameId,
        })
    }
    return cities
}

// ─── Route handler ──────────────────────────────────────────────────────────

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const q = (searchParams.get("q") ?? "").trim()
    const country = (searchParams.get("country") ?? "").trim().toUpperCase()

    if (q.length < 2) {
        return NextResponse.json({ cities: [] satisfies CitySuggestion[] })
    }

    const googleKey = process.env.GOOGLE_PLACES_API_KEY
    const username = process.env.GEONAMES_USERNAME

    // 1. Prefer Google when configured.
    if (googleKey) {
        try {
            const cities = await searchGoogle(q, googleKey)
            return NextResponse.json({ cities })
        } catch (err) {
            const message = err instanceof Error ? err.message : "Google Places error"
            // Fall through to GeoNames if available; otherwise surface the error.
            if (!username) {
                return NextResponse.json({ cities: [], error: message }, { status: 502 })
            }
        }
    }

    // 2. GeoNames fallback (or primary when no Google key).
    if (username) {
        try {
            const cities = await searchGeoNames(q, country, username)
            return NextResponse.json({ cities })
        } catch (err) {
            const message = err instanceof Error ? err.message : "GeoNames error"
            return NextResponse.json({ cities: [], error: message }, { status: 502 })
        }
    }

    return NextResponse.json(
        { cities: [], error: "No city provider configured (set GOOGLE_PLACES_API_KEY or GEONAMES_USERNAME)" },
        { status: 500 },
    )
}

