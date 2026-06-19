import { AnalyticsDashboard } from "@/features/leads/components/analytics-dashboard"
import { createClient } from "@/utils/supabase/server"
import { getActiveCompany } from "@/utils/company"
import { getScopedCompanyId, scopedQuery } from "@/utils/supabase/scoped-query"
import { requirePermission } from "@/lib/require-permission"
import type { Lead, PipelineStage } from "@/types"
import type { GoalV2, GoalNode, GoalUserTarget, GoalSettingsV2 } from "@/types/goals"
import type { CustomWidget } from "@/types/custom-widget"

type SalesProfile = { id: string; full_name: string | null; avatar_url?: string | null }

const DASHBOARD_LEADS_LIMIT = 5000

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
    const dashboardGuard = await requirePermission('dashboard', 'read', activeCompany?.id)
    if (!dashboardGuard.allowed) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center px-6">
                <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center">
                    <h1 className="text-base font-semibold text-foreground">Dashboard access restricted</h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Your role does not have permission to view the main dashboard.
                    </p>
                </div>
            </div>
        )
    }

    // Fetch pipelines — global definitions, shared across all business units.
    const { data: pipelinesData } = await supabase
        .from('pipelines')
        .select('id, name, is_default, fiscal_year')
        .order('created_at', { ascending: true })
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

    // Fetch leads from active pipeline + all other pipelines (for YoY comparison)
    // Dashboard needs historical data from other pipelines to compute YoY metrics
    const allPipelineIds = pipelines.map(p => p.id)
    const base = supabase
        .from('leads')
        .select('*, client_company:client_companies!client_company_id(name, line_industry, area, account_status, industry, parent_id, parent:parent_id(id, name)), contact:contacts!contact_id(full_name, email, phone), pipeline_stage:pipeline_stages!pipeline_stage_id(name, color, closed_status, stage_type), pic_sales_profile:profiles!pic_sales_id(full_name, avatar_url)')
        .order('updated_at', { ascending: false })
        .limit(DASHBOARD_LEADS_LIMIT)

    if (allPipelineIds.length > 0) {
        base.in('pipeline_id', allPipelineIds)
    } else if (activePipelineId) {
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

    // Select the goal whose fiscal period matches the active pipeline's year.
    // Pipelines carry a `fiscal_year` (e.g. "Group Lead 2025" -> 2025); the
    // dashboard shows the goal whose period covers that year so each pipeline
    // reads its own target. Falls back to the calendar year when the pipeline
    // has no fiscal_year. A year with no matching goal yields no goal (target
    // shows as "not set" instead of borrowing another year's target).
    const activePipeline = pipelines.find(p => p.id === activePipelineId)
    const goalTargetYear = activePipeline?.fiscal_year ?? new Date().getFullYear()

    const goalsPromise = activeCompany?.id
        ? Promise.all([
            supabase.from('goals_v2').select('*').eq('company_id', activeCompany.id).eq('is_active', true).order('created_at', { ascending: false }),
            supabase.from('goal_nodes').select('*').eq('company_id', activeCompany.id).order('sort_order'),
            supabase.from('goal_user_targets').select('*').eq('company_id', activeCompany.id),
            supabase.from('goal_settings_v2').select('*').eq('company_id', activeCompany.id).maybeSingle(),
        ]).then(([goalRes, nodesRes, targetsRes, settingsRes]) => {
            const allGoals = (goalRes.data as GoalV2[]) || []
            const matched = allGoals.find(g => {
                if (!g.period_start) return false
                const startY = new Date(g.period_start).getFullYear()
                const endY = g.period_end ? new Date(g.period_end).getFullYear() : startY
                return goalTargetYear >= startY && goalTargetYear <= endY
            })
            // Safety net for legacy data: if no goal carries a period at all,
            // fall back to the most recent goal so existing single-goal
            // dashboards keep working. When goals DO have periods but none
            // match the year, intentionally show no goal.
            const anyHasPeriod = allGoals.some(g => g.period_start)
            activeGoal = matched ?? (anyHasPeriod ? null : (allGoals[0] ?? null))
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

    // Execute leads + goals + custom widgets in parallel
    const [,, widgetsResult] = await Promise.all([leadsPromise, goalsPromise, widgetsPromise])
    const customWidgets = (widgetsResult as { data: CustomWidget[] | null }).data

    // ── Resolve display names for sales reps referenced by targets/nodes ──
    // Reps may have targets but zero leads in the active period. Without
    // their profile we cannot show their name. Build the candidate id set
    // from every place a target can live (user_targets, goal_nodes, AND
    // breakdown_config sales_owner — which only has names, so we have to
    // resolve those by full_name lookup separately).
    const targetUserIds = new Set<string>()
    for (const t of userTargets) {
        if (t.user_id) targetUserIds.add(t.user_id)
    }
    for (const n of goalNodes) {
        const isSalesOwnerNode =
            n.reference_field === "pic_sales_id" ||
            n.reference_field === "sales_owner" ||
            n.dimension_type === "sales_owner"
        if (isSalesOwnerNode && n.reference_value) {
            targetUserIds.add(n.reference_value)
        }
    }

    // Names referenced by breakdown_config sales_owner level — these need
    // to be resolved against profiles.full_name to recover their user id.
    const breakdownSalesNames = new Set<string>()
    type BreakdownLevel = {
        dimension?: string
        nodes?: Array<{ name?: string }>
        perParentNodes?: Record<string, Array<{ name?: string }> | undefined>
    }
    // TS narrows `activeGoal` to `null` here because the actual assignment
    // happens inside a `.then()` callback. Re-widen via an explicit cast
    // through `unknown` so we can read its breakdown_config at runtime.
    const goalForBreakdown = activeGoal as unknown as GoalV2 | null
    const breakdownConfig = (goalForBreakdown?.breakdown_config as unknown as BreakdownLevel[] | null) ?? []
    for (const level of breakdownConfig) {
        if (level?.dimension !== "sales_owner") continue
        for (const node of level.nodes ?? []) {
            if (node?.name) breakdownSalesNames.add(node.name)
        }
        const perParent = level.perParentNodes ?? {}
        for (const list of Object.values(perParent)) {
            for (const node of list ?? []) {
                if (node?.name) breakdownSalesNames.add(node.name)
            }
        }
    }

    let salesProfiles: SalesProfile[] = []
    if (targetUserIds.size > 0 || breakdownSalesNames.size > 0) {
        const profileQueries: Promise<{ data: SalesProfile[] | null }>[] = []
        if (targetUserIds.size > 0) {
            profileQueries.push(
                Promise.resolve(
                    supabase
                        .from("profiles")
                        .select("id, full_name, avatar_url")
                        .in("id", Array.from(targetUserIds))
                ).then(r => ({ data: (r.data as SalesProfile[] | null) ?? null })),
            )
        }
        if (breakdownSalesNames.size > 0) {
            profileQueries.push(
                Promise.resolve(
                    supabase
                        .from("profiles")
                        .select("id, full_name, avatar_url")
                        .in("full_name", Array.from(breakdownSalesNames))
                ).then(r => ({ data: (r.data as SalesProfile[] | null) ?? null })),
            )
        }
        const results = await Promise.all(profileQueries)
        const seen = new Set<string>()
        for (const r of results) {
            for (const p of r.data ?? []) {
                if (p?.id && !seen.has(p.id)) {
                    seen.add(p.id)
                    salesProfiles.push(p)
                }
            }
        }
    }

    return (
        <>
            {leads.length >= DASHBOARD_LEADS_LIMIT && (
                <div className="mx-6 mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Dashboard is limited to latest {DASHBOARD_LEADS_LIMIT.toLocaleString()} records for launch stability. Use lead filters for full detail review.
                </div>
            )}
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
                salesProfiles={salesProfiles}
            />
        </>
    )
}
