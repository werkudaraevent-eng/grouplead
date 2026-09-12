/**
 * City autocomplete providers.
 *
 * Shared by two routes: the cookie-authenticated `/api/cities/search` that
 * LeadEngine's own Event City field uses, and the bearer-authenticated
 * `/api/v1/cities/search` that Sales Mission calls for a mission's location.
 * One implementation, so the two cannot drift into returning different shapes
 * for the same query.
 *
 * Why a server module and not a direct client fetch:
 *   • Keeps the API key / username out of the browser bundle.
 *   • Normalises every provider into the same { value, label, country } shape.
 *   • Single place to swap providers.
 *
 * Env:
 *   GOOGLE_PLACES_API_KEY — Google Cloud key with "Places API (New)" enabled.
 *   GEONAMES_USERNAME     — optional fallback; register at geonames.org/login.
 */

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

export interface CitySearchResult {
    cities: CitySuggestion[]
    error?: string
    /** HTTP status the caller should return; 200 when the lookup worked. */
    status: number
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

async function searchGoogle(q: string, apiKey: string, region: string): Promise<CitySuggestion[]> {
    const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
        },
        body: JSON.stringify({
            input: q,
            // "(cities)" is the type collection for populated places. It also
            // covers Indonesian kota and kecamatan, which is what a mission
            // location usually is.
            includedPrimaryTypes: ["(cities)"],
            languageCode: "en",
            // Only when the caller asks for it. LeadEngine's Event City stays
            // global — Werkudara runs events abroad — while Sales Mission pins
            // to Indonesia, where "Suraba" otherwise offers Şuraabad in
            // Azerbaijan above Surabaya.
            ...(region ? { includedRegionCodes: [region] } : {}),
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

export interface CitySearchOptions {
    /**
     * ISO-2 code that biases GeoNames ranking. Not a filter: results outside it
     * still appear, just lower. This is what LeadEngine's Event City has always
     * sent, and international event cities depend on staying reachable.
     */
    countryBias?: string
    /**
     * ISO-2 code that restricts Google to that country. A filter, not a bias —
     * anything outside disappears. Sales Mission uses it because a visit is
     * always domestic, and "Suraba" otherwise ranks Şuraabad in Azerbaijan
     * above Surabaya.
     */
    restrictToRegion?: string
}

/**
 * Look up cities, preferring Google and falling back to GeoNames.
 *
 * The two country options are deliberately separate. Collapsing them into one
 * would silently turn LeadEngine's long-standing Indonesian *bias* into a hard
 * restriction the moment Google became the active provider.
 *
 * Never throws: a provider failure comes back as `{ cities: [], error, status }`
 * so both routes report it the same way.
 */
export async function searchCities(
    q: string,
    { countryBias = "", restrictToRegion = "" }: CitySearchOptions = {}
): Promise<CitySearchResult> {
    const query = q.trim()
    if (query.length < 2) return { cities: [], status: 200 }

    const region = restrictToRegion.trim().toUpperCase()
    const bias = countryBias.trim().toUpperCase()
    const googleKey = process.env.GOOGLE_PLACES_API_KEY
    const username = process.env.GEONAMES_USERNAME

    // 1. Prefer Google when configured.
    if (googleKey) {
        try {
            return { cities: await searchGoogle(query, googleKey, region), status: 200 }
        } catch (err) {
            const message = err instanceof Error ? err.message : "Google Places error"
            // Fall through to GeoNames if available; otherwise surface the error.
            if (!username) return { cities: [], error: message, status: 502 }
        }
    }

    // 2. GeoNames fallback (or primary when no Google key).
    if (username) {
        try {
            return { cities: await searchGeoNames(query, bias, username), status: 200 }
        } catch (err) {
            const message = err instanceof Error ? err.message : "GeoNames error"
            return { cities: [], error: message, status: 502 }
        }
    }

    return {
        cities: [],
        error: "No city provider configured (set GOOGLE_PLACES_API_KEY or GEONAMES_USERNAME)",
        status: 500,
    }
}
