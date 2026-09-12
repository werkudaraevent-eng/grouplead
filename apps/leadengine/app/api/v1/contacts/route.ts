import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/require-permission'
import { apiError, authenticate, resolveCompanyId } from '../_lib/route-helpers'

export const dynamic = 'force-dynamic'

const MAX_PAGE_SIZE = 100

/**
 * GET /api/v1/contacts?clientCompanyId=
 *
 * The people a client company is already known to have.
 *
 * Sales Mission stored the appointment contact as free text with no link at
 * all, while LeadEngine has had `contacts.client_company_id` since March. So a
 * rep opening a mission for a company the CRM knows four people at was asked to
 * type a name from scratch, and the same person arrived as "Bpk Nofri" on one
 * mission and "Nofri Ardian" on the next.
 *
 * Read-only. Reading a contact list can never create a duplicate; only the POST
 * below can, and it is deliberately hard to reach by accident.
 */
export async function GET(request: Request) {
    const auth = await authenticate(request)
    if (!auth.ok) return auth.response

    const url = new URL(request.url)
    const clientCompanyId = (url.searchParams.get('clientCompanyId') ?? '').trim()

    // Without a company this would return every contact in the tenant, which is
    // not a thing any caller needs and is a great deal to hand out.
    if (!z.string().uuid().safeParse(clientCompanyId).success) {
        return apiError(400, 'invalid_company', 'clientCompanyId must be a uuid.')
    }

    const { data, error } = await auth.context.supabase
        .from('contacts')
        .select('id, full_name, job_title, phone, email')
        .eq('client_company_id', clientCompanyId)
        .order('full_name', { ascending: true })
        .limit(MAX_PAGE_SIZE)

    if (error) return apiError(500, 'lookup_failed', 'Could not read the contact list.')

    return NextResponse.json({
        contacts: (data ?? []).map((contact) => ({
            id: contact.id,
            fullName: contact.full_name,
            jobTitle: contact.job_title,
            phone: contact.phone,
            email: contact.email,
        })),
    })
}

const createSchema = z.object({
    clientCompanyId: z.string().uuid(),
    fullName: z.string().trim().min(1).max(200),
    jobTitle: z.string().trim().max(150).nullish(),
    phone: z.string().trim().max(50).nullish(),
    email: z.string().trim().max(200).nullish(),
    companyId: z.string().uuid().nullish(),
})

/**
 * POST /api/v1/contacts
 *
 * Registers someone met in the field that the CRM has never heard of.
 *
 * Find-or-create on name within the company, case-insensitively, for the same
 * reason client-companies does it: a rep types the same person three ways
 * across three visits, and three near-identical contacts are worse for the CRM
 * than the missing one was.
 *
 * Deliberately NOT called automatically when a visit report is submitted. Every
 * typo would become a permanent record, and a contact list nobody trusts is
 * worse than a short one. The caller is the lead-push modal, where a human has
 * already been asked to confirm.
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
        return apiError(422, 'invalid_payload', 'Contact name and company are required.', parsed.error.issues)
    }

    const { supabase } = auth.context
    const companyId = await resolveCompanyId(auth.context, parsed.data.companyId)
    if (!companyId) {
        return apiError(403, 'no_company_access', 'You do not have access to that business unit.')
    }

    // Evaluated as the calling user: creating a contact from Sales Mission needs
    // the same grant as creating one in LeadEngine.
    const guard = await requirePermission('contacts', 'create', companyId, supabase)
    if (!guard.allowed) {
        return apiError(403, 'forbidden', 'You do not have permission to create a contact.')
    }

    const escaped = parsed.data.fullName.replace(/[%_]/g, (match) => `\\${match}`)

    const { data: existing, error: lookupError } = await supabase
        .from('contacts')
        .select('id, full_name, job_title, phone, email')
        .eq('client_company_id', parsed.data.clientCompanyId)
        .ilike('full_name', escaped)
        .limit(1)
        .maybeSingle()

    if (lookupError) {
        return apiError(500, 'lookup_failed', 'Could not check for an existing contact.')
    }

    if (existing) {
        return NextResponse.json({
            contact: {
                id: existing.id,
                fullName: existing.full_name,
                jobTitle: existing.job_title,
                phone: existing.phone,
                email: existing.email,
            },
            created: false,
        })
    }

    const { data: created, error: insertError } = await supabase
        .from('contacts')
        .insert({
            client_company_id: parsed.data.clientCompanyId,
            full_name: parsed.data.fullName,
            job_title: parsed.data.jobTitle?.trim() || null,
            phone: parsed.data.phone?.trim() || null,
            email: parsed.data.email?.trim() || null,
        })
        .select('id, full_name, job_title, phone, email')
        .single()

    if (insertError || !created) {
        return apiError(500, 'create_failed', 'Could not create the contact.')
    }

    return NextResponse.json(
        {
            contact: {
                id: created.id,
                fullName: created.full_name,
                jobTitle: created.job_title,
                phone: created.phone,
                email: created.email,
            },
            created: true,
        },
        { status: 201 }
    )
}
