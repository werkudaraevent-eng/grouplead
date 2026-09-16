import { NextResponse } from 'next/server'
import { apiError, authenticate } from '../../../_lib/route-helpers'

export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/client-companies/{companyId}/context
 *
 * Everything the "send to LeadEngine" modal needs to avoid two expensive
 * mistakes:
 *
 *  - Ownership. If someone already works this account, the modal preselects
 *    them and warns before a visiting rep takes it over. Getting this wrong
 *    starts commission arguments.
 *  - Duplicates. Open leads are listed so the rep sees the account is already
 *    in the pipeline before adding a second card for it.
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ companyId: string }> }
) {
    const auth = await authenticate(request)
    if (!auth.ok) return auth.response

    const { companyId } = await params
    const { supabase } = auth.context

    const { data: company } = await supabase
        .from('client_companies')
        .select('id, name, industry')
        .eq('id', companyId)
        .maybeSingle()

    if (!company) return apiError(404, 'company_not_found', 'Client company not found.')

    // Closed stages are excluded: a won or lost deal is history, not a
    // duplicate, and its owner should not claim the account forever.
    const { data: closedStages } = await supabase
        .from('pipeline_stages')
        .select('id')
        .eq('stage_type', 'closed')

    const closedIds = (closedStages ?? []).map((stage) => stage.id as string)

    let leadQuery = supabase
        .from('leads')
        .select('id, project_name, pic_sales_id, pipeline_stage_id, pipeline_id, created_at')
        .eq('client_company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(20)

    if (closedIds.length > 0) {
        leadQuery = leadQuery.not('pipeline_stage_id', 'in', `(${closedIds.join(',')})`)
    }

    const { data: leads, error } = await leadQuery
    if (error) return apiError(500, 'context_unavailable', 'Could not load company context.')

    const openLeads = leads ?? []

    const stageIds = [...new Set(openLeads.map((lead) => lead.pipeline_stage_id).filter(Boolean))] as string[]
    const ownerIds = [...new Set(openLeads.map((lead) => lead.pic_sales_id).filter(Boolean))] as string[]

    const [{ data: stages }, { data: owners }] = await Promise.all([
        stageIds.length
            ? supabase.from('pipeline_stages').select('id, name').in('id', stageIds)
            : Promise.resolve({ data: [] as { id: string; name: string }[] }),
        ownerIds.length
            ? supabase.from('profiles').select('id, full_name').in('id', ownerIds)
            : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
    ])

    const stageNames = new Map((stages ?? []).map((stage) => [stage.id as string, stage.name as string]))
    const ownerNames = new Map(
        (owners ?? []).map((owner) => [owner.id as string, (owner.full_name as string | null) ?? 'Tanpa nama'])
    )

    // The newest open lead with an owner decides who currently holds the
    // account. Older cards may name someone who has since handed it over.
    const currentOwnerId = openLeads.find((lead) => lead.pic_sales_id)?.pic_sales_id as string | undefined

    return NextResponse.json({
        company: { id: company.id, name: company.name, industry: (company.industry as string | null) ?? null },
        currentOwner: currentOwnerId
            ? { userId: currentOwnerId, name: ownerNames.get(currentOwnerId) ?? 'Tanpa nama' }
            : null,
        openLeads: openLeads.map((lead) => ({
            id: lead.id,
            projectName: (lead.project_name as string | null) ?? 'Tanpa nama proyek',
            pipelineId: lead.pipeline_id,
            stageName: lead.pipeline_stage_id ? stageNames.get(lead.pipeline_stage_id as string) ?? null : null,
            ownerName: lead.pic_sales_id ? ownerNames.get(lead.pic_sales_id as string) ?? null : null,
        })),
    })
}
