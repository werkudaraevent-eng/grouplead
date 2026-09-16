import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/require-permission'
import { apiError, authenticate, resolveCompanyId } from '../_lib/route-helpers'

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

const createSchema = z.object({
    name: z.string().trim().min(1).max(300),
    companyId: z.string().uuid().nullish(),
    /** Record owner for a company created here. Ignored when it already exists. */
    ownerId: z.string().uuid().nullish(),
    /** City for a company created here. Ignored when it already exists. */
    city: z.string().trim().max(200).nullish(),
    /** Industry (the Sector list). Set on a new company; fills an empty one; never overwrites. */
    industry: z.string().trim().max(120).nullish(),
})

/**
 * POST /api/v1/client-companies
 *
 * Registers a company a rep visited that the CRM has never heard of. Called
 * when a visit report is submitted, and again from the lead-push modal as a
 * fallback if that first registration failed.
 *
 * Find-or-create through `fn_find_or_create_client_company`, which matches on
 * the normalised name ("PT Arunika Kreasi" and "Arunika Kreasi Tbk" are one
 * company) and is the only path that survives two reps submitting the same
 * new company in the same second: the unique index decides, and the loser is
 * handed the winner's row. A check-then-insert here in two round trips was
 * exactly how "Asuransi BRI Life" came to exist twice.
 *
 * New records carry `needs_enrichment`, the same flag lead import already uses,
 * so they surface under the "Needs details" filter on the Companies screen
 * instead of sitting somewhere only this API knows about.
 */
export async function POST(request: Request) {
    const auth = await authenticate(request)
    if (!auth.ok) return auth.response

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return apiError(400, 'invalid_body', 'Request body must be JSON.')
    }

    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
        return apiError(422, 'invalid_payload', 'Company name is required.', parsed.error.issues)
    }

    const { supabase } = auth.context
    const companyId = await resolveCompanyId(auth.context, parsed.data.companyId)
    if (!companyId) {
        return apiError(403, 'no_company_access', 'You do not have access to that business unit.')
    }

    // Evaluated as the calling user, not bypassed: creating a company from Sales
    // Mission needs the same `companies` grant as creating one in LeadEngine.
    const guard = await requirePermission('companies', 'create', companyId, supabase, auth.context.userId)
    if (!guard.allowed) {
        return apiError(403, 'forbidden', 'You do not have permission to create a client company.')
    }

    const { data, error } = await supabase
        .rpc('fn_find_or_create_client_company', {
            p_name: parsed.data.name,
            p_company_id: companyId,
            p_owner_id: parsed.data.ownerId ?? null,
            p_city: parsed.data.city ?? null,
            p_industry: parsed.data.industry ?? null,
        })
        .maybeSingle()

    if (error || !data) {
        return apiError(500, 'create_failed', error?.message ?? 'Could not create the client company.')
    }

    const row = data as { id: string; name: string; created: boolean; needs_enrichment: boolean; industry: string | null }

    return NextResponse.json(
        {
            company: {
                id: row.id,
                name: row.name,
                industry: row.industry ?? null,
                needsEnrichment: row.needs_enrichment === true,
            },
            created: row.created,
        },
        { status: row.created ? 201 : 200 }
    )
}
