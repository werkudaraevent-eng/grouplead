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

const discLetter = z.enum(['D', 'I', 'S', 'C'])

/**
 * A DISC reading from the field: the rep's estimate of how the person
 * communicates, with who made it and when. Stored under
 * `custom_fields.disc`, and unlike the identity columns it is REPLACED when
 * a newer one arrives: a reading is dated, so the latest meeting is the
 * better guide, and it is an impression rather than a fact the CRM could
 * be "right" about.
 */
const discSchema = z.object({
    primary: discLetter,
    secondary: discLetter.nullish(),
    note: z.string().trim().max(300).nullish(),
    assessedByName: z.string().trim().max(200).nullish(),
    assessedAt: z.string().datetime({ offset: true }).nullish(),
})

const createSchema = z.object({
    clientCompanyId: z.string().uuid(),
    fullName: z.string().trim().min(1).max(200),
    jobTitle: z.string().trim().max(150).nullish(),
    phone: z.string().trim().max(50).nullish(),
    email: z.string().trim().max(200).nullish(),
    /** Record owner for a contact created here. Ignored when they already exist. */
    ownerId: z.string().uuid().nullish(),
    companyId: z.string().uuid().nullish(),
    disc: discSchema.nullish(),
})

/** The stored shape, normalised: no secondary equal to the primary, blanks as null. */
function discRecord(disc: z.infer<typeof discSchema>) {
    return {
        primary: disc.primary,
        secondary: disc.secondary && disc.secondary !== disc.primary ? disc.secondary : null,
        note: disc.note?.trim() || null,
        assessedByName: disc.assessedByName?.trim() || null,
        assessedAt: disc.assessedAt ?? null,
        source: 'Sales Mission',
    }
}

/**
 * POST /api/v1/contacts
 *
 * Registers someone met in the field that the CRM has never heard of.
 *
 * Find-or-create on name within the company, case-insensitively, for the same
 * reason client-companies does it: a rep types the same person three ways
 * across three visits, and three near-identical contacts are worse for the CRM
 * than the missing one was. When the person exists, their blank fields are
 * filled from the payload and nothing they already have is touched, so calling
 * this from every visit only ever adds.
 *
 * Called when a visit report is submitted. That used to be deliberately
 * avoided, on the theory that a typo would become a permanent record. What
 * happened instead was that a company visited three times had no contacts in
 * the CRM at all, because the only registration path was the lead-push modal
 * and most visits never produce a lead. The rows carry contact_source so the
 * origin is visible, and a wrong name is one edit in LeadEngine.
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
    const guard = await requirePermission('contacts', 'create', companyId, supabase, auth.context.userId)
    if (!guard.allowed) {
        return apiError(403, 'forbidden', 'You do not have permission to create a contact.')
    }

    const escaped = parsed.data.fullName.replace(/[%_]/g, (match) => `\\${match}`)

    const { data: existing, error: lookupError } = await supabase
        .from('contacts')
        .select('id, full_name, job_title, phone, email, custom_fields')
        .eq('client_company_id', parsed.data.clientCompanyId)
        .ilike('full_name', escaped)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle()

    if (lookupError) {
        return apiError(500, 'lookup_failed', 'Could not check for an existing contact.')
    }

    if (existing) {
        // Fill blanks only. The same rule as PATCH /contacts/:id, for the same
        // reason: a disagreement is for a human, only a gap is safe to close.
        const patch: Record<string, unknown> = {}
        if (!existing.job_title && parsed.data.jobTitle?.trim()) patch.job_title = parsed.data.jobTitle.trim()
        if (!existing.phone && parsed.data.phone?.trim()) patch.phone = parsed.data.phone.trim()
        if (!existing.email && parsed.data.email?.trim()) patch.email = parsed.data.email.trim()
        // The one deliberate exception to fill-blanks: see discSchema.
        if (parsed.data.disc) {
            const custom = (existing.custom_fields && typeof existing.custom_fields === 'object' ? existing.custom_fields : {}) as Record<string, unknown>
            patch.custom_fields = { ...custom, disc: discRecord(parsed.data.disc) }
        }
        if (Object.keys(patch).length > 0) {
            await supabase.from('contacts').update(patch).eq('id', existing.id)
        }

        return NextResponse.json({
            contact: {
                id: existing.id,
                fullName: existing.full_name,
                jobTitle: existing.job_title ?? (patch.job_title as string | undefined) ?? null,
                phone: existing.phone ?? (patch.phone as string | undefined) ?? null,
                email: existing.email ?? (patch.email as string | undefined) ?? null,
            },
            created: false,
        })
    }

    const { data: created, error: insertError } = await supabase
        .from('contacts')
        .insert({
            client_company_id: parsed.data.clientCompanyId,
            company_id: companyId,
            owner_id: parsed.data.ownerId ?? null,
            full_name: parsed.data.fullName,
            job_title: parsed.data.jobTitle?.trim() || null,
            phone: parsed.data.phone?.trim() || null,
            email: parsed.data.email?.trim() || null,
            contact_source: 'Sales Mission',
            custom_fields: parsed.data.disc ? { disc: discRecord(parsed.data.disc) } : {},
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
