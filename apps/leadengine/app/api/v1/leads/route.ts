import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, authenticate, resolveCompanyId } from '../_lib/route-helpers'
import { requirePermission } from '@/lib/require-permission'

export const dynamic = 'force-dynamic'

/**
 * POST /api/v1/leads
 *
 * Creates a lead from a Sales Mission visit report.
 *
 * The grant is evaluated with `requirePermission('leads','create')` against the
 * caller's own token, so the rule is identical to creating a lead inside
 * LeadEngine — the API is a different door to the same room, not a way around
 * the lock.
 */

const createLeadSchema = z.object({
    clientCompanyId: z.string().uuid().nullish(),
    clientCompanyName: z.string().trim().min(1).max(200),
    projectName: z.string().trim().min(1, 'Nama proyek wajib diisi').max(300),
    pipelineId: z.string().uuid(),
    pipelineStageId: z.string().uuid().nullish(),
    ownerUserId: z.string().uuid(),
    estimatedValue: z.number().nonnegative().nullish(),
    remark: z.string().trim().max(4000).nullish(),
    /** Free-form provenance, e.g. "Sales Mission · <missionId>". */
    source: z.string().trim().max(200).nullish(),
    companyId: z.string().uuid().nullish(),
})

export async function POST(request: Request) {
    const auth = await authenticate(request)
    if (!auth.ok) return auth.response

    let payload: unknown
    try {
        payload = await request.json()
    } catch {
        return apiError(400, 'invalid_json', 'Request body must be valid JSON.')
    }

    const parsed = createLeadSchema.safeParse(payload)
    if (!parsed.success) {
        return apiError(422, 'validation_failed', 'Lead payload is invalid.', parsed.error.issues)
    }

    const input = parsed.data
    const { supabase } = auth.context

    const companyId = await resolveCompanyId(auth.context, input.companyId)
    if (!companyId) {
        return apiError(403, 'no_company_access', 'You do not have access to that business unit.')
    }

    const guard = await requirePermission('leads', 'create', companyId, supabase)
    if (!guard.allowed) {
        return apiError(403, 'permission_denied', guard.error.error ?? 'Not allowed to create leads.')
    }

    // The owner must belong to the same business unit. Without this check a
    // crafted request could park a lead on anyone in the shared database.
    const { data: ownerMembership } = await supabase
        .from('company_members')
        .select('user_id')
        .eq('company_id', companyId)
        .eq('user_id', input.ownerUserId)
        .maybeSingle()

    if (!ownerMembership) {
        return apiError(422, 'invalid_owner', 'Lead owner is not a member of that business unit.')
    }

    // Resolve the stage. An explicit one is verified rather than trusted; with
    // none given the pipeline's first stage is used.
    let stageId = input.pipelineStageId ?? null
    if (stageId) {
        const { data: stage } = await supabase
            .from('pipeline_stages')
            .select('id')
            .eq('id', stageId)
            .maybeSingle()
        if (!stage) return apiError(422, 'invalid_stage', 'Pipeline stage does not exist.')
    } else {
        const { data: firstStage } = await supabase
            .from('pipeline_stages')
            .select('id')
            .order('sort_order', { ascending: true })
            .limit(1)
            .maybeSingle()
        stageId = (firstStage?.id as string | undefined) ?? null
    }

    // Newly created leads should sit on top of their stage rather than wherever
    // the column default lands them.
    let kanbanSortOrder: number | null = null
    if (stageId) {
        const { data: topLead } = await supabase
            .from('leads')
            .select('kanban_sort_order')
            .eq('pipeline_stage_id', stageId)
            .order('kanban_sort_order', { ascending: false, nullsFirst: false })
            .limit(1)
            .maybeSingle()
        kanbanSortOrder = Number(topLead?.kanban_sort_order ?? Date.now() / 1000) + 1000
    }

    const { data: lead, error } = await supabase
        .from('leads')
        .insert({
            project_name: input.projectName,
            company_id: companyId,
            client_company_id: input.clientCompanyId ?? null,
            pipeline_id: input.pipelineId,
            pipeline_stage_id: stageId,
            pic_sales_id: input.ownerUserId,
            estimated_value: input.estimatedValue ?? null,
            remark: input.remark ?? null,
            lead_source: input.source ?? 'Sales Mission',
            kanban_sort_order: kanbanSortOrder,
        })
        .select('id')
        .single()

    if (error || !lead) {
        return apiError(500, 'lead_create_failed', error?.message ?? 'Could not create the lead.')
    }

    return NextResponse.json({ lead: { id: lead.id } }, { status: 201 })
}
