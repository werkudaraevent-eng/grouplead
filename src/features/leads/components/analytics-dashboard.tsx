"use client"

import { useMemo, useState, useEffect, useRef, useCallback } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Lead, PipelineStage } from "@/types"
import type { GoalV2, GoalNode, GoalUserTarget, GoalSettingsV2 } from "@/types/goals"
import { GoalDataProvider } from "@/features/goals/contexts/goal-data-context"
import { EmptyState } from "@/components/shared/empty-state"
import { buildDashboardStageSeries } from "@/features/leads/lib/dashboard-stage-series"
import {
    splitDashboardLeadsByPeriod,
    splitLeadsByBasis,
    getRevenueDate,
    getDashboardPeriodRanges,
    prorateTarget,
    prorateMonthlyTargets,
    isAllTimeRange,
    type DashboardPeriod,
} from "@/features/leads/lib/dashboard-period"
import { Briefcase, Trophy, CheckSquare, RefreshCw, TrendingUp, Calendar, Layers, FileDown, Sparkles, MessageCircle, Loader2, MoreHorizontal, Info } from "lucide-react"
import { useCurrency } from "@/contexts/currency-context"
import { ACCENT, MONTHS_SHORT, getVsLastYearPct } from "./dashboard-widgets/shared"
import { WIDGET_IDS } from "@/features/leads/lib/dashboard-layout"
import { DashboardGrid } from "./dashboard-grid"
import {
    SingleKPIWidget,
    RevenueChartWidget,
    type RevenueBasis,
    PipelineWidget,
    SalesPerfWidget,
    TopRevenueWidget,
    LeadSourceWidget,
    ClassificationWidget,
    StreamWidget,
    GoalAttainmentWidget,
    GoalCompanyBreakdownWidget,
    GoalSegmentBreakdownWidget,
    GoalTrendWidget,
} from "./dashboard-widgets"
import { ContactAnalyticsWidget } from "@/features/contacts/components/dashboard"
import type { CustomWidget } from "@/types/custom-widget"
import { aggregateLeads } from "@/features/leads/lib/aggregate-leads"
import { CustomWidgetRenderer } from "./dashboard-widgets/custom-widget-renderer"
import { WidgetConfiguratorModal } from "./dashboard-widgets/widget-configurator-modal"
import { useDashboardTools } from "./dashboard-widgets/use-dashboard-tools"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Tooltip } from "@/components/ui/tooltip"
import type { CustomWidgetInput } from "@/types/custom-widget"
import { createClient } from "@/utils/supabase/client"
import { useCompany } from "@/contexts/company-context"
import { resolveLeadField, resolveCompanyName } from "@/lib/resolve-lead-field"
import { useDashboardViews } from "@/features/leads/hooks/use-dashboard-views"
import { DashboardViewSwitcher } from "./dashboard-view-switcher"
import type { DashboardFiltersSnapshot } from "@/types/dashboard-view"
import type { LayoutItem } from "react-grid-layout"
import type { WidgetId } from "@/features/leads/lib/dashboard-layout"

const LAUNCH_WIDGET_IDS = WIDGET_IDS.filter(
    id => id !== "goal-forecast" && id !== "goal-variance",
) as WidgetId[]

