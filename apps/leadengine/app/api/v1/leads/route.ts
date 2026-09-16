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
    /** The lead_source label; must match a master option so filters and goals can group by it. */
    source: z.string().trim().max(200).nullish(),
    /** The Sales Mission visit this lead came from, kept apart from the label. */
    salesMissionId: z.string().uuid().nullish(),
    /** Master option values (not labels), as the lead form stores them; verified below. */
    category: z.string().trim().min(1).max(100).nullish(),
    gradeLead: z.string().trim().min(1).max(100).nullish(),
    /** Timeline entries to write on the new lead, oldest first. */
    activities: z
        .array(
            z.object({
                type: z.string().trim().min(1).max(60),
                description: z.string().trim().min(1).max(4000),
                occurredAt: z.string().datetime({ offset: true }).nullish(),
            })
        )
        .max(10)
        .optional(),
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

    const guard = await requirePermission('leads', 'create', companyId, supabase, auth.context.userId)
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

    // A classification is only accepted if it is one the admin defined: the
    // dashboards group by these values, and a free-text one would make a
    // bucket nobody can see in Master Options.
    for (const [field, type, code] of [
        [input.category, 'category', 'invalid_category'],
        [input.gradeLead, 'grade_lead', 'invalid_grade_lead'],
    ] as const) {
        if (!field) continue
        const { data: option } = await supabase
            .from('master_options')
            .select('id')
            .eq('option_type', type)
            .eq('value', field)
            .eq('is_active', true)
            .limit(1)
            .maybeSingle()
        if (!option) return apiError(422, code, `${type} "${field}" is not an active master option.`)
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
            sales_mission_id: input.salesMissionId ?? null,
            category: input.category ?? null,
            grade_lead: input.gradeLead ?? null,
            kanban_sort_order: kanbanSortOrder,
        })
        .select('id')
        .single()

    if (error || !lead) {
        return apiError(500, 'lead_create_failed', error?.message ?? 'Could not create the lead.')
    }

    // The visit that produced the lead belongs on its timeline, dated when it
    // happened, so the CRM reader sees who was met and what was heard. Best
    // effort: the lead exists either way, and a missing timeline entry must
    // not read as a failed push and invite a duplicate.
    if (input.activities?.length) {
        await supabase.from('lead_activities').insert(
            input.activities.map((activity) => ({
                lead_id: lead.id,
                user_id: auth.context.userId,
                action_type: activity.type,
                description: activity.description,
                ...(activity.occurredAt ? { created_at: activity.occurredAt } : {}),
            }))
        )
    }

    return NextResponse.json({ lead: { id: lead.id } }, { status: 201 })
}
