import { NextResponse } from "next/server"
import { searchCities, type CitySuggestion } from "@/lib/city-search"

/**
 * City autocomplete for LeadEngine's own Event City field.
 *
 * Authentication comes from the proxy: this path is not in the `/api/v1`
 * exemption, so an unauthenticated request is redirected to /login before it
 * reaches this handler and the provider key is never spent on a stranger.
 *
 * Sales Mission cannot use this route — it authenticates with a bearer token
 * and carries no cookies. It calls `/api/v1/cities/search`, which checks the
 * token itself and shares the provider module below.
 *
 * Query params:
 *   q       — search text (required, min 2 chars)
 *   country — optional ISO-2 country used only by the GeoNames fallback to
 *             bias ranking. Google returns globally-ranked results.
 */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export type { CitySuggestion }

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    // Bias only, never a restriction: Werkudara runs events outside Indonesia
    // and those cities have to stay reachable from this field.
    const result = await searchCities(searchParams.get("q") ?? "", {
        countryBias: searchParams.get("country") ?? "",
    })

    if (result.error) {
        return NextResponse.json({ cities: [], error: result.error }, { status: result.status })
    }

    return NextResponse.json({ cities: result.cities })
}
