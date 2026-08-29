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

    // Pipelines are shared across business units in practice: `company_id` is
    // nullable and every existing pipeline leaves it null. Filtering on the
    // tenant alone returned nothing at all, which emptied the picker in the
    // lead-push modal. Include the global ones alongside any tenant-specific
    // ones, matching how LeadEngine's own settings screen reads them.
    const { data: pipelines, error } = await supabase
        .from('pipelines')
        .select('id, name, company_id')
        .or(`company_id.is.null,company_id.eq.${companyId}`)
        .order('created_at', { ascending: true })

    if (error) return apiError(500, 'pipelines_unavailable', 'Could not load pipelines.')

    // Stages belong to a pipeline. Attaching every stage to every pipeline
    // produces combinations the database rejects: a trigger refuses a lead whose
    // pipeline_id and stage disagree, so a picker offering 2025's stages under
    // the 2026 pipeline fails only at the moment of saving.
    const { data: stages } = await supabase
        .from('pipeline_stages')
        .select('id, name, sort_order, is_default, stage_type, pipeline_id')
        .order('sort_order', { ascending: true })

    const stagesByPipeline = new Map<string, typeof stages>()
    for (const stage of stages ?? []) {
        // Closed stages are where deals end, not where a fresh lead starts.
        if (stage.stage_type === 'closed') continue
        const key = stage.pipeline_id as string | null
        if (!key) continue
        const bucket = stagesByPipeline.get(key) ?? []
        bucket.push(stage)
        stagesByPipeline.set(key, bucket)
    }

    return NextResponse.json({
        pipelines: (pipelines ?? []).map((pipeline) => ({
            id: pipeline.id,
            name: pipeline.name,
            stages: (stagesByPipeline.get(pipeline.id as string) ?? []).map((stage) => ({
                id: stage.id,
                name: stage.name,
                sortOrder: stage.sort_order,
                isDefault: stage.is_default === true,
            })),
        })),
    })
}
