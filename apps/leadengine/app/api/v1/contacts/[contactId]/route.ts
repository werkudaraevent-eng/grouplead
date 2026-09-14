import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/require-permission'
import { apiError, authenticate, resolveCompanyId } from '../../_lib/route-helpers'

export const dynamic = 'force-dynamic'

const enrichSchema = z.object({
    jobTitle: z.string().trim().max(150).nullish(),
    phone: z.string().trim().max(50).nullish(),
    email: z.string().trim().max(200).nullish(),
    companyId: z.string().uuid().nullish(),
})

/**
 * PATCH /api/v1/contacts/:contactId
 *
 * Fills gaps in a contact from what a rep learned in the field. Roughly four in
 * ten contacts in this CRM have no job title and no phone number, so a visit is
 * often the first time anyone finds out.
 *
 * FILLS BLANKS ONLY. A column the CRM already has a value for is never
 * overwritten, whatever the request says.
 *
 * That rule is the whole safety of this endpoint. A mission's contact fields are
 * a snapshot of what the appointment team was told before the visit; the CRM's
 * are what the account is currently believed to be. When the two disagree,
 * neither is automatically right, and letting a mission form silently win would
 * mean a stale briefing note could quietly rewrite the CRM. A disagreement is
 * for a human to settle in LeadEngine; only a gap is safe to close from here.
 */
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ contactId: string }> }
) {
    const auth = await authenticate(request)
    if (!auth.ok) return auth.response

    const { contactId } = await params
    if (!z.string().uuid().safeParse(contactId).success) {
        return apiError(400, 'invalid_contact', 'contactId must be a uuid.')
    }

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return apiError(400, 'invalid_body', 'Request body must be JSON.')
    }

    const parsed = enrichSchema.safeParse(body)
    if (!parsed.success) {
        return apiError(422, 'invalid_payload', 'Invalid contact fields.', parsed.error.issues)
    }

    const { supabase } = auth.context
    const companyId = await resolveCompanyId(auth.context, parsed.data.companyId)
    if (!companyId) {
        return apiError(403, 'no_company_access', 'You do not have access to that business unit.')
    }

    // Updating a contact needs the same grant as updating one in LeadEngine.
    const guard = await requirePermission('contacts', 'update', companyId, supabase, auth.context.userId)
    if (!guard.allowed) {
        return apiError(403, 'forbidden', 'You do not have permission to update a contact.')
    }

    const { data: current, error: readError } = await supabase
        .from('contacts')
        .select('id, full_name, job_title, phone, email')
        .eq('id', contactId)
        .maybeSingle()

    if (readError) return apiError(500, 'lookup_failed', 'Could not read the contact.')
    if (!current) return apiError(404, 'not_found', 'Contact not found.')

    // Only columns that are currently empty are considered.
    const patch: Record<string, string> = {}
    const filled: string[] = []

    const gaps: Array<[keyof typeof current, string, string | null | undefined]> = [
        ['job_title', 'jobTitle', parsed.data.jobTitle],
        ['phone', 'phone', parsed.data.phone],
        ['email', 'email', parsed.data.email],
    ]

    for (const [column, label, incoming] of gaps) {
        const existing = current[column]
        const value = incoming?.trim()
        if (existing || !value) continue
        patch[column] = value
        filled.push(label)
    }

    if (filled.length === 0) {
        return NextResponse.json({ contact: { id: contactId }, filled: [] })
    }

    const { error: updateError } = await supabase
        .from('contacts')
        .update(patch)
        .eq('id', contactId)

    if (updateError) return apiError(500, 'update_failed', 'Could not update the contact.')

    return NextResponse.json({ contact: { id: contactId }, filled })
}
