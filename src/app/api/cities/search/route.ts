import { NextResponse } from "next/server"

/**
 * City autocomplete proxy backed by GeoNames (free, global coverage).
 *
 * Why a server route and not a direct client fetch:
 *   • Keeps the GeoNames username out of the browser bundle.
 *   • Lets us normalise/shape the response into { value, label, country }.
 *   • Single place to swap providers later (Google Places, etc.).
 *
 * Env: GEONAMES_USERNAME — register free at https://www.geonames.org/login
 * then enable the free web service for that account.
 *
 * Query params:
 *   q       — search text (required, min 2 chars)
 *   country — optional ISO-2 country to prioritise in ranking (e.g. "ID").
 *             Uses GeoNames `countryBias`, so global results still appear.
 */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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

export interface CitySuggestion {
    /** Canonical label stored on the lead + cached into master_options. */
    value: string
    /** Display label (same as value today; kept separate for future use). */
    label: string
    /** Country name for disambiguation in the dropdown. */
    country: string | null
    countryCode: string | null
    geonameId: number
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const q = (searchParams.get("q") ?? "").trim()
    const country = (searchParams.get("country") ?? "").trim().toUpperCase()

    if (q.length < 2) {
        return NextResponse.json({ cities: [] satisfies CitySuggestion[] })
    }

    const username = process.env.GEONAMES_USERNAME
    if (!username) {
        return NextResponse.json(
            { cities: [], error: "GEONAMES_USERNAME not configured" },
            { status: 500 },
        )
    }

    const url = new URL("https://secure.geonames.org/searchJSON")
    url.searchParams.set("q", q)
    // featureClass=P → populated places (cities, towns, villages).
    url.searchParams.set("featureClass", "P")
    url.searchParams.set("maxRows", "12")
    url.searchParams.set("orderby", "relevance")
    url.searchParams.set("style", "MEDIUM")
    url.searchParams.set("username", username)
    // countryBias *prioritises* this country in the ranking but still returns
    // global results — unlike `country`, which is a hard filter that would
    // force every query into that country (e.g. "new york" → "Jakarta").
    if (country) url.searchParams.set("countryBias", country)

    try {
        const res = await fetch(url.toString(), {
            // Cache identical queries for 24h — city data is effectively static.
            next: { revalidate: 60 * 60 * 24 },
        })
        if (!res.ok) {
            return NextResponse.json(
                { cities: [], error: `GeoNames HTTP ${res.status}` },
                { status: 502 },
            )
        }
        const data = (await res.json()) as GeoNamesResponse
        if (data.status) {
            // GeoNames returns 200 with a status object on quota/auth errors.
            return NextResponse.json(
                { cities: [], error: data.status.message },
                { status: 502 },
            )
        }

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

        return NextResponse.json({ cities })
    } catch {
        return NextResponse.json(
            { cities: [], error: "Failed to reach GeoNames" },
            { status: 502 },
        )
    }
}
