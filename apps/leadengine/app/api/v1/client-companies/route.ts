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
})

/**
 * POST /api/v1/client-companies
 *
 * Registers a company a rep met in the field but that the CRM has never heard
 * of. Without this, a lead pushed from such a mission arrived with no company
 * attached and nobody was told to fix it.
 *
 * Find-or-create, matched on name case-insensitively. Reps type the same
 * company three different ways across three missions, and three thin duplicates
 * are worse for the CRM than the missing record was.
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
    const guard = await requirePermission('companies', 'create', companyId, supabase)
    if (!guard.allowed) {
        return apiError(403, 'forbidden', 'You do not have permission to create a client company.')
    }

    const name = parsed.data.name
    const escaped = name.replace(/[%_]/g, (match) => `\\${match}`)

    const { data: existing, error: lookupError } = await supabase
        .from('client_companies')
        .select('id, name, industry, needs_enrichment')
        .ilike('name', escaped)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle()

    if (lookupError) {
        return apiError(500, 'lookup_failed', 'Could not check for an existing company.')
    }

    if (existing) {
        return NextResponse.json({
            company: {
                id: existing.id,
                name: existing.name,
                industry: existing.industry,
                needsEnrichment: existing.needs_enrichment === true,
            },
            created: false,
        })
    }

    const { data: created, error: insertError } = await supabase
        .from('client_companies')
        .insert({ name, company_id: companyId, needs_enrichment: true })
        .select('id, name, industry, needs_enrichment')
        .single()

    if (insertError || !created) {
        return apiError(500, 'create_failed', 'Could not create the client company.')
    }

    return NextResponse.json(
        {
            company: {
                id: created.id,
                name: created.name,
                industry: created.industry,
                needsEnrichment: created.needs_enrichment === true,
            },
            created: true,
        },
        { status: 201 }
    )
}
