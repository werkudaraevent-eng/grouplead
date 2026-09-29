import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, authenticate } from '../../_lib/route-helpers'

export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/client-companies/{companyId}
 *
 * One company as the CRM holds it now.
 *
 * Sales Activity copies a company's name onto an activity or a prospect when
 * it is made, and keeps the link. Admins correct names here, in the CRM, so
 * the copy goes stale; the activity and prospect pages ask this route for the
 * current name and show it, with the copy as the record of what was written
 * at the time.
 *
 * Read as the caller, so row security decides who sees which company, as on
 * every other v1 read. A company in the Recycle Bin (deleted, or merged into
 * another) is 404 even for an admin, whom row security lets see it for the
 * Bin: the caller then keeps its own copy of the name.
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ companyId: string }> }
) {
    const auth = await authenticate(request)
    if (!auth.ok) return auth.response

    const { companyId } = await params
    if (!z.string().uuid().safeParse(companyId).success) {
        return apiError(400, 'invalid_company', 'companyId must be a uuid.')
    }

    const { data: company, error } = await auth.context.supabase
        .from('client_companies')
        .select('id, name, industry')
        .eq('id', companyId)
        .is('deleted_at', null)
        .maybeSingle()

    if (error) return apiError(500, 'lookup_failed', 'Could not read the client company.')
    if (!company) return apiError(404, 'company_not_found', 'Client company not found.')

    return NextResponse.json({
        company: {
            id: company.id,
            name: company.name,
            industry: (company.industry as string | null) ?? null,
        },
    })
}
