import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/require-permission'
import { apiError, authenticate, resolveCompanyId } from '../../../_lib/route-helpers'

export const dynamic = 'force-dynamic'

const visitSchema = z.object({
    missionId: z.string().uuid(),
    visitedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    salesName: z.string().trim().min(1).max(200),
    outcome: z.string().trim().min(1).max(100),
    contactNames: z.array(z.string().trim().min(1).max(200)).max(50).default([]),
    /** Fills the company's city when the CRM has none. Never overwrites. */
    city: z.string().trim().max(200).nullish(),
    companyId: z.string().uuid().nullish(),
})

/**
 * POST /api/v1/client-companies/{companyId}/visits
 *
 * Writes a field visit onto the company's timeline.
 *
 * Without this, a company Sales Mission visited three times and never pushed
 * a lead for looked untouched in LeadEngine: no activity, no date, no name.
 * The CRM could not answer "when were we last there" for exactly the accounts
 * that needed the answer most. The row lands in company_activities with
 * action_type 'meeting', which the timeline already groups under Meetings.
 *
 * Idempotent per mission: a retry after a network drop, or a resubmitted
 * report, finds the row it already wrote and leaves it. The table's RLS lets
 * only the author edit an activity, and the retry may come from someone else,
 * so "one row per mission" is enforced by not writing a second rather than by
 * updating the first.
 */
export async function POST(
    request: Request,
    { params }: { params: Promise<{ companyId: string }> }
) {
    const auth = await authenticate(request)
    if (!auth.ok) return auth.response

    const { companyId: clientCompanyId } = await params
    if (!z.string().uuid().safeParse(clientCompanyId).success) {
        return apiError(400, 'invalid_company', 'companyId must be a uuid.')
    }

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return apiError(400, 'invalid_body', 'Request body must be JSON.')
    }

    const parsed = visitSchema.safeParse(body)
    if (!parsed.success) {
        return apiError(422, 'invalid_payload', 'Visit payload is invalid.', parsed.error.issues)
    }

    const { supabase, userId } = auth.context
    const tenantId = await resolveCompanyId(auth.context, parsed.data.companyId)
    if (!tenantId) {
        return apiError(403, 'no_company_access', 'You do not have access to that business unit.')
    }

    // A visit is a change to the account's record, so it needs the same grant
    // as editing the account. Evaluated as the caller, never bypassed.
    const guard = await requirePermission('companies', 'update', tenantId, supabase, auth.context.userId)
    if (!guard.allowed) {
        return apiError(403, 'forbidden', 'You do not have permission to update client companies.')
    }

    const { data: company } = await supabase
        .from('client_companies')
        .select('id, city')
        .eq('id', clientCompanyId)
        .is('deleted_at', null)
        .maybeSingle()
    if (!company) return apiError(404, 'company_not_found', 'Client company not found.')

    const { missionId, visitedOn, salesName, outcome, contactNames, city } = parsed.data
    const met = contactNames.length > 0 ? ` Bertemu ${contactNames.join(', ')}.` : ''
    const description = `Kunjungan Sales Activity oleh ${salesName} pada ${visitedOn}: ${outcome}.${met}`

    // The mission id is the idempotency key, carried in field_name so the
    // existing table needs no new column and the timeline can link back.
    const marker = `sales_mission:${missionId}`

    const { data: existing } = await supabase
        .from('company_activities')
        .select('id')
        .eq('client_company_id', clientCompanyId)
        .eq('field_name', marker)
        .maybeSingle()

    if (!existing) {
        const { error } = await supabase.from('company_activities').insert({
            client_company_id: clientCompanyId,
            user_id: userId,
            action_type: 'meeting',
            description,
            field_name: marker,
            new_value: visitedOn,
        })
        if (error) return apiError(500, 'visit_failed', 'Could not record the visit.')
    }

    // City is the one company field a visit reliably learns. Filled only when
    // blank: a city the CRM already holds is not a mission's to change.
    if (city && !company.city) {
        await supabase.from('client_companies').update({ city }).eq('id', clientCompanyId)
    }

    return NextResponse.json({ recorded: true, alreadyRecorded: Boolean(existing) })
}
