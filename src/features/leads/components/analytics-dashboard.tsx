"use client"

import { useMemo, useState, useEffect, useRef, useCallback } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Lead, PipelineStage } from "@/types"
import type { GoalV2, GoalNode, GoalUserTarget, GoalSettingsV2 } from "@/types/goals"
import { GoalDataProvider } from "@/features/goals/contexts/goal-data-context"
import { EmptyState } from "@/components/shared/empty-state"
import { buildDashboardStageSeries } from "@/features/leads/lib/dashboard-stage-series"
import { splitDashboardLeadsByPeriod, getRevenueDate } from "@/features/leads/lib/dashboard-period"
import { Briefcase, Trophy, CheckSquare, RefreshCw, TrendingUp, Calendar, Layers } from "lucide-react"
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
    GoalForecastWidget,
    GoalVarianceWidget,
    GoalCompanyBreakdownWidget,
    GoalSegmentBreakdownWidget,
    GoalTrendWidget,
} from "./dashboard-widgets"
import { ContactAnalyticsWidget } from "@/features/contacts/components/dashboard"
import type { CustomWidget } from "@/types/custom-widget"
import { aggregateLeads } from "@/features/leads/lib/aggregate-leads"
import { CustomWidgetRenderer } from "./dashboard-widgets/custom-widget-renderer"
import { WidgetConfiguratorModal } from "./dashboard-widgets/widget-configurator-modal"
import { DashboardAIToolbar } from "./dashboard-widgets/dashboard-ai-toolbar"
import type { CustomWidgetInput } from "@/types/custom-widget"
import { createClient } from "@/utils/supabase/client"
import { useCompany } from "@/contexts/company-context"
import { resolveLeadField, resolveCompanyName } from "@/lib/resolve-lead-field"
import { useDashboardViews } from "@/features/leads/hooks/use-dashboard-views"
import { DashboardViewSwitcher } from "./dashboard-view-switcher"
import type { DashboardFiltersSnapshot } from "@/types/dashboard-view"
import type { LayoutItem } from "react-grid-layout"
import type { WidgetId } from "@/features/leads/lib/dashboard-layout"

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
    const [trendYear, setTrendYear] = useState(currentYear)
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
        trendYear,
    }), [periodStr, customStart, customEnd, companyFilter, revenueBasis, catToggle, streamToggle, trendYear])

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
        if (typeof f.trendYear === "number") setTrendYear(f.trendYear)
    }, [views.activeView])

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
                (a.trendYear ?? 0) === (b.trendYear ?? 0)
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
        if (!isHoldingView || companyFilter === "all") return leads
        return leads.filter(l => l.company_id === companyFilter)
    }, [leads, isHoldingView, companyFilter])

    const periodLeadBuckets = useMemo(() => splitDashboardLeadsByPeriod(
        filteredLeads,
        periodStr as "this_month" | "this_quarter" | "this_year" | "all_time" | "custom",
        new Date(),
        periodStr === "custom" && customStart && customEnd ? { start: customStart, end: customEnd } : undefined
    ), [filteredLeads, periodStr, customStart, customEnd])
    const periodLeads = periodLeadBuckets.current
    const previousPeriodLeads = periodLeadBuckets.previous
    const stageComparisonLabel = useMemo(() => getStageComparisonLabel(periodStr), [periodStr])

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

    const availableYears = useMemo(() => {
        const years = new Set<number>()
        leads.forEach(l => {
            const d = getRevenueDate(l)
            if (d) years.add(d.getFullYear())
        })
        years.add(currentYear)
        return Array.from(years).sort((a, b) => b - a)
    }, [leads, currentYear])

    // ─── STATS (period-filtered) ───────────────────────────────────
    const stats = useMemo(() => {
        let totalInquiry = periodLeads.length
        let closedWonCount = 0
        let closedLostCount = 0
        let totalRevenue = 0

        periodLeads.forEach(l => {
            const stage = (l.pipeline_stage?.name || "").toLowerCase()
            const val = l.estimated_value ?? 0
            if (stage.includes("won")) {
                closedWonCount++
                totalRevenue += (l.actual_value ?? val)
            } else if (stage.includes("lost") || stage.includes("cancel")) {
                closedLostCount++
            }
        })

        const totalClosed = closedWonCount + closedLostCount
        const winRate = totalClosed > 0 ? (closedWonCount / totalClosed) * 100 : 0
        const conversionRate = totalInquiry > 0 ? (closedWonCount / totalInquiry) * 100 : 0
        const avgSize = closedWonCount > 0 ? totalRevenue / closedWonCount : 0

        // Pipeline value: estimated value of leads in active (non-closed) stages
        let pipelineValue = 0
        periodLeads.forEach(l => {
            const stage = (l.pipeline_stage?.name || "").toLowerCase()
            if (!stage.includes("won") && !stage.includes("lost") && !stage.includes("cancel") && !stage.includes("turndown") && !stage.includes("postponed")) {
                pipelineValue += (l.estimated_value ?? 0)
            }
        })

        return { totalInquiry, totalRevenue, winRate, conversionRate, avgSize, closedWonCount, pipelineValue }
    }, [periodLeads])

    // ─── PERIOD COMPARISON METRICS ──────────────────────────────────
    // Compares current period vs same period last year (from periodLeadBuckets)
    const goalMetrics = useMemo(() => {
        // Helper to calculate stats for a lead set
        const calculateStats = (leadSet: Lead[]) => {
            let totalInquiry = leadSet.length
            let closedWonCount = 0
            let closedLostCount = 0
            let totalRevenue = 0

            leadSet.forEach(l => {
                const stage = (l.pipeline_stage?.name || "").toLowerCase()
                if (stage.includes("won")) {
                    closedWonCount++
                    totalRevenue += (l.actual_value ?? l.estimated_value ?? 0)
                } else if (stage.includes("lost") || stage.includes("cancel")) {
                    closedLostCount++
                }
            })

            const totalClosed = closedWonCount + closedLostCount
            const winRate = totalClosed > 0 ? (closedWonCount / totalClosed) * 100 : 0
            const conversionRate = totalInquiry > 0 ? (closedWonCount / totalInquiry) * 100 : 0
            const avgSize = closedWonCount > 0 ? totalRevenue / closedWonCount : 0

            return { totalInquiry, totalRevenue, winRate, conversionRate, avgSize, closedWonCount }
        }

        const currentStats = calculateStats(periodLeads)
        const prevStats = calculateStats(previousPeriodLeads)

        // Calculate vs previous period percentages
        const calculateVsPrev = (current: number, previous: number) => {
            if (previous === 0) return null
            return ((current - previous) / previous) * 100
        }

        const inquiryYoy = calculateVsPrev(currentStats.totalInquiry, prevStats.totalInquiry)
        const revYoy = calculateVsPrev(currentStats.totalRevenue, prevStats.totalRevenue)
        const winYoy = calculateVsPrev(currentStats.winRate, prevStats.winRate)
        const convYoy = calculateVsPrev(currentStats.conversionRate, prevStats.conversionRate)
        const avgYoy = calculateVsPrev(currentStats.avgSize, prevStats.avgSize)

        // Calculate vs target percentages
        const revenueTarget = activeGoal?.target_amount || 0
        const revenuePctVsTarget = revenueTarget > 0
            ? ((stats.totalRevenue - revenueTarget) / revenueTarget) * 100
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
                ? currentStats.conversionRate - goalSettings.conversion_target_pct
                : null,
            avgYoy,
            avgTgt: null, // No target for avg deal size yet
        }
    }, [activeGoal, goalSettings, stats.totalRevenue, periodLeads, previousPeriodLeads])

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
                if (y === trendYear) data[m].actual += val
                else if (y === trendYear - 1) data[m].prevYear += val
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
    }, [filteredLeads, trendYear, activeGoal, goalNodes, revenueBasis])

    const stageData = useMemo(() => {
        return buildDashboardStageSeries(pipelineStages, periodLeadBuckets.current, periodLeadBuckets.previous)
    }, [pipelineStages, periodLeadBuckets])

    const salesData = useMemo(() => {
        const reps: Record<string, { name: string, actual: number, target: number, userId?: string, hasRealTarget: boolean }> = {}

        // Calculate actual revenue per sales rep from won deals in selected period
        periodLeads.forEach(l => {
            const stage = (l.pipeline_stage?.name || "").toLowerCase()
            const pic = l.pic_sales_profile?.full_name || "Unassigned"
            const picId = l.pic_sales_id || "unassigned"
            if (!reps[picId]) reps[picId] = { name: pic, actual: 0, target: 0, userId: picId, hasRealTarget: false }
            if (stage.includes("won")) {
                reps[picId].actual += (l.actual_value ?? l.estimated_value ?? 0)
            }
        })

        // Apply real targets from userTargets if available
        if (userTargets && userTargets.length > 0) {
            userTargets.forEach(ut => {
                if (reps[ut.user_id]) {
                    reps[ut.user_id].target = ut.target_amount
                    reps[ut.user_id].hasRealTarget = true
                }
            })
        }

        // Fallback: apply targets from goal_nodes (pic_sales_id nodes)
        if (goalNodes && goalNodes.length > 0) {
            goalNodes.forEach(node => {
                if (node.reference_field === "pic_sales_id" && node.reference_value && node.target_amount > 0) {
                    const userId = node.reference_value
                    if (reps[userId] && !reps[userId].hasRealTarget) {
                        reps[userId].target = node.target_amount
                        reps[userId].hasRealTarget = true
                    }
                }
            })
        }

        // Fallback: apply targets from breakdown_config (sales_owner dimension)
        if (activeGoal?.breakdown_config && Array.isArray(activeGoal.breakdown_config)) {
            for (const level of activeGoal.breakdown_config as any[]) {
                if (level.dimension === "sales_owner" && Array.isArray(level.nodes)) {
                    const totalTarget = activeGoal.target_amount || 0
                    level.nodes.forEach((node: any) => {
                        // Match node name to rep name
                        const matchedRep = Object.values(reps).find(
                            r => r.name === node.name && !r.hasRealTarget
                        )
                        if (matchedRep) {
                            const nodeTarget = node.value > 0 ? node.value : totalTarget * (node.pct || 0) / 100
                            if (nodeTarget > 0) {
                                matchedRep.target = nodeTarget
                                matchedRep.hasRealTarget = true
                            }
                        }
                    })

                    // Also check perParentNodes for customize-per-parent mode
                    if (level.perParentNodes && typeof level.perParentNodes === 'object') {
                        Object.values(level.perParentNodes).forEach((parentNodes: any) => {
                            if (!Array.isArray(parentNodes)) return
                            parentNodes.forEach((node: any) => {
                                const matchedRep = Object.values(reps).find(
                                    r => r.name === node.name && !r.hasRealTarget
                                )
                                if (matchedRep) {
                                    const nodeTarget = node.value > 0 ? node.value : totalTarget * (node.pct || 0) / 100
                                    if (nodeTarget > 0) {
                                        matchedRep.target = nodeTarget
                                        matchedRep.hasRealTarget = true
                                    }
                                }
                            })
                        })
                    }
                }
            }
        }

        // Filter out unassigned and sort by actual revenue
        return Object.values(reps)
            .filter(r => r.userId !== "unassigned") // Remove unassigned
            .sort((a, b) => b.actual - a.actual)
            .slice(0, 15)
    }, [periodLeads, userTargets, goalNodes, activeGoal])

    const topComps = useMemo(() => {
        const comps: Record<string, number> = {}
        periodLeads.forEach(l => {
            const stage = (l.pipeline_stage?.name || "").toLowerCase()
            if (stage.includes("won")) {
                const c = resolveCompanyName(l) || "Unknown Company"
                comps[c] = (comps[c] || 0) + (l.actual_value ?? l.estimated_value ?? 0)
            }
        })
        return Object.entries(comps).map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue).slice(0, 10)
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
    const kpis = [
        {
            label: "Total Leads",
            value: String(stats.totalInquiry),
            vsTarget: goalMetrics.inquiryTgt,
            vsPrev: goalMetrics.inquiryYoy,
            accent: ACCENT.leads,
            icon: Briefcase,
            tooltip: "Total number of leads in the system",
            sparkline: sparklines.leads,
        },
        {
            label: "Won Revenue",
            value: fmtAxis(stats.totalRevenue),
            vsTarget: goalMetrics.revTgt,
            vsPrev: goalMetrics.revYoy,
            accent: ACCENT.revenue,
            icon: Trophy,
            tooltip: `Total revenue from closed won deals: ${fmt(stats.totalRevenue)}`,
            sparkline: sparklines.revenue,
        },
        {
            label: "Deal Win Rate",
            value: stats.winRate.toFixed(1),
            suffix: "%",
            vsTarget: goalMetrics.winTgt,
            vsPrev: goalMetrics.winYoy,
            accent: ACCENT.winrate,
            icon: CheckSquare,
            tooltip: "Percentage of closed deals that were won (won / total closed)",
            sparkline: sparklines.winRate,
        },
        {
            label: "Lead Conversion",
            value: stats.conversionRate.toFixed(1),
            suffix: "%",
            vsTarget: goalMetrics.convTgt,
            vsPrev: goalMetrics.convYoy,
            accent: ACCENT.conversion,
            icon: RefreshCw,
            tooltip: goalSettings?.conversion_target_pct
                ? `Lead-to-deal conversion rate. Target: ${goalSettings.conversion_target_pct}% · Actual: ${stats.conversionRate.toFixed(1)}% · Gap: ${(stats.conversionRate - goalSettings.conversion_target_pct) > 0 ? "+" : ""}${(stats.conversionRate - goalSettings.conversion_target_pct).toFixed(1)} pts`
                : "Percentage of leads that converted to won deals",
            sparkline: sparklines.conversion,
        },
        {
            label: "Avg Deal Size",
            value: fmtAxis(stats.avgSize),
            vsTarget: goalMetrics.avgTgt,
            vsPrev: goalMetrics.avgYoy,
            accent: ACCENT.dealsize,
            icon: TrendingUp,
            tooltip: `Average revenue per won deal: ${fmt(stats.avgSize)}`,
            sparkline: sparklines.avgDeal,
        },
        {
            label: "Pipeline Value",
            value: fmtAxis(stats.pipelineValue),
            vsTarget: null,
            vsPrev: null,
            accent: "#00A1E9",
            icon: Layers,
            tooltip: `Total estimated value of leads in active stages: ${fmt(stats.pipelineValue)}`,
            sparkline: sparklines.pipeline,
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

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
            {/* ─── FIXED HEADER (outside scroll) ─── */}
            <div
                id="dashboard-sticky-header"
                style={{
                    flexShrink: 0, zIndex: 20,
                    height: 56,
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "0 24px",
                    background: "#fff",
                    borderBottom: "1px solid #f0f0f0",
                }}
            >
                {/* Left: Title + subtitle */}
                <div style={{ position: "relative", minWidth: 0, flexShrink: 1, overflow: "hidden" }}>
                    <h1 style={{
                        fontSize: 16, fontWeight: 700, color: "#292D30",
                        letterSpacing: "-0.3px", lineHeight: 1.2, margin: 0,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                        Performance Dashboard
                    </h1>
                    <p style={{
                        fontSize: 11, color: "#94a3b8", margin: 0, marginTop: 1,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        opacity: scrolled ? 0 : 1,
                        maxHeight: scrolled ? 0 : 16,
                        transition: "opacity .2s ease, max-height .2s ease",
                        pointerEvents: scrolled ? "none" : "auto",
                    }}>
                        Real-time sales analytics &amp; goal tracking
                    </p>
                </div>

                {/* Right: Filters + Edit */}
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                    {/* Company filter (holding view only) */}
                    {isHoldingView && companies.length > 1 && (
                        <select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)} style={{
                            appearance: "none" as const, backgroundColor: companyFilter !== "all" ? "#EEF2FF" : "#f8f9fb",
                            border: companyFilter !== "all" ? "1px solid #C7D2FE" : "1px solid transparent", borderRadius: 6,
                            padding: "6px 28px 6px 10px", fontSize: 12, fontWeight: 600,
                            color: companyFilter !== "all" ? "#02378D" : "#292D30",
                            cursor: "pointer", fontFamily: "inherit",
                            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                            backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center",
                            transition: "all .15s ease",
                        }}>
                            <option value="all">All Companies</option>
                            {companies.filter(c => !c.isHolding).map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    )}

                    {/* Period selector */}
                    <select value={periodStr} onChange={e => setPeriodStr(e.target.value)} style={{
                        appearance: "none" as const, backgroundColor: "#f8f9fb", border: "1px solid transparent", borderRadius: 6,
                        padding: "6px 28px 6px 10px", fontSize: 12, fontWeight: 600, color: "#292D30",
                        cursor: "pointer", fontFamily: "inherit",
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                        backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center",
                        transition: "all .15s ease",
                    }}>
                        <option value="this_month">This Month</option>
                        <option value="this_quarter">This Quarter</option>
                        <option value="this_year">This Year</option>
                        <option value="all_time">All Time</option>
                        <option value="custom">Custom Range</option>
                    </select>

                    {/* Custom date inputs */}
                    {isCustomPeriod && (
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <input
                                type="date"
                                value={customStart}
                                onChange={e => setCustomStart(e.target.value)}
                                style={{
                                    background: "#f8f9fb", border: "1px solid transparent", borderRadius: 6,
                                    padding: "5px 8px", fontSize: 11, fontWeight: 500, color: "#292D30",
                                    fontFamily: "inherit",
                                }}
                            />
                            <span style={{ fontSize: 9, color: "#94a3b8", fontWeight: 500 }}>—</span>
                            <input
                                type="date"
                                value={customEnd}
                                onChange={e => setCustomEnd(e.target.value)}
                                style={{
                                    background: "#f8f9fb", border: "1px solid transparent", borderRadius: 6,
                                    padding: "5px 8px", fontSize: 11, fontWeight: 500, color: "#292D30",
                                    fontFamily: "inherit",
                                }}
                            />
                        </div>
                    )}

                    {/* Clear filter */}
                    {!isDefaultPeriod && (
                        <button
                            onClick={handleResetPeriod}
                            style={{
                                background: "none", border: "none", cursor: "pointer",
                                fontSize: 10, fontWeight: 600, color: "#94a3b8",
                                padding: "4px 6px", borderRadius: 4, fontFamily: "inherit",
                                transition: "color .15s ease",
                            }}
                            onMouseEnter={e => (e.currentTarget.style.color = "#292D30")}
                            onMouseLeave={e => (e.currentTarget.style.color = "#94a3b8")}
                        >
                            Reset
                        </button>
                    )}

                    {/* AI Toolbar */}
                    <div style={{ borderLeft: "1px solid #f0f0f0", paddingLeft: 8, marginLeft: 2 }}>
                        <DashboardAIToolbar dashboardData={aiContextData} />
                    </div>

                    {/* Saved-view switcher — always rendered in header (independent of grid load state). */}
                    <div style={{ display: "flex", alignItems: "center", borderLeft: "1px solid #f0f0f0", paddingLeft: 8, marginLeft: 2 }}>
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
                    </div>

                    {/* Separator + Edit controls */}
                    <div id="dashboard-edit-controls" style={{ display: "flex", alignItems: "center", borderLeft: "1px solid #f0f0f0", paddingLeft: 8, marginLeft: 2 }} />
                </div>
            </div>

            {/* ─── SCROLLABLE CONTENT (scrollbar starts below header) ─── */}
            <div id="dashboard-scroll-area" className="thin-scrollbar" style={{ flex: 1, overflowY: "auto", overflowX: "clip" }}>
            <div id="dashboard-content" style={{ padding: "20px 24px 24px", background: "#eaeff5", minHeight: "100%", overflowX: "clip", overflowY: "visible", boxSizing: "border-box", width: "100%", minWidth: 0 }}>
                <DashboardGrid
                    widgetIds={[...WIDGET_IDS]}
                    customWidgets={customWidgetsList}
                    onCreateCustomWidget={() => { setEditingWidget(null); setShowConfigurator(true) }}
                    onEditCustomWidget={(w) => { setEditingWidget(w); setShowConfigurator(true) }}
                    onDeleteCustomWidget={handleDeleteCustomWidget}
                    initialLayout={views.activeView?.layout_data ?? []}
                    initialHiddenWidgets={views.activeView?.hidden_widgets ?? []}
                    viewKey={views.activeView?.id ?? "none"}
                    onPersistLayout={handlePersistLayout}
                    onEditModeChange={setIsDashboardEditing}
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
                        trendYear={trendYear}
                        setTrendYear={setTrendYear}
                        availableYears={availableYears}
                        hasMounted={hasMounted}
                        revenueBasis={revenueBasis}
                        setRevenueBasis={setRevenueBasis}
                    />
                    <PipelineWidget data={stageData} comparisonLabel={stageComparisonLabel} />
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
                      {activeGoal ? <GoalForecastWidget /> : <div><EmptyState icon={TrendingUp} title="No active goal configured" description="Set up goals in settings" size="sm" /></div>}
                    </GoalDataProvider>
                    <GoalDataProvider value={goalProviderValue}>
                      {activeGoal ? <GoalVarianceWidget /> : <div><EmptyState icon={TrendingUp} title="No active goal configured" description="Set up goals in settings" size="sm" /></div>}
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
        </div>
    )
}
