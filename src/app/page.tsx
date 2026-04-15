import { AnalyticsDashboard } from "@/features/leads/components/analytics-dashboard"
import { createClient } from "@/utils/supabase/server"
import { getActiveCompany } from "@/utils/company"
import { getScopedCompanyId, scopedQuery } from "@/utils/supabase/scoped-query"
import type { Lead, PipelineStage } from "@/types"

export const dynamic = 'force-dynamic'

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ pipeline?: string }> }) {
    const supabase = await createClient()
    const resolvedParams = await searchParams

    let activeCompany: Awaited<ReturnType<typeof getActiveCompany>> = null
    try {
        activeCompany = await getActiveCompany()
    } catch {
        // Gracefully handle missing auth/company context
    }

    // Fetch available pipelines for the company
    let pipelinesQuery = supabase.from('pipelines').select('id, name, is_default').order('created_at', { ascending: true })
    if (activeCompany?.id) {
        pipelinesQuery = pipelinesQuery.eq('company_id', activeCompany.id)
    }
    const { data: pipelinesData } = await pipelinesQuery
    const pipelines = pipelinesData || []

    const defaultPipeline = pipelines.find(p => p.is_default) || pipelines[0]
    const activePipelineId = resolvedParams.pipeline || defaultPipeline?.id
    let pipelineStages: PipelineStage[] = []

    if (activePipelineId) {
        const { data: pipelineStagesData } = await supabase
            .from("pipeline_stages")
            .select("id, name, color, sort_order, is_default, stage_type, closed_status, pipeline_id, created_at")
            .eq("pipeline_id", activePipelineId)
            .order("sort_order", { ascending: true })
        pipelineStages = (pipelineStagesData as PipelineStage[]) || []
    }

    const base = supabase
        .from('leads')
        .select('*, client_company:client_companies!client_company_id(name), contact:contacts!contact_id(full_name, email, phone), pipeline_stage:pipeline_stages!pipeline_stage_id(name, color), pic_sales_profile:profiles!pic_sales_id(full_name)')
        .order('updated_at', { ascending: false })

    if (activePipelineId) {
        base.eq('pipeline_id', activePipelineId)
    }

    let leads: Lead[] = []
    let error: { message: string } | null = null
    try {
        const result = await scopedQuery(base, getScopedCompanyId(activeCompany))
        leads = (result.data as Lead[]) || []
        error = result.error
    } catch (err) {
        console.warn("[DashboardPage] Query failed:", err)
        error = { message: String(err) }
    }

    return (
        <>
            {error && (
                <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md text-sm mx-6 mt-4">
                    <strong>Database Error:</strong> {error.message}
                </div>
            )}
            <AnalyticsDashboard leads={leads} pipelines={pipelines} activePipelineId={activePipelineId} pipelineStages={pipelineStages} />
        </>
    )
}
