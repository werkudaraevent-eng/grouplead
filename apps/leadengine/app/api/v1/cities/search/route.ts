import { NextResponse } from 'next/server'
import { searchCities } from '@/lib/city-search'
import { apiError, authenticate } from '../../_lib/route-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/cities/search?q=&country=
 *
 * Location autocomplete for a Sales Mission visit. Shares the provider module
 * with LeadEngine's own `/api/cities/search`, so both apps offer the same
 * vocabulary and a provider swap happens in one place.
 *
 * The token is checked here rather than by the proxy: `/api/v1` is exempt from
 * the cookie gate so cross-app callers can authenticate with a bearer token,
 * which means each route in it owns its own door. Leaving this one open would
 * let anyone spend the Google Places quota.
 *
 * Read-only and tenant-agnostic — city names are public data, so no company
 * scoping is applied beyond requiring a valid session.
 */
export async function GET(request: Request) {
    const auth = await authenticate(request)
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(request.url)
    const country = searchParams.get('country') ?? ''
    // A bias, not a restriction. This used to restrict, on the theory that a
    // field visit is domestic; then a mission to Singapore could not find
    // Singapore. The bias keeps Surabaya above Şuraabad without hiding the
    // rest of the world.
    const result = await searchCities(searchParams.get('q') ?? '', { countryBias: country })

    if (result.error) {
        return apiError(result.status, 'city_search_failed', result.error)
    }

    return NextResponse.json({ cities: result.cities })
}
