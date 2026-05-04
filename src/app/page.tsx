import { AnalyticsDashboard } from "@/features/leads/components/analytics-dashboard"
import { createClient } from "@/utils/supabase/server"
import { getActiveCompany } from "@/utils/company"
import { getScopedCompanyId, scopedQuery } from "@/utils/supabase/scoped-query"
import type { Lead, PipelineStage } from "@/types"
import type { GoalV2, GoalNode, GoalUserTarget, GoalSettingsV2 } from "@/types/goals"
import type { CustomWidget } from "@/types/custom-widget"

export const dynamic = 'force-dynamic'

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ pipeline?: string }> }) {
    const supabase = await createClient()
    const resolvedParams = await searchParams

    // Parallel: auth + company (no dependency between them)
    const [authResult, activeCompany] = await Promise.all([
        supabase.auth.getUser(),
        getActiveCompany().catch(() => null),
    ])

    const user = authResult.data?.user

    // Fetch pipelines (needs company_id for scoping)
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
        .select('*, client_company:client_companies!client_company_id(name, line_industry, area, account_status, industry), contact:contacts!contact_id(full_name, email, phone), pipeline_stage:pipeline_stages!pipeline_stage_id(name, color), pic_sales_profile:profiles!pic_sales_id(full_name)')
        .order('updated_at', { ascending: false })

    if (activePipelineId) {
        base.eq('pipeline_id', activePipelineId)
    }

    // Parallel: leads + goals + custom widgets (all independent)
    let leads: Lead[] = []
    let error: { message: string } | null = null as { message: string } | null
    let activeGoal: GoalV2 | null = null
    let goalNodes: GoalNode[] = []
    let userTargets: GoalUserTarget[] = []
    let goalSettings: GoalSettingsV2 | null = null

    const leadsPromise = (async () => {
        try {
            const result = await scopedQuery(base, getScopedCompanyId(activeCompany))
            leads = (result.data as Lead[]) || []
            error = result.error
        } catch (err: unknown) {
            console.warn("[DashboardPage] Query failed:", err)
            error = { message: String(err) }
        }
    })()

    const goalsPromise = activeCompany?.id
        ? Promise.all([
            supabase.from('goals_v2').select('*').eq('company_id', activeCompany.id).eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
            supabase.from('goal_nodes').select('*').eq('company_id', activeCompany.id).order('sort_order'),
            supabase.from('goal_user_targets').select('*').eq('company_id', activeCompany.id),
            supabase.from('goal_settings_v2').select('*').eq('company_id', activeCompany.id).maybeSingle(),
        ]).then(([goalRes, nodesRes, targetsRes, settingsRes]) => {
            activeGoal = goalRes.data as GoalV2 | null
            goalNodes = (nodesRes.data as GoalNode[]) || []
            userTargets = (targetsRes.data as GoalUserTarget[]) || []
            goalSettings = settingsRes.data as GoalSettingsV2 | null
            if (activeGoal) {
                const goalId = activeGoal.id
                goalNodes = goalNodes.filter(n => n.goal_id === goalId)
                userTargets = userTargets.filter(t => t.goal_id === goalId)
            }
        })
        : Promise.resolve()

    const widgetsPromise = supabase
        .from('custom_widgets')
        .select('*')
        .eq('user_id', user?.id ?? '')
        .order('created_at', { ascending: true })

    // Execute all in parallel
    const [,, widgetsResult] = await Promise.all([leadsPromise, goalsPromise, widgetsPromise])
    const customWidgets = (widgetsResult as { data: CustomWidget[] | null }).data

    return (
        <>
            {error && (
                <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md text-sm mx-6 mt-4">
                    <strong>Database Error:</strong> {error.message}
                </div>
            )}
            <AnalyticsDashboard
                leads={leads}
                pipelines={pipelines}
                activePipelineId={activePipelineId}
                pipelineStages={pipelineStages}
                activeGoal={activeGoal}
                goalNodes={goalNodes}
                userTargets={userTargets}
                goalSettings={goalSettings}
                customWidgets={customWidgets ?? []}
            />
        </>
    )
}
