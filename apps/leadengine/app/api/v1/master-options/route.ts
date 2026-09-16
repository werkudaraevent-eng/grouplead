import { NextResponse } from 'next/server'
import { apiError, authenticate } from '../_lib/route-helpers'

export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/master-options?types=category,grade_lead
 *
 * The pick lists a lead is classified with, for Sales Activity's "send to
 * LeadEngine" panel. Read from the same table the lead form reads, so a
 * category an admin adds in Master Options (HQL, say) is offered there at
 * once and never copied. Only the taxonomies a hand-off needs are served;
 * this is not a general reader of the table.
 */

const ALLOWED_TYPES = new Set(['category', 'grade_lead', 'lead_source'])

export async function GET(request: Request) {
    const auth = await authenticate(request)
    if (!auth.ok) return auth.response

    const url = new URL(request.url)
    const requested = (url.searchParams.get('types') ?? '')
        .split(',')
        .map((type) => type.trim())
        .filter(Boolean)
    const types = requested.filter((type) => ALLOWED_TYPES.has(type))
    if (types.length === 0 || types.length !== requested.length) {
        return apiError(422, 'invalid_types', `types must be one or more of: ${[...ALLOWED_TYPES].join(', ')}.`)
    }

    const { supabase } = auth.context
    // Same read as the lead form (useMasterOptions): active rows, in the
    // admin's order. Reads are global across business units by policy.
    const { data, error } = await supabase
        .from('master_options')
        .select('option_type, label, value, sort_order')
        .eq('is_active', true)
        .in('option_type', types)
        .order('sort_order', { ascending: true })
        .order('label', { ascending: true })

    if (error) return apiError(500, 'master_options_unavailable', 'Could not load master options.')

    return NextResponse.json({
        options: (data ?? []).map((row) => ({
            optionType: row.option_type as string,
            label: row.label as string,
            value: row.value as string,
            sortOrder: Number(row.sort_order ?? 0),
        })),
    })
}
