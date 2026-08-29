import { NextResponse } from 'next/server'
import { apiError, authenticate, resolveCompanyId } from '../_lib/route-helpers'

export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/pipelines
 *
 * Fills the pipeline and stage pickers in Sales Mission's "send to LeadEngine"
 * modal. Stages come nested so the client can switch pipeline without a second
 * round trip on a field connection.
 */
export async function GET(request: Request) {
    const auth = await authenticate(request)
    if (!auth.ok) return auth.response

    const url = new URL(request.url)
    const companyId = await resolveCompanyId(auth.context, url.searchParams.get('companyId'))
    if (!companyId) {
        return apiError(403, 'no_company_access', 'You do not have access to that business unit.')
    }

    const { supabase } = auth.context

    const { data: pipelines, error } = await supabase
        .from('pipelines')
        .select('id, name, company_id')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true })

    if (error) return apiError(500, 'pipelines_unavailable', 'Could not load pipelines.')

    // Stages are global rather than per-pipeline in the current schema, so they
    // are fetched once and attached to every pipeline.
    const { data: stages } = await supabase
        .from('pipeline_stages')
        .select('id, name, sort_order, is_default, stage_type')
        .order('sort_order', { ascending: true })

    const openStages = (stages ?? []).filter((stage) => stage.stage_type !== 'closed')

    return NextResponse.json({
        pipelines: (pipelines ?? []).map((pipeline) => ({
            id: pipeline.id,
            name: pipeline.name,
            stages: openStages.map((stage) => ({
                id: stage.id,
                name: stage.name,
                sortOrder: stage.sort_order,
                isDefault: stage.is_default === true,
            })),
        })),
    })
}
