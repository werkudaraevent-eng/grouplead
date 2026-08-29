import { NextResponse } from 'next/server'
import { apiError, authenticate } from '../_lib/route-helpers'

export const dynamic = 'force-dynamic'

const MAX_PAGE_SIZE = 50

/**
 * GET /api/v1/client-companies?search=&pageSize=
 *
 * Live search for the company picker when planning a mission. Read-only:
 * selecting a company here never writes to LeadEngine, so a search cannot
 * create duplicates.
 */
export async function GET(request: Request) {
    const auth = await authenticate(request)
    if (!auth.ok) return auth.response

    const url = new URL(request.url)
    const search = (url.searchParams.get('search') ?? '').trim()
    const requestedSize = Number(url.searchParams.get('pageSize') ?? 20)
    const pageSize = Number.isFinite(requestedSize)
        ? Math.min(Math.max(Math.trunc(requestedSize), 1), MAX_PAGE_SIZE)
        : 20

    let query = auth.context.supabase
        .from('client_companies')
        .select('id, name, industry, phone, address')
        .order('name', { ascending: true })
        .limit(pageSize)

    if (search) {
        // Escape the wildcards so a user typing "%" searches for a literal one
        // rather than matching everything.
        const escaped = search.replace(/[%_]/g, (match) => `\\${match}`)
        query = query.ilike('name', `%${escaped}%`)
    }

    const { data, error } = await query
    if (error) return apiError(500, 'search_failed', 'Could not search client companies.')

    return NextResponse.json({
        companies: (data ?? []).map((company) => ({
            id: company.id,
            name: company.name,
            industry: company.industry,
            phone: company.phone,
            address: company.address,
        })),
    })
}
