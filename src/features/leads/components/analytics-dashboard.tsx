"use client"

import { useMemo, useState, useEffect, useRef } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Lead, PipelineStage } from "@/types"
import { buildDashboardStageSeries } from "@/features/leads/lib/dashboard-stage-series"
import { splitDashboardLeadsByPeriod } from "@/features/leads/lib/dashboard-period"
import { Briefcase, Trophy, CheckSquare, RefreshCw, TrendingUp, Calendar } from "lucide-react"
import { ACCENT, MONTHS_SHORT, formatCur, getVsLastYearPct } from "./dashboard-widgets/shared"
import { WIDGET_IDS } from "@/features/leads/lib/dashboard-layout"
import { DashboardGrid } from "./dashboard-grid"
import {
    SingleKPIWidget,
    RevenueChartWidget,
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
}

export function AnalyticsDashboard({ leads, pipelines = [], activePipelineId, pipelineStages = [] }: AnalyticsDashboardProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const currentYear = new Date().getFullYear()
    const [hasMounted, setHasMounted] = useState(false)
    const [periodStr, setPeriodStr] = useState("this_quarter")
    const [catToggle, setCatToggle] = useState<string>('category')
    const [streamToggle, setStreamToggle] = useState<string>('main_stream')
    const [trendYear, setTrendYear] = useState(currentYear)
    const [scrolled, setScrolled] = useState(false)
    const scrollRef = useRef<HTMLElement | null>(null)
    const periodLeadBuckets = useMemo(() => splitDashboardLeadsByPeriod(leads, periodStr as "this_month" | "this_quarter" | "this_year" | "all_time" | "custom"), [leads, periodStr])
    const stageComparisonLabel = useMemo(() => getStageComparisonLabel(periodStr), [periodStr])

    useEffect(() => { setHasMounted(true) }, [])

    // Scroll hysteresis
    const SCROLL_HIDE = 20
    const SCROLL_SHOW = 6

    useEffect(() => {
        const findScrollParent = (el: HTMLElement | null): HTMLElement | null => {
            while (el) {
                const { overflow, overflowY } = getComputedStyle(el)
                if (/(auto|scroll)/.test(overflow + overflowY)) return el
                el = el.parentElement
            }
            return null
        }
        const timer = setTimeout(() => {
            const header = document.getElementById("dashboard-sticky-header")
            if (!header) return
            const parent = findScrollParent(header)
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

    const availableYears = useMemo(() => {
        const years = new Set(leads.map(l => new Date(l.created_at).getFullYear()))
        years.add(currentYear)
        return Array.from(years).sort((a, b) => b - a)
    }, [leads, currentYear])

    // ─── STATS ──────────────────────────────────────────────────────
    const stats = useMemo(() => {
        let totalInquiry = leads.length
        let closedWonCount = 0
        let closedLostCount = 0
        let totalRevenue = 0

        leads.forEach(l => {
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

        return { totalInquiry, totalRevenue, winRate, conversionRate, avgSize }
    }, [leads])

    const MOCK_PCT = {
        inquiryYoy: 12.5, inquiryTgt: -4.2,
        revYoy: 24.8, revTgt: 5.0,
        winYoy: -2.1, winTgt: 1.5,
        convYoy: 4.4, convTgt: 8.0,
        avgYoy: 15.2, avgTgt: -1.2,
    }

    // ─── CHART DATA ─────────────────────────────────────────────────
    const monthlyRev = useMemo(() => {
        const data = MONTHS_SHORT.map(m => ({ month: m, actual: 0, target: 0, prevYear: 0, overUnder: 0, vsLastYear: null as number | null }))
        leads.forEach(l => {
            const stage = (l.pipeline_stage?.name || "").toLowerCase()
            const date = new Date(l.created_at)
            const y = date.getFullYear()
            const m = date.getMonth()
            if (stage.includes("won")) {
                const val = (l.actual_value ?? l.estimated_value ?? 0)
                if (y === trendYear) data[m].actual += val
                else if (y === trendYear - 1) data[m].prevYear += val
            }
        })
        data.forEach(d => {
            d.target = 150_000_000
            if (d.actual > 0) d.overUnder = ((d.actual - d.target) / d.target) * 100
            d.vsLastYear = getVsLastYearPct(d.actual, d.prevYear)
        })
        return data
    }, [leads, trendYear])

    const stageData = useMemo(() => {
        return buildDashboardStageSeries(pipelineStages, periodLeadBuckets.current, periodLeadBuckets.previous)
    }, [pipelineStages, periodLeadBuckets])

    const salesData = useMemo(() => {
        const reps: Record<string, { name: string, actual: number, target: number }> = {}
        leads.forEach(l => {
            const stage = (l.pipeline_stage?.name || "").toLowerCase()
            const pic = l.pic_sales_profile?.full_name || "Unassigned"
            if (!reps[pic]) reps[pic] = { name: pic, actual: 0, target: 0 }
            if (stage.includes("won")) reps[pic].actual += (l.actual_value ?? l.estimated_value ?? 0)
        })
        return Object.values(reps).map(r => ({
            ...r, target: r.actual > 0 ? (r.actual * (0.8 + Math.random() * 0.5)) : 50_000_000
        })).sort((a, b) => b.actual - a.actual).slice(0, 10)
    }, [leads])

    const topComps = useMemo(() => {
        const comps: Record<string, number> = {}
        leads.forEach(l => {
            const stage = (l.pipeline_stage?.name || "").toLowerCase()
            if (stage.includes("won")) {
                const c = l.client_company?.name || "Unknown Company"
                comps[c] = (comps[c] || 0) + (l.actual_value ?? l.estimated_value ?? 0)
            }
        })
        return Object.entries(comps).map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue).slice(0, 10)
    }, [leads])

    const sourceData = useMemo(() => {
        const m: Record<string, number> = {}
        leads.forEach(l => { m[l.lead_source || "Unspecified"] = (m[l.lead_source || "Unspecified"] || 0) + 1 })
        return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
    }, [leads])

    const catGradeData = useMemo(() => {
        const m: Record<string, number> = {}
        leads.forEach(l => { const val = (l as any)[catToggle] as string || "Unspecified"; m[val] = (m[val] || 0) + 1 })
        return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
    }, [leads, catToggle])

    const streamData = useMemo(() => {
        const m: Record<string, number> = {}
        leads.forEach(l => { const val = (l as any)[streamToggle] as string || "Unspecified"; m[val] = (m[val] || 0) + 1 })
        return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
    }, [leads, streamToggle])

    // ─── KPI DEFINITIONS ────────────────────────────────────────────
    const kpis = [
        { label: "Total Leads", value: String(stats.totalInquiry), vsTarget: MOCK_PCT.inquiryTgt, vsPrev: MOCK_PCT.inquiryYoy, accent: ACCENT.leads, icon: Briefcase },
        { label: "Won Revenue", value: formatCur(stats.totalRevenue).replace("Rp ", ""), prefix: "Rp ", vsTarget: MOCK_PCT.revTgt, vsPrev: MOCK_PCT.revYoy, accent: ACCENT.revenue, icon: Trophy },
        { label: "Deal Win Rate", value: stats.winRate.toFixed(1), suffix: "%", vsTarget: MOCK_PCT.winTgt, vsPrev: MOCK_PCT.winYoy, accent: ACCENT.winrate, icon: CheckSquare },
        { label: "Lead Conversion", value: stats.conversionRate.toFixed(1), suffix: "%", vsTarget: MOCK_PCT.convTgt, vsPrev: MOCK_PCT.convYoy, accent: ACCENT.conversion, icon: RefreshCw },
        { label: "Avg Deal Size", value: formatCur(stats.avgSize).replace("Rp ", ""), prefix: "Rp ", vsTarget: MOCK_PCT.avgTgt, vsPrev: MOCK_PCT.avgYoy, accent: ACCENT.dealsize, icon: TrendingUp },
    ]

    return (
        <>
            {/* ─── STICKY HEADER ─── */}
            <div
                id="dashboard-sticky-header"
                style={{
                    position: "sticky", top: 0, zIndex: 20,
                    height: 64,
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "0 24px",
                    background: scrolled ? "rgba(242,243,246,.88)" : "#f2f3f6",
                    backdropFilter: scrolled ? "blur(14px)" : "none",
                    WebkitBackdropFilter: scrolled ? "blur(14px)" : "none",
                    borderBottom: `1px solid ${scrolled ? "#dfe2e7" : "transparent"}`,
                    transition: "background .3s ease, border-color .3s ease, backdrop-filter .3s ease",
                }}
            >
                <div style={{ position: "relative" }}>
                    <h1 style={{
                        fontSize: scrolled ? 15 : 19, fontWeight: 800, color: "#0f1729",
                        letterSpacing: "-0.3px", lineHeight: 1.3, margin: 0,
                        transition: "font-size .3s ease",
                    }}>
                        Performance Dashboard
                    </h1>
                    <p style={{
                        fontSize: 11.5, color: "#8892a4", marginTop: 1, margin: 0,
                        opacity: scrolled ? 0 : 1,
                        transform: scrolled ? "translateY(-4px)" : "translateY(0)",
                        transition: "opacity .3s ease, transform .3s ease",
                        position: "absolute", left: 0, top: "100%",
                        whiteSpace: "nowrap",
                        pointerEvents: scrolled ? "none" : "auto",
                    }}>Strategic sales & pipeline analytics</p>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ fontSize: 10, color: "#94a3b8", textAlign: "right" as const, lineHeight: 1.4 }}>
                        <div style={{ fontWeight: 600, color: "#5a6178", fontSize: 10.5 }}>Subsidiary</div>
                        <div>All Companies</div>
                    </div>
                    <select value={periodStr} onChange={e => setPeriodStr(e.target.value)} style={{
                        appearance: "none" as const, background: "#fff", border: "1px solid #dfe2e7", borderRadius: 7,
                        padding: "6px 28px 6px 10px", fontSize: 11.5, fontWeight: 600, color: "#0f1729",
                        cursor: "pointer", fontFamily: "inherit",
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='9' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                        backgroundRepeat: "no-repeat", backgroundPosition: "right 7px center",
                        boxShadow: "0 1px 2px rgba(0,0,0,.03)",
                    }}>
                        <option value="this_month">This Month</option>
                        <option value="this_quarter">This Quarter</option>
                        <option value="this_year">This Year</option>
                        <option value="all_time">All Time</option>
                        <option value="custom">Custom Range...</option>
                    </select>
                    {periodStr === "custom" && (
                        <button style={{
                            display: "flex", alignItems: "center", gap: 4, background: "#fff", border: "1px solid #dfe2e7",
                            borderRadius: 7, padding: "5px 10px", fontSize: 11, fontWeight: 600, color: "#0f1729",
                            cursor: "pointer", fontFamily: "inherit", boxShadow: "0 1px 2px rgba(0,0,0,.03)",
                        }}>
                            <Calendar style={{ width: 12, height: 12 }} /> Select Dates
                        </button>
                    )}
                    {/* ─── Grid Edit Controls (portaled by DashboardGrid) ─── */}
                    <div id="dashboard-edit-controls" style={{ display: "flex", alignItems: "center", borderLeft: "1px solid #e0e4ec", paddingLeft: 8, marginLeft: 2 }} />
                </div>
            </div>

            {/* ─── CONTENT WITH GRID ─── */}
            <div style={{ padding: "6px 24px 24px", background: "#f2f3f6", minHeight: "100%", overflowX: "clip", overflowY: "visible", boxSizing: "border-box", width: "100%", minWidth: 0 }}>
                <DashboardGrid widgetIds={[...WIDGET_IDS]}>
                    {/* Order MUST match WIDGET_IDS array */}
                    {/* 5 individual KPI cards */}
                    <SingleKPIWidget {...kpis[0]} />
                    <SingleKPIWidget {...kpis[1]} />
                    <SingleKPIWidget {...kpis[2]} />
                    <SingleKPIWidget {...kpis[3]} />
                    <SingleKPIWidget {...kpis[4]} />
                    {/* Chart widgets */}
                    <RevenueChartWidget
                        data={monthlyRev}
                        trendYear={trendYear}
                        setTrendYear={setTrendYear}
                        availableYears={availableYears}
                        hasMounted={hasMounted}
                    />
                    <PipelineWidget data={stageData} comparisonLabel={stageComparisonLabel} />
                    <SalesPerfWidget data={salesData} />
                    <TopRevenueWidget data={topComps} />
                    <LeadSourceWidget data={sourceData} />
                    <ClassificationWidget data={catGradeData} catToggle={catToggle} setCatToggle={setCatToggle} />
                    <StreamWidget data={streamData} streamToggle={streamToggle} setStreamToggle={setStreamToggle} />
                    {/* Goal widgets */}
                    <GoalAttainmentWidget />
                    <GoalForecastWidget />
                    <GoalVarianceWidget />
                    <GoalCompanyBreakdownWidget />
                    <GoalSegmentBreakdownWidget />
                    <GoalTrendWidget />
                </DashboardGrid>
            </div>
        </>
    )
}