// ─── Helper ─────────────────────────────────────────────────────────────────
function getStageComparisonLabel(period: string) {
    if (period === "all_time" || period === "custom") return "Last calendar year"
    return "Same period last year"
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────
interface AnalyticsDashboardProps {
    leads: Lead[]
    pipelines?: { id: string; name: string; is_default?: boolean }[]
    activePipelineId?: string
    pipelineStages?: PipelineStage[]
    activeGoal?: GoalV2 | null
    goalNodes?: GoalNode[]
    userTargets?: GoalUserTarget[]
    goalSettings?: GoalSettingsV2 | null
    customWidgets?: CustomWidget[]
    salesProfiles?: { id: string; full_name: string | null }[]
}

export function AnalyticsDashboard({
    leads,
    pipelines = [],
    activePipelineId,
    pipelineStages = [],
    activeGoal = null,
    goalNodes = [],
    userTargets = [],
    goalSettings = null,
    customWidgets = [],
    salesProfiles = [],
}: AnalyticsDashboardProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const { activeCompany, companies, isHoldingView } = useCompany()
    const { fmt, fmtAxis } = useCurrency()
    const currentYear = new Date().getFullYear()
    const [hasMounted, setHasMounted] = useState(false)
    const [companyFilter, setCompanyFilter] = useState<string>("all")
    const [periodStr, setPeriodStr] = useState("this_quarter")
    const [customStart, setCustomStart] = useState("")
    const [customEnd, setCustomEnd] = useState("")
    const [catToggle, setCatToggle] = useState<string>('category')
    const [streamToggle, setStreamToggle] = useState<string>('main_stream')
    // Revenue chart: main bars are always the current year. `compareYear`
    // holds the optional historical year overlaid as a secondary series.
    // null = no comparison (default — chart shows current-year revenue + target only).
    const [compareYear, setCompareYear] = useState<number | null>(null)
    const [revenueBasis, setRevenueBasis] = useState<RevenueBasis>("revenue_recognition")
    const [scrolled, setScrolled] = useState(false)
    const scrollRef = useRef<HTMLElement | null>(null)

    // ─── Dashboard views (saved layouts + filters) ────────────────────────
    const views = useDashboardViews()
    const [isDashboardEditing, setIsDashboardEditing] = useState(false)
    // Grid owns the live (possibly unsaved) layout while the user edits.
    // We receive it back through a ref on the persist callback. For the
    // "unsaved changes" indicator and Save flow, we also mirror the latest
    // layout from the grid into state via onPersistLayout.
    const pendingGridRef = useRef<{ layout: LayoutItem[]; hidden: WidgetId[] } | null>(null)
    // Imperative handle injected by the grid: lets the parent insert a
    // freshly-created custom widget into the grid's live layout without
    // racing the seed effect or using stale DB state.
    const addCustomWidgetRef = useRef<((id: string, width?: number, height?: number) => void) | null>(null)

    // Track when filters have drifted from the active view's saved snapshot.
    const activeViewFilters = views.activeView?.filters ?? null
    const currentFiltersSnapshot: DashboardFiltersSnapshot = useMemo(() => ({
        period: periodStr,
        customStart,
        customEnd,
        companyFilter,
        revenueBasis,
        catToggle,
        streamToggle,
        compareYear,
        pipelineId: activePipelineId,
    }), [periodStr, customStart, customEnd, companyFilter, revenueBasis, catToggle, streamToggle, compareYear, activePipelineId])

    // Seed filter state from active view (only on view switch, not on every render).
    const seededViewIdRef = useRef<string | null>(null)
    useEffect(() => {
        const v = views.activeView
        if (!v) return
        if (seededViewIdRef.current === v.id) return
        seededViewIdRef.current = v.id
        const f = v.filters ?? {}
        if (typeof f.period === "string") setPeriodStr(f.period)
        if (typeof f.customStart === "string") setCustomStart(f.customStart)
        if (typeof f.customEnd === "string") setCustomEnd(f.customEnd)
        if (typeof f.companyFilter === "string") setCompanyFilter(f.companyFilter)
        if (typeof f.revenueBasis === "string") setRevenueBasis(f.revenueBasis as RevenueBasis)
        if (typeof f.catToggle === "string") setCatToggle(f.catToggle)
        if (typeof f.streamToggle === "string") setStreamToggle(f.streamToggle)
        // compareYear: explicit null means "no comparison". Older saved views
        // may only carry the legacy `trendYear` — ignore it (default to None)
        // since the main series is now always the current year.
        if (f.compareYear === null || typeof f.compareYear === "number") setCompareYear(f.compareYear ?? null)
        else setCompareYear(null)
        // Pipeline lives in the URL (?pipeline=) so the server can fetch its
        // stages on the next render. Push only when the saved view points to a
        // different pipeline than what's currently in the URL to avoid a no-op
        // navigation loop.
        if (typeof f.pipelineId === "string" && f.pipelineId && f.pipelineId !== activePipelineId) {
            const params = new URLSearchParams(searchParams.toString())
            params.set("pipeline", f.pipelineId)
            router.push(`${pathname}?${params.toString()}`)
        }
    }, [views.activeView, activePipelineId, pathname, router, searchParams])

    const filtersEqualSnapshot = useCallback(
        (a: DashboardFiltersSnapshot | null, b: DashboardFiltersSnapshot): boolean => {
            if (!a) return false
            return (
                (a.period ?? "this_quarter") === (b.period ?? "this_quarter") &&
                (a.customStart ?? "") === (b.customStart ?? "") &&
                (a.customEnd ?? "") === (b.customEnd ?? "") &&
                (a.companyFilter ?? "all") === (b.companyFilter ?? "all") &&
                (a.revenueBasis ?? "revenue_recognition") === (b.revenueBasis ?? "revenue_recognition") &&
                (a.catToggle ?? "category") === (b.catToggle ?? "category") &&
                (a.streamToggle ?? "main_stream") === (b.streamToggle ?? "main_stream") &&
                (a.compareYear ?? null) === (b.compareYear ?? null) &&
                (a.pipelineId ?? "") === (b.pipelineId ?? "")
            )
        },
        [],
    )

    const hasUnsavedFilterChanges = useMemo(() => {
        if (!views.activeView) return false
        return !filtersEqualSnapshot(activeViewFilters, currentFiltersSnapshot)
    }, [views.activeView, activeViewFilters, currentFiltersSnapshot, filtersEqualSnapshot])

    const handlePersistLayout = useCallback(
        async (layout: LayoutItem[], hidden: WidgetId[]) => {
            pendingGridRef.current = { layout, hidden }
            const target = views.activeView
            if (!target) return
            await views.updateView({
                id: target.id,
                name: target.name,
                layout_data: layout,
                hidden_widgets: hidden,
                filters: currentFiltersSnapshot,
            })
        },
        [views, currentFiltersSnapshot],
    )

    // Save-current handler exposed to the switcher menu ("Save changes to this view").
    const handleSaveCurrentView = useCallback(async () => {
        const target = views.activeView
        if (!target) return
        const pending = pendingGridRef.current
        await views.updateView({
            id: target.id,
            name: target.name,
            layout_data: pending?.layout ?? target.layout_data,
            hidden_widgets: pending?.hidden ?? target.hidden_widgets,
            filters: currentFiltersSnapshot,
        })
    }, [views, currentFiltersSnapshot])

    // Save-as-new handler exposed to the switcher menu.
    const handleSaveAsNewView = useCallback(
        async (name: string) => {
            const current = views.activeView
            const pending = pendingGridRef.current
            await views.createView({
                name,
                layout_data: pending?.layout ?? current?.layout_data ?? [],
                hidden_widgets: pending?.hidden ?? current?.hidden_widgets ?? [],
                filters: currentFiltersSnapshot,
                is_default: false,
            })
        },
        [views, currentFiltersSnapshot],
    )

    // Company-filtered leads (for holding view)
    const filteredLeads = useMemo(() => {
        let result = leads
        // Scope to the active pipeline so KPI numbers match the pipeline view.
        // page.tsx deliberately loads leads across ALL pipelines (for YoY), so
        // without this narrowing every KPI (Won Revenue, Total Leads, …) would
        // aggregate across pipelines and not match the pipeline's own totals.
        // No selected pipeline → keep everything.
        if (activePipelineId) {
            result = result.filter(l => l.pipeline_id === activePipelineId)
        }
        if (isHoldingView && companyFilter !== "all") {
            result = result.filter(l => l.company_id === companyFilter)
        }
        return result
    }, [leads, isHoldingView, companyFilter, activePipelineId])

    const periodLeadBuckets = useMemo(() => splitDashboardLeadsByPeriod(
        filteredLeads,
        periodStr as DashboardPeriod,
        new Date(),
        periodStr === "custom" && customStart && customEnd ? { start: customStart, end: customEnd } : undefined
    ), [filteredLeads, periodStr, customStart, customEnd])
    const periodLeads = periodLeadBuckets.current
    const previousPeriodLeads = periodLeadBuckets.previous
    const dashboardRange = useMemo(() => getDashboardPeriodRanges(
        periodStr as DashboardPeriod,
        new Date(),
        periodStr === "custom" && customStart && customEnd ? { start: customStart, end: customEnd } : undefined,
    ).current, [periodStr, customStart, customEnd])
    const stageComparisonLabel = useMemo(() => getStageComparisonLabel(periodStr), [periodStr])

    // ── Per-basis lead buckets ───────────────────────────────────────────────
    // Each KPI on the Performance Dashboard is bucketed using the date that
    // matches the question the metric answers. See `dashboard-period.ts` →
    // `DateBasis` for the rationale per basis. We compute all four buckets
    // up-front so each card can pick its own without re-walking the data.
    const customRangeArg = periodStr === "custom" && customStart && customEnd
        ? { start: customStart, end: customEnd }
        : undefined
    const receivedBuckets = useMemo(() => splitLeadsByBasis(
        filteredLeads, "received", periodStr as DashboardPeriod, new Date(), customRangeArg,
    ), [filteredLeads, periodStr, customStart, customEnd]) // eslint-disable-line react-hooks/exhaustive-deps
    const closeBuckets = useMemo(() => splitLeadsByBasis(
        filteredLeads, "close", periodStr as DashboardPeriod, new Date(), customRangeArg,
    ), [filteredLeads, periodStr, customStart, customEnd]) // eslint-disable-line react-hooks/exhaustive-deps
    const revenueBuckets = useMemo(() => splitLeadsByBasis(
        filteredLeads, "revenue", periodStr as DashboardPeriod, new Date(), customRangeArg,
    ), [filteredLeads, periodStr, customStart, customEnd]) // eslint-disable-line react-hooks/exhaustive-deps
    const targetCloseBuckets = useMemo(() => splitLeadsByBasis(
        filteredLeads, "target_close", periodStr as DashboardPeriod, new Date(), customRangeArg,
    ), [filteredLeads, periodStr, customStart, customEnd]) // eslint-disable-line react-hooks/exhaustive-deps

    // Custom widgets state
    const [customWidgetsList, setCustomWidgetsList] = useState<CustomWidget[]>(customWidgets ?? [])
    const [showConfigurator, setShowConfigurator] = useState(false)
    const [editingWidget, setEditingWidget] = useState<CustomWidget | null>(null)

    // Compute aggregation data for each custom widget
    const customWidgetData = useMemo(() => {
        const map = new Map<string, any>()
        for (const w of customWidgetsList) {
            const result = aggregateLeads(periodLeadBuckets.current, {
                metricField: w.metric_field as any,
                aggregation: w.aggregation as any,
                groupBy: w.group_by,
                limit: w.config?.limit ?? 10,
            })
            map.set(w.id, result)
        }
        return map
    }, [customWidgetsList, periodLeadBuckets])

    const handleSaveCustomWidget = useCallback(async (input: CustomWidgetInput) => {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        if (editingWidget) {
            // Update existing
            const { data, error } = await supabase
                .from('custom_widgets')
                .update({
                    title: input.title,
                    widget_type: input.widget_type,
                    metric_field: input.metric_field,
                    aggregation: input.aggregation,
                    group_by: input.group_by,
                    config: input.config,
                })
                .eq('id', editingWidget.id)
                .select()
                .single()

            if (!error && data) {
                setCustomWidgetsList(prev => prev.map(w => w.id === data.id ? data : w))
            }
        } else {
            // Create new
            const { data, error } = await supabase
                .from('custom_widgets')
                .insert({
                    user_id: user.id,
                    company_id: input.company_id,
                    title: input.title,
                    widget_type: input.widget_type,
                    metric_field: input.metric_field,
                    aggregation: input.aggregation,
                    group_by: input.group_by,
                    config: input.config,
                })
                .select()
                .single()

            if (!error && data) {
                setCustomWidgetsList(prev => [...prev, data])
                // Insert the widget into the grid's live in-memory layout
                // through the imperative handle. Placement is computed from
                // the user's current (possibly unsaved) layout rather than
                // stale DB data, so it lands cleanly below the last widget
                // with the configured 4x5 size. Persistence happens when the
                // user clicks Save in edit mode.
                addCustomWidgetRef.current?.(`custom-${data.id}`, 4, 5)
            }
        }
        setShowConfigurator(false)
        setEditingWidget(null)
    }, [editingWidget])

    const handleDeleteCustomWidget = useCallback(async (widgetId: string) => {
        const supabase = createClient()
        await supabase.from('custom_widgets').delete().eq('id', widgetId)
        setCustomWidgetsList(prev => prev.filter(w => w.id !== widgetId))
    }, [])

    useEffect(() => { setHasMounted(true) }, [])

    // Scroll hysteresis
    const SCROLL_HIDE = 20
    const SCROLL_SHOW = 6

    useEffect(() => {
        const timer = setTimeout(() => {
            const parent = document.getElementById("dashboard-scroll-area")
            if (!parent) return
            scrollRef.current = parent
            let ticking = false
            const handler = () => {
                if (ticking) return
                ticking = true
                requestAnimationFrame(() => {
                    const top = parent.scrollTop
                    setScrolled(prev => {
                        if (prev && top < SCROLL_SHOW) return false
                        if (!prev && top > SCROLL_HIDE) return true
                        return prev
                    })
                    ticking = false
                })
            }
            parent.addEventListener("scroll", handler, { passive: true })
            ;(scrollRef as any)._cleanup = () => parent.removeEventListener("scroll", handler)
        }, 100)
        return () => {
            clearTimeout(timer)
            ;(scrollRef as any)?._cleanup?.()
        }
    }, [])

    const goalProviderValue = useMemo(() => ({
        activeGoal: activeGoal ?? null,
        goalNodes: goalNodes ?? [],
        userTargets: userTargets ?? [],
        goalSettings: goalSettings ?? null,
        leads: periodLeads,
    }), [activeGoal, goalNodes, userTargets, goalSettings, periodLeads])

    // Years available as a historical comparison overlay on the revenue
    // chart. Only past years (< current) that actually carry revenue data
    // qualify — we never offer a comparison year with nothing to show.
    // Sorted descending (most recent first).
    const compareYears = useMemo(() => {
        const years = new Set<number>()
        leads.forEach(l => {
            const d = getRevenueDate(l)
            if (d) {
                const yr = d.getFullYear()
                if (yr < currentYear) years.add(yr)
            }
        })
        return Array.from(years).sort((a, b) => b - a)
    }, [leads, currentYear])

    // If the selected comparison year drops out of the available set (e.g.
    // company filter changes), reset to None so the picker can't show a stale
    // year with no data.
    useEffect(() => {
        if (compareYear !== null && !compareYears.includes(compareYear)) {
            setCompareYear(null)
        }
    }, [compareYears, compareYear])

    // ─── STATS (period-filtered, per-basis) ─────────────────────────
    //
    // Each KPI uses a different date basis to answer the right question:
    //   Total Leads      = COUNT received-bucket            (received_date)
    //   Deal Win Rate    = won / (won + lost) close-bucket  (closed_*_date)
    //   Lead Conversion  = won / total close-bucket         (closed_*_date)
    //   Won Revenue      = SUM revenue-bucket where won     (event/month_event)
    //   Avg Deal Size    = won_revenue / won_count          (revenue-bucket)
    //   Pipeline Value   = SUM target-close-bucket active   (target_close_date,
    //                                                        excludes nulls)
    const stats = useMemo(() => {
        // Total Leads — every received lead in the period
        const totalInquiry = receivedBuckets.current.length

        // Win rate — close bucket only (resolved deals)
        let closedWonCount = 0
        let closedLostCount = 0
        for (const l of closeBuckets.current) {
            const status = l.pipeline_stage?.closed_status
            if (status === "won") closedWonCount++
            else if (status === "lost") closedLostCount++
        }
        const totalClosed = closedWonCount + closedLostCount
        const winRate = totalClosed > 0 ? (closedWonCount / totalClosed) * 100 : 0

        // Lead Conversion — wins this period vs leads received this period.
        // Mixed basis on purpose: numerator is from close bucket (only
        // counts deals settled this period), denominator is from received
        // bucket (every lead that came in). This makes Lead Conversion
        // distinct from Win Rate — it treats open leads as "not yet
        // converted" so the metric is locked once the period ends.
        const conversionRate = totalInquiry > 0
            ? (closedWonCount / totalInquiry) * 100
            : 0

        // Won Revenue / Avg Deal — sum from the revenue-recognition bucket
        let totalRevenue = 0
        let revenueWonCount = 0
        for (const l of revenueBuckets.current) {
            if (l.pipeline_stage?.closed_status !== "won") continue
            totalRevenue += (l.actual_value ?? l.estimated_value ?? 0)
            revenueWonCount++
        }
        const avgSize = revenueWonCount > 0 ? totalRevenue / revenueWonCount : 0

        // Pipeline Value — active stages, bucketed by target_close_date.
        // Leads with no target_close_date are surfaced separately so the
        // user knows their pipeline view is incomplete.
        let pipelineValue = 0
        let pipelineLeadCount = 0
        let activeWithoutTargetClose = 0
        for (const l of targetCloseBuckets.current) {
            if (l.pipeline_stage?.stage_type !== "open") continue
            pipelineValue += (l.estimated_value ?? 0)
            pipelineLeadCount++
        }
        for (const l of targetCloseBuckets.excluded) {
            if (l.pipeline_stage?.stage_type === "open") activeWithoutTargetClose++
        }

        return {
            totalInquiry,
            totalRevenue,
            winRate,
            conversionRate,
            avgSize,
            closedWonCount,
            pipelineValue,
            pipelineLeadCount,
            activeWithoutTargetClose,
        }
    }, [receivedBuckets, closeBuckets, revenueBuckets, targetCloseBuckets])

    // ─── PERIOD COMPARISON METRICS ──────────────────────────────────
    // Compares current period vs same period last year. Each comparison
    // uses the same basis as its corresponding KPI card so the YoY arrow
    // is honest (compares apples-to-apples).
    const goalMetrics = useMemo(() => {
        // Helpers per basis
        const countLeads = (set: Lead[]) => set.length
        const countWon = (set: Lead[]) =>
            set.reduce((s, l) => s + (l.pipeline_stage?.closed_status === "won" ? 1 : 0), 0)
        const countLost = (set: Lead[]) =>
            set.reduce((s, l) => s + (l.pipeline_stage?.closed_status === "lost" ? 1 : 0), 0)
        const sumWonRevenue = (set: Lead[]) =>
            set.reduce((s, l) => l.pipeline_stage?.closed_status === "won"
                ? s + (l.actual_value ?? l.estimated_value ?? 0)
                : s, 0)

        // Current vs previous, each from the appropriate bucket
        const currentInquiry = countLeads(receivedBuckets.current)
        const prevInquiry = countLeads(receivedBuckets.previous)

        const currentWon = countWon(closeBuckets.current)
        const currentLost = countLost(closeBuckets.current)
        const prevWon = countWon(closeBuckets.previous)
        const prevLost = countLost(closeBuckets.previous)

        const currentClosed = currentWon + currentLost
        const prevClosed = prevWon + prevLost

        const currentWinRate = currentClosed > 0 ? (currentWon / currentClosed) * 100 : 0
        const prevWinRate = prevClosed > 0 ? (prevWon / prevClosed) * 100 : 0

        // Lead Conversion uses the mixed-basis formula (see stats memo):
        // wins (close bucket) / total received (received bucket).
        const currentConvRate = currentInquiry > 0 ? (currentWon / currentInquiry) * 100 : 0
        const prevConvRate = prevInquiry > 0 ? (prevWon / prevInquiry) * 100 : 0

        const currentRevenue = sumWonRevenue(revenueBuckets.current)
        const prevRevenue = sumWonRevenue(revenueBuckets.previous)
        const currentRevenueWon = countWon(revenueBuckets.current)
        const prevRevenueWon = countWon(revenueBuckets.previous)
        const currentAvg = currentRevenueWon > 0 ? currentRevenue / currentRevenueWon : 0
        const prevAvg = prevRevenueWon > 0 ? prevRevenue / prevRevenueWon : 0

        // Calculate vs previous period percentages
        const calculateVsPrev = (current: number, previous: number) => {
            if (previous === 0) return null
            return ((current - previous) / previous) * 100
        }

        const inquiryYoy = calculateVsPrev(currentInquiry, prevInquiry)
        const revYoy = calculateVsPrev(currentRevenue, prevRevenue)
        const winYoy = calculateVsPrev(currentWinRate, prevWinRate)
        const convYoy = calculateVsPrev(currentConvRate, prevConvRate)
        const avgYoy = calculateVsPrev(currentAvg, prevAvg)

        // Calculate vs target percentages
        const revenueTarget = activeGoal?.target_amount || 0
        const revenuePctVsTarget = revenueTarget > 0
            ? ((currentRevenue - revenueTarget) / revenueTarget) * 100
            : null

        return {
            revenueTarget,
            revenuePctVsTarget,
            inquiryYoy,
            inquiryTgt: null, // No target for inquiry count yet
            revYoy,
            revTgt: revenuePctVsTarget,
            winYoy,
            winTgt: null, // No target for win rate yet
            convYoy,
            // Absolute difference in percentage points (e.g. 34.6% - 30% = +4.6)
            convTgt: goalSettings?.conversion_target_pct != null && goalSettings.conversion_target_pct > 0
                ? currentConvRate - goalSettings.conversion_target_pct
                : null,
            avgYoy,
            avgTgt: null, // No target for avg deal size yet
        }
    }, [activeGoal, goalSettings, receivedBuckets, closeBuckets, revenueBuckets])

    // ─── CHART DATA ─────────────────────────────────────────────────
    // Parse "April 2026" → { month: 3, year: 2026 } for month_event field
    const MONTH_NAMES_LONG = ["January","February","March","April","May","June","July","August","September","October","November","December"]

    const monthlyRev = useMemo(() => {
        const data = MONTHS_SHORT.map(m => ({ month: m, actual: 0, target: 0, prevYear: 0, overUnder: 0, vsLastYear: null as number | null }))
        filteredLeads.forEach(l => {
            const stage = (l.pipeline_stage?.name || "").toLowerCase()
            if (!stage.includes("won")) return

            const val = (l.actual_value ?? l.estimated_value ?? 0)
            let y: number | null = null
            let m: number | null = null

            if (revenueBasis === "revenue_recognition") {
                // Use month_event field (format: "April 2026")
                // Fallback to event_date_end → event_date_start if month_event is empty
                const monthEvent = l.month_event
                if (monthEvent && typeof monthEvent === "string") {
                    const parts = monthEvent.trim().split(/\s+/)
                    if (parts.length >= 2) {
                        const mi = MONTH_NAMES_LONG.indexOf(parts[0])
                        const yr = parseInt(parts[parts.length - 1], 10)
                        if (mi >= 0 && !isNaN(yr)) { m = mi; y = yr }
                    }
                }
                // Fallback to event dates
                if (y === null || m === null) {
                    const dateStr = l.event_date_end ?? l.event_date_start
                    if (dateStr) {
                        const d = new Date(dateStr)
                        if (!isNaN(d.getTime())) { y = d.getFullYear(); m = d.getMonth() }
                    }
                }
            } else {
                // closed_won: use closed_won_date field, fallback to updated_at
                const dateStr = l.closed_won_date ?? l.updated_at
                const d = new Date(dateStr)
                if (!isNaN(d.getTime())) { y = d.getFullYear(); m = d.getMonth() }
            }

            if (y !== null && m !== null) {
                // Main series is always the current year. The optional overlay
                // (`prevYear`) is whatever historical year the user picked.
                if (y === currentYear) data[m].actual += val
                else if (compareYear !== null && y === compareYear) data[m].prevYear += val
            }
        })

        // ── Calculate monthly target ──
        //
        // Priority:
        //   1. breakdown_config "month" dimension — walk the tree to compute
        //      each month's absolute target by multiplying pct through parent
        //      levels. If month is at level N, its absolute value =
        //      sum over all parent chains of (parent_amount * month_pct / 100).
        //      When perParentNodes exist, each parent has its own month breakdown.
        //   2. goal_nodes leaf monthly_targets — bottom-up aggregation.
        //   3. monthly_weights on the goal — top-level distribution weights.
        //   4. Equal distribution — target_amount / 12.

        const monthNames = ["January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"]

        // --- Priority 1: breakdown_config month dimension ---
        let monthTargetsFromConfig: Record<number, number> | null = null

        if (activeGoal?.breakdown_config && Array.isArray(activeGoal.breakdown_config)) {
            const levels = activeGoal.breakdown_config as any[]
            const monthLevelIdx = levels.findIndex((lv: any) => lv.dimension === "month")

            if (monthLevelIdx >= 0) {
                const monthLevel = levels[monthLevelIdx]
                const totalTarget = activeGoal.target_amount || 0

                // Compute parent amounts by walking levels 0..monthLevelIdx-1
                // Each parent node's absolute amount = parentAmount * (node.pct / 100)
                // Start with [totalTarget] as the single root amount
                let parentAmounts: { name: string; amount: number }[] = [{ name: "__root__", amount: totalTarget }]

                for (let li = 0; li < monthLevelIdx; li++) {
                    const lv = levels[li]
                    const nodes: any[] = lv.nodes || []
                    const nextParents: { name: string; amount: number }[] = []

                    if (lv.applyAll !== false || !lv.perParentNodes || Object.keys(lv.perParentNodes).length === 0) {
                        // Shared nodes: each node gets pct of sum(parentAmounts).
                        // Always compute from pct — stored `value` may be stale
                        // (config page bug computes value against single parent).
                        const sumParent = parentAmounts.reduce((s, p) => s + p.amount, 0)
                        for (const node of nodes) {
                            const nodeAmt = sumParent * (node.pct || 0) / 100
                            nextParents.push({ name: node.name, amount: nodeAmt })
                        }
                    } else {
                        // Per-parent nodes: each parent has its own child breakdown
                        for (const parent of parentAmounts) {
                            const childNodes: any[] = lv.perParentNodes[parent.name] || nodes
                            for (const node of childNodes) {
                                const nodeAmt = node.value > 0 ? node.value : parent.amount * (node.pct || 0) / 100
                                nextParents.push({ name: node.name, amount: nodeAmt })
                            }
                        }
                    }
                    parentAmounts = nextParents
                }

                // Now compute month targets from the month level
                // Each parent feeds into the month breakdown
                monthTargetsFromConfig = {}
                for (let mi = 0; mi < 12; mi++) monthTargetsFromConfig[mi] = 0

                if (monthLevel.applyAll !== false || !monthLevel.perParentNodes || Object.keys(monthLevel.perParentNodes).length === 0) {
                    // Shared month nodes: each month gets pct of sum(parentAmounts).
                    // ALWAYS compute from pct here — the stored `value` on shared month
                    // nodes is unreliable because the config page computes it against a
                    // single parent instead of the sum of all parents.
                    const sumParent = parentAmounts.reduce((s, p) => s + p.amount, 0)
                    const monthNodes: any[] = monthLevel.nodes || []
                    for (const mn of monthNodes) {
                        const mi = monthNames.indexOf(mn.name)
                        if (mi < 0) continue
                        const monthAmt = sumParent * (mn.pct || 0) / 100
                        monthTargetsFromConfig[mi] += monthAmt
                    }
                } else {
                    // Per-parent month nodes: each parent has its own month breakdown
                    for (const parent of parentAmounts) {
                        const monthNodes: any[] = monthLevel.perParentNodes[parent.name] || monthLevel.nodes || []
                        for (const mn of monthNodes) {
                            const mi = monthNames.indexOf(mn.name)
                            if (mi < 0) continue
                            const monthAmt = mn.value > 0 ? mn.value : parent.amount * (mn.pct || 0) / 100
                            monthTargetsFromConfig[mi] += monthAmt
                        }
                    }
                }
            }
        }

        // --- Priority 2: goal_nodes leaf monthly_targets ---
        const parentIds = new Set(goalNodes.map(n => n.parent_node_id).filter(Boolean))
        const leafNodes = goalNodes.filter(n => !parentIds.has(n.id))
        const leafMonthlyTargets = leafNodes.filter(
            n => n.monthly_targets && Object.keys(n.monthly_targets).length > 0
        )
        const hasLeafMonthly = leafMonthlyTargets.length > 0

        // --- Priority 3: monthly_weights ---
        const hasMonthlyWeights = activeGoal?.monthly_weights && Object.keys(activeGoal.monthly_weights).length > 0

        data.forEach((d, idx) => {
            const monthKey = String(idx + 1) // "1" to "12"

            if (monthTargetsFromConfig) {
                // Priority 1: breakdown_config tree walk
                d.target = monthTargetsFromConfig[idx] ?? 0
            } else if (hasLeafMonthly) {
                // Priority 2: goal_nodes leaf monthly_targets
                let monthTotal = 0
                for (const leaf of leafMonthlyTargets) {
                    monthTotal += leaf.monthly_targets![monthKey] ?? 0
                }
                d.target = monthTotal > 0 ? monthTotal : (activeGoal?.target_amount ?? 0) / 12
            } else if (hasMonthlyWeights) {
                // Priority 3: monthly_weights from goal settings
                const weight = activeGoal!.monthly_weights![monthKey] || (1 / 12)
                d.target = activeGoal!.target_amount * weight
            } else if (activeGoal) {
                // Priority 4: equal distribution
                d.target = activeGoal.target_amount / 12
            } else {
                d.target = 0
            }

            if (d.target > 0 && d.actual > 0) {
                d.overUnder = ((d.actual - d.target) / d.target) * 100
            }
            d.vsLastYear = getVsLastYearPct(d.actual, d.prevYear)
        })
        return data
    }, [filteredLeads, currentYear, compareYear, activeGoal, goalNodes, revenueBasis])

    const stageData = useMemo(() => {
        return buildDashboardStageSeries(pipelineStages, periodLeadBuckets.current, periodLeadBuckets.previous)
    }, [pipelineStages, periodLeadBuckets])

    const salesData = useMemo(() => {
        type Rep = {
            name: string
            actual: number
            target: number
            userId?: string
            hasRealTarget: boolean
        }
        const reps: Record<string, Rep> = {}

        // Build a lookup for sales rep display names. profiles fetched on the
        // server cover reps that have targets but no leads in this period.
        const profileById = new Map<string, string>()
        const profileIdByName = new Map<string, string>()
        for (const p of salesProfiles) {
            if (p.full_name) {
                profileById.set(p.id, p.full_name)
                profileIdByName.set(p.full_name, p.id)
            }
        }

        const ensureRep = (userId: string, fallbackName?: string): Rep => {
            if (!reps[userId]) {
                const resolved = profileById.get(userId) || fallbackName || "Unknown"
                reps[userId] = {
                    name: resolved,
                    actual: 0,
                    target: 0,
                    userId,
                    hasRealTarget: false,
                }
            } else if (reps[userId].name === "Unknown" || reps[userId].name === "Unassigned") {
                const resolved = profileById.get(userId)
                if (resolved) reps[userId].name = resolved
            }
            return reps[userId]
        }

        // Calculate actual revenue per sales rep from won deals in selected period
        periodLeads.forEach(l => {
            const stage = (l.pipeline_stage?.name || "").toLowerCase()
            const pic = l.pic_sales_profile?.full_name || "Unassigned"
            const picId = l.pic_sales_id || "unassigned"
            const rep = ensureRep(picId, pic)
            if (stage.includes("won")) {
                rep.actual += (l.actual_value ?? l.estimated_value ?? 0)
            }
        })

        // ── Resolve target span (used for proration fallback when targets
        //    are stored as a single annual amount). Priority:
        //      1. activeGoal.period_start / period_end
        //      2. current calendar year
        const goalRange = (() => {
            if (activeGoal?.period_start && activeGoal?.period_end) {
                const start = new Date(activeGoal.period_start)
                const end = new Date(activeGoal.period_end)
                end.setDate(end.getDate() + 1) // make end exclusive
                if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end > start) {
                    return { start, end }
                }
            }
            return {
                start: new Date(currentYear, 0, 1),
                end: new Date(currentYear + 1, 0, 1),
            }
        })()

        const targetYear = activeGoal?.period_start
            ? new Date(activeGoal.period_start).getFullYear()
            : currentYear

        const allTime = isAllTimeRange(dashboardRange)
        const prorate = (amount: number, range: { start: Date; end: Date } = goalRange) =>
            allTime ? amount : prorateTarget(amount, range, dashboardRange)

        // Apply real targets from userTargets if available — prorate using
        // each target's own period_start/period_end window. Seed missing reps
        // so people with targets but no leads in this period still appear.
        if (userTargets && userTargets.length > 0) {
            userTargets.forEach(ut => {
                const rep = ensureRep(ut.user_id)
                const utStart = ut.period_start ? new Date(ut.period_start) : null
                const utEnd = ut.period_end ? new Date(ut.period_end) : null
                let prorated = ut.target_amount
                if (!allTime && utStart && utEnd && !isNaN(utStart.getTime()) && !isNaN(utEnd.getTime())) {
                    const utEndExclusive = new Date(utEnd)
                    utEndExclusive.setDate(utEndExclusive.getDate() + 1)
                    prorated = prorateTarget(ut.target_amount, { start: utStart, end: utEndExclusive }, dashboardRange)
                }
                rep.target = prorated
                rep.hasRealTarget = true
            })
        }

        // Fallback: apply targets from goal_nodes (pic_sales_id nodes).
        // Prefer monthly_targets when available — they prorate cleanly to
        // partial-quarter / partial-month dashboard windows.
        if (goalNodes && goalNodes.length > 0) {
            goalNodes.forEach(node => {
                // Tolerate legacy rows where reference_field accidentally
                // stores the dimension_type ("sales_owner") instead of the
                // lead column ("pic_sales_id"). See goal-actions.ts fix.
                const isSalesOwnerNode =
                    node.reference_field === "pic_sales_id" ||
                    node.reference_field === "sales_owner" ||
                    node.dimension_type === "sales_owner"
                if (!isSalesOwnerNode || !node.reference_value) return
                const userId = node.reference_value
                const rep = ensureRep(userId, node.name)
                if (rep.hasRealTarget) return

                const monthly = node.monthly_targets && Object.keys(node.monthly_targets).length > 0
                    ? prorateMonthlyTargets(node.monthly_targets, targetYear, dashboardRange)
                    : 0

                const targetAmt = monthly > 0
                    ? monthly
                    : prorate(node.target_amount || 0)

                if (targetAmt > 0) {
                    rep.target = targetAmt
                    rep.hasRealTarget = true
                }
            })
        }

        // Fallback: apply targets from breakdown_config (sales_owner dimension).
        // For multi-level configs (e.g. industry × sales_owner) the target
        // for a given rep is the SUM of their nodes across every parent
        // bucket. We resolve names to user ids via salesProfiles so reps
        // with no leads in this period still get seeded.
        if (activeGoal?.breakdown_config && Array.isArray(activeGoal.breakdown_config)) {
            // Aggregate: name → total raw target across the entire config
            const breakdownTotals = new Map<string, number>()
            const addNode = (node: { name?: string; pct?: number; value?: number }, parentTotal: number) => {
                if (!node?.name) return
                const amt = (node.value && node.value > 0)
                    ? node.value
                    : parentTotal * ((node.pct ?? 0) / 100)
                if (amt <= 0) return
                breakdownTotals.set(node.name, (breakdownTotals.get(node.name) ?? 0) + amt)
            }

            const totalTarget = activeGoal.target_amount || 0
            for (const level of activeGoal.breakdown_config as any[]) {
                if (level?.dimension !== "sales_owner" || !Array.isArray(level.nodes)) continue

                // Shared nodes (applyAll path) — divide goal target across them
                if (level.applyAll !== false || !level.perParentNodes) {
                    for (const node of level.nodes) addNode(node, totalTarget)
                }

                // Per-parent nodes — each parent contributes independently
                if (level.perParentNodes && typeof level.perParentNodes === 'object') {
                    for (const parentNodes of Object.values(level.perParentNodes) as any[]) {
                        if (!Array.isArray(parentNodes)) continue
                        for (const node of parentNodes) addNode(node, totalTarget)
                    }
                }
            }

            for (const [name, rawTarget] of breakdownTotals) {
                if (rawTarget <= 0) continue
                // Resolve name → user id; fall back to a name-based key if
                // no profile match so the rep still appears in the widget.
                const userId = profileIdByName.get(name) ?? `name:${name}`
                const rep = ensureRep(userId, name)
                if (rep.hasRealTarget) continue
                const prorated = prorate(rawTarget)
                if (prorated > 0) {
                    rep.target = prorated
                    rep.hasRealTarget = true
                }
            }
        }

        // Filter rules:
        //   - Drop unassigned bucket.
        //   - Drop reps with zero actual AND zero (prorated) target — they
        //     have no signal in this period, e.g. target window outside the
        //     dashboard range.
        // Sort tracked reps by achievement % ascending so under-performers
        // surface at the top (where the eye lands), then untracked by actual
        // desc so high-revenue reps without targets still get visibility.
        return Object.values(reps)
            .filter(r => r.userId !== "unassigned")
            .filter(r => r.target > 0 || r.actual > 0)
            .sort((a, b) => {
                const aTracked = a.target > 0
                const bTracked = b.target > 0
                if (aTracked !== bTracked) return aTracked ? -1 : 1
                if (aTracked) {
                    return (a.actual / a.target) - (b.actual / b.target)
                }
                return b.actual - a.actual
            })
            .slice(0, 15)
    }, [periodLeads, userTargets, goalNodes, activeGoal, dashboardRange, currentYear, salesProfiles])

    const topComps = useMemo(() => {
        const comps: Record<string, number> = {}
        periodLeads.forEach(l => {
            const stage = (l.pipeline_stage?.name || "").toLowerCase()
            if (stage.includes("won")) {
                const c = resolveCompanyName(l) || "Unknown Company"
                comps[c] = (comps[c] || 0) + (l.actual_value ?? l.estimated_value ?? 0)
            }
        })
        return Object.entries(comps).map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue)
    }, [periodLeads])

    const sourceData = useMemo(() => {
        const m: Record<string, number> = {}
        periodLeads.forEach(l => { const val = resolveLeadField(l, "lead_source") || "Unspecified"; m[val] = (m[val] || 0) + 1 })
        return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
    }, [periodLeads])

    const catGradeData = useMemo(() => {
        const m: Record<string, number> = {}
        periodLeads.forEach(l => { const val = resolveLeadField(l, catToggle) || "Unspecified"; m[val] = (m[val] || 0) + 1 })
        return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
    }, [periodLeads, catToggle])

    const streamData = useMemo(() => {
        const m: Record<string, number> = {}
        periodLeads.forEach(l => { const val = resolveLeadField(l, streamToggle) || "Unspecified"; m[val] = (m[val] || 0) + 1 })
        return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
    }, [periodLeads, streamToggle])

    // ─── SPARKLINE DATA (monthly micro-trends) ────────────────────
    const sparklines = useMemo(() => {
        // Build monthly buckets from periodLeads based on revenue date
        const monthlyLeads = Array.from({ length: 12 }, () => [] as typeof periodLeads)
        const monthlyWon = Array.from({ length: 12 }, () => ({ count: 0, revenue: 0, totalClosed: 0 }))
        const monthlyPipeline = Array(12).fill(0)

        periodLeads.forEach(l => {
            const d = getRevenueDate(l)
            if (!d) return
            const m = d.getMonth()
            monthlyLeads[m].push(l)

            const stage = (l.pipeline_stage?.name || "").toLowerCase()
            if (stage.includes("won")) {
                monthlyWon[m].count++
                monthlyWon[m].revenue += (l.actual_value ?? l.estimated_value ?? 0)
                monthlyWon[m].totalClosed++
            } else if (stage.includes("lost") || stage.includes("cancel")) {
                monthlyWon[m].totalClosed++
            } else {
                monthlyPipeline[m] += (l.estimated_value ?? 0)
            }
        })

        // Only include months up to current month (avoid trailing zeros)
        const now = new Date()
        const maxMonth = now.getMonth() // 0-indexed
        const slice = (arr: number[]) => {
            const s = arr.slice(0, maxMonth + 1)
            // Need at least 2 points for a sparkline
            return s.length >= 2 ? s : undefined
        }

        const leads = slice(monthlyLeads.map(b => b.length))
        const revenue = slice(monthlyWon.map(b => b.revenue))
        const winRate = slice(monthlyWon.map(b => {
            const total = b.totalClosed
            return total > 0 ? (b.count / total) * 100 : 0
        }))
        const conversion = slice(monthlyLeads.map((b, i) => {
            const total = b.length
            return total > 0 ? (monthlyWon[i].count / total) * 100 : 0
        }))
        const avgDeal = slice(monthlyWon.map(b => {
            return b.count > 0 ? b.revenue / b.count : 0
        }))
        const pipeline = slice(monthlyPipeline)

        return { leads, revenue, winRate, conversion, avgDeal, pipeline }
    }, [periodLeads])

    // ─── KPI DEFINITIONS ────────────────────────────────────────────
    //
    // Each card has a hardcoded date basis chosen to match the question
    // the metric answers. Layer 1 (basisLabel) keeps the basis visible at
    // a glance; Layer 2 (basisInfo) gives the plain-English explanation
    // when the user hovers the ⓘ icon. See dashboard-period.ts → DateBasis.
    //
    // Tooltip copy guidelines:
    //   • One short sentence answering "what does this number mean?"
    //   • A "Counted by" line in human terms (no column names)
    //   • A "Why" line if the basis choice could surprise the user
    //   • Avoid: SQL, formulas, column names. Those live in docs.
    const kpis = [
        {
            label: "Total Leads",
            value: String(stats.totalInquiry),
            vsTarget: goalMetrics.inquiryTgt,
            vsPrev: goalMetrics.inquiryYoy,
            accent: ACCENT.leads,
            icon: Briefcase,
            sparkline: sparklines.leads,
            basisLabel: "by received date",
            basisInfo: (
                <div className="space-y-1.5">
                    <div className="font-semibold">Total Leads</div>
                    <div className="opacity-85">How many new leads came in during this period.</div>
                    <div className="pt-1 border-t border-white/10 opacity-70">
                        Counted by the date the lead was received.
                    </div>
                </div>
            ),
        },
        {
            label: "Won Revenue",
            value: fmtAxis(stats.totalRevenue),
            vsTarget: goalMetrics.revTgt,
            vsPrev: goalMetrics.revYoy,
            accent: ACCENT.revenue,
            icon: Trophy,
            sparkline: sparklines.revenue,
            basisLabel: "by revenue recognition month",
            basisInfo: (
                <div className="space-y-1.5">
                    <div className="font-semibold">Won Revenue</div>
                    <div className="opacity-85">Revenue from won deals booked to this period.</div>
                    <div className="pt-1 border-t border-white/10 opacity-70">
                        Counted by the month the event runs (or by event end date) — the way an event business actually recognises revenue.
                    </div>
                </div>
            ),
        },
        {
            label: "Deal Win Rate",
            value: stats.winRate.toFixed(1),
            suffix: "%",
            vsTarget: goalMetrics.winTgt,
            vsPrev: goalMetrics.winYoy,
            accent: ACCENT.winrate,
            icon: CheckSquare,
            sparkline: sparklines.winRate,
            basisLabel: "by close date",
            basisInfo: (
                <div className="space-y-1.5">
                    <div className="font-semibold">Deal Win Rate</div>
                    <div className="opacity-85">Of the deals that finished this period, how many were won.</div>
                    <div className="pt-1 border-t border-white/10 opacity-70">
                        Counted by the date the deal was settled (won or lost), not by when the event will run.
                    </div>
                </div>
            ),
        },
        {
            label: "Lead Conversion",
            value: stats.conversionRate.toFixed(1),
            suffix: "%",
            vsTarget: goalMetrics.convTgt,
            vsPrev: goalMetrics.convYoy,
            accent: ACCENT.conversion,
            icon: RefreshCw,
            sparkline: sparklines.conversion,
            basisLabel: "wins this period ÷ leads received",
            basisInfo: (
                <div className="space-y-1.5">
                    <div className="font-semibold">Lead Conversion</div>
                    <div className="opacity-85">For every lead that came in this period, the share that has already been won.</div>
                    <div className="pt-1 border-t border-white/10 opacity-70">
                        Wins are counted by close date; the denominator is every lead received this period — including ones still open. So this stays low until deals close, and won’t change after the period ends.
                    </div>
                    {goalSettings?.conversion_target_pct
                        ? <div className="opacity-70 pt-1">Target {goalSettings.conversion_target_pct}% · Actual {stats.conversionRate.toFixed(1)}%</div>
                        : null}
                </div>
            ),
        },
        {
            label: "Avg Deal Size",
            value: fmtAxis(stats.avgSize),
            vsTarget: goalMetrics.avgTgt,
            vsPrev: goalMetrics.avgYoy,
            accent: ACCENT.dealsize,
            icon: TrendingUp,
            sparkline: sparklines.avgDeal,
            basisLabel: "by revenue recognition month",
            basisInfo: (
                <div className="space-y-1.5">
                    <div className="font-semibold">Avg Deal Size</div>
                    <div className="opacity-85">The average size of a won deal recognised in this period.</div>
                    <div className="pt-1 border-t border-white/10 opacity-70">
                        Same period basis as Won Revenue, so the two stay in sync.
                    </div>
                </div>
            ),
        },
        {
            label: "Pipeline Value",
            value: fmtAxis(stats.pipelineValue),
            vsTarget: null,
            vsPrev: null,
            accent: "#00A1E9",
            icon: Layers,
            sparkline: sparklines.pipeline,
            // When some deals are missing target_close_date we surface the
            // count inline with the basis label — keeps the card on a single
            // visual line and avoids overflow against the grid row height.
            basisLabel: stats.activeWithoutTargetClose > 0
                ? `by target close · ${stats.activeWithoutTargetClose} hidden`
                : "by target close date",
            basisInfo: (
                <div className="space-y-1.5">
                    <div className="font-semibold">Pipeline Value</div>
                    <div className="opacity-85">The estimated value of open deals expected to close in this period.</div>
                    <div className="pt-1 border-t border-white/10 opacity-70">
                        Open deals without a target close date are skipped — set one on the lead so the deal shows up here.
                    </div>
                    {stats.activeWithoutTargetClose > 0
                        ? <div className="opacity-70 pt-1 text-amber-300">
                            {stats.activeWithoutTargetClose} active deal{stats.activeWithoutTargetClose === 1 ? "" : "s"} are not shown because no target close date is set.
                        </div>
                        : null}
                </div>
            ),
        },
    ]

    // Memoized AI context data — stable reference prevents child remounts
    const aiContextData = useMemo(() => ({
        period: periodStr,
        stats,
        goalMetrics,
        activeGoal: activeGoal ? { name: activeGoal.name, target: activeGoal.target_amount } : null,
        pipelineStages: pipelineStages.map(s => s.name),
        totalLeads: periodLeads.length,
        previousPeriodLeads: previousPeriodLeads.length,
        monthlyRevenue: monthlyRev.map(m => ({ month: m.month, actual: m.actual, target: m.target, prevYear: m.prevYear })),
        salesPerformance: salesData.slice(0, 10).map(s => ({ name: s.name, actual: s.actual, target: s.target })),
        topCompanies: topComps.slice(0, 8),
        leadSources: sourceData.slice(0, 8),
        stageDistribution: stageData.map(s => ({ name: s.name, current: s.count, previous: s.previousCount })),
    }), [periodStr, stats, goalMetrics, activeGoal, pipelineStages, periodLeads.length, previousPeriodLeads.length, monthlyRev, salesData, topComps, sourceData, stageData])

    const isCustomPeriod = periodStr === "custom"
    const isDefaultPeriod = periodStr === "this_quarter" && companyFilter === "all"
    const handleResetPeriod = () => { setPeriodStr("this_quarter"); setCustomStart(""); setCustomEnd(""); setCompanyFilter("all") }

    // Switching pipeline also realigns the period. Pipelines are organised per
    // year ("Group Lead 2025", "Group Lead 2026"), so picking a past-year
    // pipeline while the period is still "This Year" shows an empty dashboard.
    // We parse the 4-digit year from the pipeline name and:
    //   • current year  → snap to "This Year"
    //   • a past year    → Custom Range = Jan 1–Dec 31 of that year (so the
    //                      date inputs stay open and the user can fine-tune)
    //   • no year in name → leave the period untouched
    // Only fires on an explicit manual pipeline switch, never on view restore.
    const handlePipelineChange = useCallback((id: string) => {
        const name = pipelines.find(p => p.id === id)?.name ?? ""
        const yearMatch = name.match(/\b(20\d{2})\b/)
        if (yearMatch) {
            const year = parseInt(yearMatch[1], 10)
            if (year === currentYear) {
                setPeriodStr("this_year")
                setCustomStart("")
                setCustomEnd("")
            } else {
                setPeriodStr("custom")
                setCustomStart(`${year}-01-01`)
                setCustomEnd(`${year}-12-31`)
            }
        }
        const params = new URLSearchParams(searchParams.toString())
        params.set("pipeline", id)
        router.push(`${pathname}?${params.toString()}`)
    }, [pipelines, currentYear, searchParams, router, pathname])

    // Tools dropdown — PDF / Analyze / Ask AI moved here to keep the
    // primary toolbar focused on filter context (pipeline, company,
    // period). Hook also returns the floating panel JSX which we render
    // outside the header so it can position freely.
    const tools = useDashboardTools(aiContextData)

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
            {/* ─── HEADER (two-row, sticky) ──────────────────────────────────
                Inspired by Vercel / Stripe / GitHub Actions: separate the
                identity row (title + global actions) from the filter row
                so each layer has a single purpose. The filter row collapses
                naturally on narrow viewports (chips wrap) instead of being
                horizontally scrolled or clipped.

                Row 1: Title · Tools · View · Edit
                Row 2: Pipeline · Company · Period · custom-range-inputs · Reset
            */}
            <div
                id="dashboard-sticky-header"
                style={{
                    flexShrink: 0,
                    zIndex: 20,
                    display: "flex",
                    flexDirection: "column",
                    background: "rgba(255,255,255,0.85)",
                    backdropFilter: "saturate(180%) blur(12px)",
                    WebkitBackdropFilter: "saturate(180%) blur(12px)",
                    borderBottom: "1px solid rgba(2,55,141,0.06)",
                }}
            >
                {/* ─── Row 1: identity + global actions ─── */}
                <div
                    style={{
                        height: scrolled ? 56 : 68,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0 32px",
                        gap: 12,
                        transition: "height .25s cubic-bezier(0.23,1,0.32,1)",
                    }}
                >
                    {/* Title only — subtitle was marketing fluff. The h1
                        ellipsizes if the toolbar grows wide on narrow
                        viewports. */}
                    <div style={{ minWidth: 0, flexShrink: 1, overflow: "hidden" }}>
                        <h1 style={{
                            fontSize: scrolled ? 17 : 19, fontWeight: 700, color: "#1a2230",
                            letterSpacing: "-0.4px", lineHeight: 1.15, margin: 0,
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                            transition: "font-size .25s cubic-bezier(0.23,1,0.32,1)",
                        }}>
                            Performance Dashboard
                        </h1>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                        {/* Tools — bundles secondary actions (PDF, Analyze, Ask AI).
                            Icon-only with tooltip; matches Vercel / Linear pattern.
                            Active state when any AI panel is open. */}
                        <DropdownMenu>
                            <Tooltip content="Tools — Export, AI Analyze, Ask AI">
                                <DropdownMenuTrigger asChild>
                                    <button
                                        type="button"
                                        aria-label="Dashboard tools"
                                        style={{
                                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                                            width: 32, height: 32, borderRadius: 8, border: "none",
                                            background: (tools.analyzeOpen || tools.askOpen) ? "#1e293b" : "transparent",
                                            color: (tools.analyzeOpen || tools.askOpen) ? "#fff" : "#475569",
                                            cursor: "pointer",
                                            position: "relative",
                                            transition: "background .15s ease, color .15s ease",
                                        }}
                                        onMouseEnter={e => {
                                            if (!tools.analyzeOpen && !tools.askOpen) e.currentTarget.style.background = "#f1f5f9"
                                        }}
                                        onMouseLeave={e => {
                                            if (!tools.analyzeOpen && !tools.askOpen) e.currentTarget.style.background = "transparent"
                                        }}
                                    >
                                        {tools.exporting
                                            ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                                            : <MoreHorizontal size={16} />
                                        }
                                        {tools.analyzeBadge && !tools.analyzeOpen && (
                                            <span style={{
                                                position: "absolute", top: 6, right: 6,
                                                width: 7, height: 7, borderRadius: "50%",
                                                background: "#10B981", border: "2px solid #fff",
                                            }} />
                                        )}
                                    </button>
                                </DropdownMenuTrigger>
                            </Tooltip>
                            <DropdownMenuContent align="end" className="w-52">
                                <DropdownMenuItem
                                    onSelect={() => tools.handleExportPDF()}
                                    disabled={tools.exporting}
                                >
                                    {tools.exporting
                                        ? <Loader2 className="h-4 w-4 animate-spin" />
                                        : <FileDown className="h-4 w-4" />
                                    }
                                    <span className="ml-1">Print / Save PDF</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => tools.handleOpenAnalyze()}>
                                    <Sparkles className="h-4 w-4" style={{ color: "#7C3AED" }} />
                                    <span className="ml-1">AI Analyze</span>
                                    {tools.analyzeBadge && (
                                        <span className="ml-auto text-[10px] text-emerald-600 font-medium">{tools.analyzeBadge}</span>
                                    )}
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => tools.handleOpenAsk()}>
                                    <MessageCircle className="h-4 w-4" style={{ color: "#06B6D4" }} />
                                    <span className="ml-1">Ask AI</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Saved-view switcher */}
                        <DashboardViewSwitcher
                            views={views.views}
                            activeView={views.activeView}
                            loading={views.loading}
                            hasUnsavedChanges={hasUnsavedFilterChanges}
                            isEditMode={isDashboardEditing}
                            onSelectView={(id) => views.setActiveViewId(id)}
                            onSaveCurrent={handleSaveCurrentView}
                            onSaveAsNew={handleSaveAsNewView}
                            onRename={(id, name) => views.renameView(id, name)}
                            onSetDefault={(id) => views.setDefault(id)}
                            onDuplicate={(id) => views.duplicateView(id)}
                            onDelete={(id) => views.deleteView(id)}
                        />

                        {/* Edit Dashboard CTA — primary action on the right.
                            Rendered into via a portal-like pattern (the grid
                            mounts its own button into #dashboard-edit-controls
                            so it can show "Save / Cancel" while editing). */}
                        <div id="dashboard-edit-controls" style={{ display: "flex", alignItems: "center", marginLeft: 4 }} />
                    </div>
                </div>

                {/* ─── Row 2: filter chips ─── */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 6,
                        padding: "0 32px 14px",
                    }}
                >
                    {pipelines.length > 1 && (
                        <Select
                            value={activePipelineId ?? ""}
                            onValueChange={handlePipelineChange}
                        >
                            <SelectTrigger size="sm" className="w-auto h-8 px-2.5 text-[12px] font-medium gap-1.5 border-slate-200 bg-white hover:bg-slate-50 shadow-none rounded-lg">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {pipelines.map(p => (
                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}

                    {isHoldingView && companies.length > 1 && (
                        <Select value={companyFilter} onValueChange={setCompanyFilter}>
                            <SelectTrigger
                                size="sm"
                                className={`w-auto h-8 px-2.5 text-[12px] font-medium gap-1.5 shadow-none rounded-lg ${
                                    companyFilter !== "all"
                                        ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/15"
                                        : "bg-white border-slate-200 hover:bg-slate-50"
                                }`}
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Companies</SelectItem>
                                {companies.filter(c => !c.isHolding).map(c => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}

                    <Select value={periodStr} onValueChange={setPeriodStr}>
                        <SelectTrigger
                            size="sm"
                            className={`w-auto h-8 px-2.5 text-[12px] font-medium gap-1.5 shadow-none rounded-lg ${
                                periodStr !== "this_quarter"
                                    ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/15"
                                    : "bg-white border-slate-200 hover:bg-slate-50"
                            }`}
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="this_month">This Month</SelectItem>
                            <SelectItem value="this_quarter">This Quarter</SelectItem>
                            <SelectItem value="this_year">This Year</SelectItem>
                            <SelectItem value="all_time">All Time</SelectItem>
                            <SelectItem value="custom">Custom Range</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Global note: each card uses its own date basis. The
                        info icon sits inline with the chips so the user
                        sees it the moment they pick a period. Hovering
                        explains the convention; per-card details live in
                        the ⓘ next to each card label. */}
                    <Tooltip
                        position="bottom"
                        content="Each card uses the date that fits what it measures (when leads came in, when deals closed, or when revenue is recognized). Hover the ⓘ on a card to see how it works."
                    >
                        <span
                            className="inline-flex items-center justify-center w-6 h-6 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-help"
                            aria-label="How are these numbers calculated?"
                        >
                            <Info className="w-3.5 h-3.5" />
                        </span>
                    </Tooltip>

                    {isCustomPeriod && (
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <input
                                type="date"
                                value={customStart}
                                onChange={e => setCustomStart(e.target.value)}
                                style={{
                                    height: 32, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 6,
                                    padding: "0 8px", fontSize: 12, fontWeight: 500, color: "#292D30",
                                    fontFamily: "inherit",
                                }}
                            />
                            <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>—</span>
                            <input
                                type="date"
                                value={customEnd}
                                onChange={e => setCustomEnd(e.target.value)}
                                style={{
                                    height: 32, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 6,
                                    padding: "0 8px", fontSize: 12, fontWeight: 500, color: "#292D30",
                                    fontFamily: "inherit",
                                }}
                            />
                        </div>
                    )}

                    {!isDefaultPeriod && (
                        <button
                            type="button"
                            onClick={handleResetPeriod}
                            style={{
                                background: "transparent", border: "none", cursor: "pointer",
                                fontSize: 11, fontWeight: 500, color: "#94a3b8",
                                padding: "0 6px", height: 32, borderRadius: 4, fontFamily: "inherit",
                                transition: "color .15s ease",
                                marginLeft: 2,
                            }}
                            onMouseEnter={e => (e.currentTarget.style.color = "#475569")}
                            onMouseLeave={e => (e.currentTarget.style.color = "#94a3b8")}
                        >
                            Reset
                        </button>
                    )}
                </div>
            </div>

            {/* ─── SCROLLABLE CONTENT (scrollbar starts below header) ─── */}
            <div id="dashboard-scroll-area" className="thin-scrollbar" style={{ flex: 1, overflowY: "auto", overflowX: "clip" }}>
            <div id="dashboard-content" style={{ padding: "28px 32px 40px", background: "#f7f8fa", minHeight: "100%", overflowX: "clip", overflowY: "visible", boxSizing: "border-box", width: "100%", minWidth: 0 }}>
                <DashboardGrid
                    widgetIds={LAUNCH_WIDGET_IDS}
                    customWidgets={customWidgetsList}
                    onCreateCustomWidget={() => { setEditingWidget(null); setShowConfigurator(true) }}
                    onEditCustomWidget={(w) => { setEditingWidget(w); setShowConfigurator(true) }}
                    onDeleteCustomWidget={handleDeleteCustomWidget}
                    initialLayout={views.activeView?.layout_data ?? []}
                    initialHiddenWidgets={views.activeView?.hidden_widgets ?? []}
                    viewKey={views.activeView?.id ?? "none"}
                    onPersistLayout={handlePersistLayout}
                    onEditModeChange={setIsDashboardEditing}
                    activeViewName={views.activeView?.name}
                    addCustomWidgetRef={addCustomWidgetRef}
                >
                    {/* Order MUST match WIDGET_IDS array */}
                    {/* 6 individual KPI cards */}
                    <SingleKPIWidget {...kpis[0]} />
                    <SingleKPIWidget {...kpis[1]} />
                    <SingleKPIWidget {...kpis[2]} />
                    <SingleKPIWidget {...kpis[3]} />
                    <SingleKPIWidget {...kpis[4]} />
                    <SingleKPIWidget {...kpis[5]} />
                    {/* Chart widgets */}
                    <RevenueChartWidget
                        data={monthlyRev}
                        currentYear={currentYear}
                        compareYear={compareYear}
                        setCompareYear={setCompareYear}
                        compareYears={compareYears}
                        hasMounted={hasMounted}
                        revenueBasis={revenueBasis}
                        setRevenueBasis={setRevenueBasis}
                    />
                    <PipelineWidget
                        data={stageData}
                        comparisonLabel={stageComparisonLabel}
                        pipelines={pipelines}
                        activePipelineId={activePipelineId}
                        onPipelineChange={handlePipelineChange}
                    />
                    <SalesPerfWidget data={salesData} />
                    <TopRevenueWidget data={topComps} />
                    <LeadSourceWidget data={sourceData} />
                    <ClassificationWidget data={catGradeData} catToggle={catToggle} setCatToggle={setCatToggle} />
                    <StreamWidget data={streamData} streamToggle={streamToggle} setStreamToggle={setStreamToggle} />
                    {/* Contact analytics */}
                    <ContactAnalyticsWidget leads={periodLeads} />
                    {/* Goal widgets - each individually wrapped */}
                    <GoalDataProvider value={goalProviderValue}>
                      {activeGoal ? <GoalAttainmentWidget /> : <div><EmptyState icon={TrendingUp} title="No active goal configured" description="Set up goals in settings" size="sm" /></div>}
                    </GoalDataProvider>
                    <GoalDataProvider value={goalProviderValue}>
                      {activeGoal ? <GoalCompanyBreakdownWidget /> : <div><EmptyState icon={TrendingUp} title="No active goal configured" description="Set up goals in settings" size="sm" /></div>}
                    </GoalDataProvider>
                    <GoalDataProvider value={goalProviderValue}>
                      {activeGoal ? <GoalSegmentBreakdownWidget /> : <div><EmptyState icon={TrendingUp} title="No active goal configured" description="Set up goals in settings" size="sm" /></div>}
                    </GoalDataProvider>
                    <GoalDataProvider value={goalProviderValue}>
                      {activeGoal ? <GoalTrendWidget /> : <div><EmptyState icon={TrendingUp} title="No active goal configured" description="Set up goals in settings" size="sm" /></div>}
                    </GoalDataProvider>
                    {/* Custom widgets */}
                    {customWidgetsList.map(w => (
                        <CustomWidgetRenderer
                            key={`custom-${w.id}`}
                            widget={w}
                            data={customWidgetData.get(w.id) || { total: 0, groups: [] }}
                        />
                    ))}
                </DashboardGrid>
                {showConfigurator && (
                    <WidgetConfiguratorModal
                        leads={periodLeadBuckets.current}
                        companyId={activeCompany?.id ?? null}
                        onSave={handleSaveCustomWidget}
                        onClose={() => { setShowConfigurator(false); setEditingWidget(null) }}
                        editWidget={editingWidget}
                    />
                )}
            </div>
            </div>

            {/* Floating tool panels (Analyze, Ask AI). Mounted at the
                dashboard root so they position freely over the grid and
                survive scroll. */}
            {tools.Panels}
        </div>
    )
}
