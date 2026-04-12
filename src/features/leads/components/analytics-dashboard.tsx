"use client"

import { useMemo, useState, useEffect, useRef, CSSProperties } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Lead } from "@/types"
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
    ResponsiveContainer, Cell, PieChart, Pie, Legend, ComposedChart, Line, LabelList
} from "recharts"
import {
    Briefcase, Target, TrendingUp, Trophy, ArrowDownRight, ArrowUpRight,
    BarChart3, Activity, CheckSquare, RefreshCw, Handshake, Calendar
} from "lucide-react"

// ─── DESIGN TOKENS (from reference spec) ────────────────────────────────────
const ACCENT = {
    leads: "#6366f1",
    revenue: "#0ea5e9",
    winrate: "#10b981",
    conversion: "#8b5cf6",
    dealsize: "#f59e0b",
}
const PIPELINE_COLORS: Record<string, string> = {
    "New Lead": "#6366f1", "Qualified": "#8b5cf6", "Proposal Sent": "#f59e0b",
    "Negotiation": "#0ea5e9", "Closed Won": "#10b981", "Closed Lost": "#ef4444",
}
const CHART_COLORS = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#0ea5e9', '#14b8a6', '#f43f5e', '#06b6d4']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatCur(amount: number): string {
    if (amount >= 1_000_000_000) return `Rp ${(amount / 1_000_000_000).toFixed(1)}B`
    if (amount >= 1_000_000) return `Rp ${(amount / 1_000_000).toFixed(0)}M`
    if (amount >= 1_000) return `Rp ${(amount / 1_000).toFixed(0)}K`
    return `Rp ${amount.toLocaleString()}`
}

// ─── BADGE COMPONENT ────────────────────────────────────────────────────────
function Badge({ value, label }: { value: number; label: string }) {
    const pos = value >= 0
    return (
        <span style={{
            display: "inline-flex", alignItems: "center", gap: 2,
            fontSize: 10, fontWeight: 600, color: pos ? "#10b981" : "#ef4444",
            background: pos ? "rgba(16,185,129,.07)" : "rgba(239,68,68,.07)",
            padding: "1px 5px", borderRadius: 4, lineHeight: 1.5,
        }}>
            <span style={{ fontSize: 7 }}>{pos ? "▲" : "▼"}</span>
            {Math.abs(value).toFixed(1)}% {label}
        </span>
    )
}

// ─── KPI CARD ───────────────────────────────────────────────────────────────
interface KPICardProps {
    label: string; value: string; prefix?: string; suffix?: string
    vsTarget: number; vsPrev: number; accent: string
    icon: React.ComponentType<any>; delay: number
}

function KPICard({ label, value, prefix = "", suffix = "", vsTarget, vsPrev, accent, icon: Icon, delay }: KPICardProps) {
    const [vis, setVis] = useState(false)
    const [hov, setHov] = useState(false)
    useEffect(() => { const t = setTimeout(() => setVis(true), delay); return () => clearTimeout(t) }, [delay])

    return (
        <div
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                background: "#fff", borderRadius: 10,
                padding: "12px 14px 10px",
                border: `1px solid ${hov ? accent + "35" : "#e5e8ed"}`,
                opacity: vis ? 1 : 0,
                transform: vis ? (hov ? "translateY(-2px)" : "translateY(0)") : "translateY(8px)",
                transition: "all .25s ease",
                display: "flex", flexDirection: "column" as const, gap: 4, minWidth: 0,
                position: "relative" as const, overflow: "hidden", cursor: "default",
                boxShadow: hov
                    ? `0 6px 20px ${accent}10, 0 1px 4px rgba(0,0,0,.04)`
                    : "0 1px 2px rgba(0,0,0,.03)",
            }}
        >
            {/* Accent top bar */}
            <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 2.5,
                background: `linear-gradient(90deg, ${accent}, ${accent}66)`,
                opacity: hov ? 1 : 0.5, transition: "opacity .2s",
            }} />

            {/* Label + icon */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: "#8892a4", letterSpacing: ".15px" }}>{label}</span>
                <span style={{
                    width: 22, height: 22, borderRadius: 6,
                    background: accent + "0c",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: accent, flexShrink: 0,
                }}>
                    <Icon style={{ width: 12, height: 12 }} strokeWidth={2.5} />
                </span>
            </div>

            {/* Value */}
            <div style={{
                fontSize: 26, fontWeight: 800, color: "#0f1729",
                letterSpacing: "-0.7px", lineHeight: 1,
            }}>
                {prefix}{value}{suffix}
            </div>

            {/* Badges */}
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap" as const, marginTop: 2 }}>
                <Badge value={vsTarget} label="target" />
                <Badge value={vsPrev} label="YoY" />
            </div>
        </div>
    )
}

// ─── PIPELINE STAGES (progress bar style from reference) ────────────────────
function PipelineStages({ data }: { data: { name: string; count: number }[] }) {
    const [hovIdx, setHovIdx] = useState<number | null>(null)
    const maxCount = Math.max(...data.map(d => d.count), 1)

    // Sort in funnel order, ensuring all funnel stages exist even if count is 0
    const funnelOrder = ["New Lead", "Qualified", "Proposal Sent", "Negotiation", "Closed Won", "Closed Lost"]
    const sorted = [
        ...funnelOrder.map(name => ({ name, count: data.find(d => d.name === name)?.count || 0 })),
        ...data.filter(d => !funnelOrder.includes(d.name))
    ]

    return (
        <div style={{
            background: "#fff", borderRadius: 10, padding: 16,
            border: "1px solid #e5e8ed", boxShadow: "0 1px 2px rgba(0,0,0,.03)",
            height: "100%",
        }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0f1729", marginBottom: 1 }}>Pipeline Stages</div>
            <div style={{ fontSize: 10.5, color: "#8892a4", marginBottom: 14 }}>Lead distribution by stage</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {sorted.map((p, i) => {
                    const color = PIPELINE_COLORS[p.name] || CHART_COLORS[i % CHART_COLORS.length]
                    return (
                        <div key={p.name}
                            onMouseEnter={() => setHovIdx(i)} onMouseLeave={() => setHovIdx(null)}
                            style={{ cursor: "default" }}
                        >
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                                <span style={{ fontSize: 11, fontWeight: 500, color: hovIdx === i ? "#0f1729" : "#5a6178", transition: "color .12s" }}>{p.name}</span>
                                <span style={{
                                    fontSize: 10, fontWeight: 700, color: "#fff",
                                    background: hovIdx === i ? color : "#bcc3d0",
                                    padding: "0 5px", borderRadius: 3, minWidth: 20, textAlign: "center" as const,
                                    transition: "background .12s", lineHeight: "16px",
                                }}>{p.count}</span>
                            </div>
                            <div style={{ height: 5, background: "#f1f3f5", borderRadius: 3, overflow: "hidden" }}>
                                <div style={{
                                    height: "100%", width: `${(p.count / maxCount) * 100}%`,
                                    background: `linear-gradient(90deg, ${color}, ${color}bb)`,
                                    borderRadius: 3, transition: "width .45s ease",
                                }} />
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// ─── SECTION CARD ────────────────────────────────────────────────────────────
function SectionCard({ children, span, style }: { children: React.ReactNode; span?: number; style?: CSSProperties }) {
    return (
        <div style={{
            background: "#fff", borderRadius: 10, padding: "14px 16px 12px",
            border: "1px solid #e5e8ed", boxShadow: "0 1px 2px rgba(0,0,0,.03)",
            ...(span ? { gridColumn: `span ${span}` } : {}),
            ...style,
        }}>
            {children}
        </div>
    )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
    return <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0f1729", marginBottom: 1 }}>{children}</div>
}
function SectionSub({ children }: { children: React.ReactNode }) {
    return <div style={{ fontSize: 10.5, color: "#8892a4", marginBottom: 12 }}>{children}</div>
}

// ─── INSIGHT CALLOUT ─────────────────────────────────────────────────────────
function InsightCallout({ icon, text }: { icon: string; text: string }) {
    return (
        <div style={{
            marginTop: 10, paddingTop: 8, borderLeft: "2px solid #6366f1",
            paddingLeft: 8, fontSize: 10, fontStyle: "italic", color: "#8892a4",
            lineHeight: 1.5,
        }}>
            {icon} {text}
        </div>
    )
}

// ─── CUSTOM TOOLTIP ─────────────────────────────────────────────────────────
function DarkTooltip({ active, payload, label }: any) {
    if (!active || !payload) return null
    return (
        <div style={{
            background: "#0f1729", color: "#fff", padding: "6px 9px", borderRadius: 6,
            fontSize: 9.5, lineHeight: 1.6, boxShadow: "0 3px 12px rgba(0,0,0,.2)",
        }}>
            <div style={{ fontWeight: 700, marginBottom: 1 }}>{label}</div>
            {payload.map((p: any, i: number) => (
                <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <div style={{ width: 6, height: 6, borderRadius: 2, background: p.color, flexShrink: 0 }} />
                    <span>{p.name}: {typeof p.value === 'number' && p.name !== 'Count' ? formatCur(p.value) : p.value}</span>
                </div>
            ))}
            {payload[0]?.payload?.overUnder !== undefined && payload[0].payload.actual > 0 && (
                <div style={{ marginTop: 2, opacity: 0.7 }}>
                    vs Target: <span style={{ color: payload[0].payload.overUnder >= 0 ? "#6ee7b7" : "#fca5a5" }}>
                        {payload[0].payload.overUnder > 0 ? "+" : ""}{payload[0].payload.overUnder.toFixed(1)}%
                    </span>
                </div>
            )}
        </div>
    )
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────
interface AnalyticsDashboardProps { 
    leads: Lead[] 
    pipelines?: { id: string; name: string; is_default?: boolean }[]
    activePipelineId?: string
}

export function AnalyticsDashboard({ leads, pipelines = [], activePipelineId }: AnalyticsDashboardProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const currentYear = new Date().getFullYear()
    const [periodStr, setPeriodStr] = useState("this_quarter")
    const [catToggle, setCatToggle] = useState<'category' | 'grade_lead'>('category')
    const [streamToggle, setStreamToggle] = useState<'main_stream' | 'stream_type' | 'business_purpose'>('main_stream')
    const [trendYear, setTrendYear] = useState(currentYear)
    const [scrolled, setScrolled] = useState(false)
    const scrollRef = useRef<HTMLElement | null>(null)

    // Responsive breakpoints
    const [winWidth, setWinWidth] = useState(1280)
    useEffect(() => {
        const handleResize = () => setWinWidth(window.innerWidth)
        handleResize()
        window.addEventListener("resize", handleResize)
        return () => window.removeEventListener("resize", handleResize)
    }, [])
    const isTablet = winWidth < 1280
    const isMobile = winWidth < 768

    // Scroll hysteresis to prevent oscillation when subtitle collapses
    const SCROLL_HIDE = 20  // subtitle hides when scrollTop > 20
    const SCROLL_SHOW = 6   // subtitle shows when scrollTop < 6

    useEffect(() => {
        // Find the scrolling parent (<main> in main-layout.tsx)
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
                        if (prev && top < SCROLL_SHOW) return false   // back to top
                        if (!prev && top > SCROLL_HIDE) return true   // scrolled down
                        return prev                                    // dead zone — keep state
                    })
                    ticking = false
                })
            }
            parent.addEventListener("scroll", handler, { passive: true })
            // Store cleanup ref
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
        const data = MONTHS_SHORT.map(m => ({ month: m, actual: 0, target: 0, prevYear: 0, overUnder: 0 }))
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
        data.forEach(d => { d.target = 150_000_000; if (d.actual > 0) d.overUnder = ((d.actual - d.target) / d.target) * 100 })
        return data
    }, [leads, trendYear])

    const stageData = useMemo(() => {
        const counts: Record<string, number> = {}
        leads.forEach(l => { const s = l.pipeline_stage?.name || "Unknown"; counts[s] = (counts[s] || 0) + 1 })
        return Object.entries(counts).map(([name, count]) => ({ name, count }))
    }, [leads])

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
        leads.forEach(l => { const val = l[catToggle] as string || "Unspecified"; m[val] = (m[val] || 0) + 1 })
        return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
    }, [leads, catToggle])

    const streamData = useMemo(() => {
        const m: Record<string, number> = {}
        leads.forEach(l => { const val = l[streamToggle] as string || "Unspecified"; m[val] = (m[val] || 0) + 1 })
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

    // ─── CUSTOM SELECT STYLE ────────────────────────────────────────
    const miniSelectStyle: CSSProperties = {
        appearance: "none" as const, background: "#f4f5f7", border: "1px solid #e5e8ed", borderRadius: 5,
        padding: "3px 20px 3px 8px", fontSize: 11, fontWeight: 600, color: "#0f1729",
        cursor: "pointer", fontFamily: "inherit",
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='9' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat", backgroundPosition: "right 5px center",
    }

    return (
        <>
            {/* ─── STICKY HEADER (fixed height 64px — no layout shift) ─── */}
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
                </div>
            </div>

            {/* ─── CONTENT ───────────────────────────────────────────── */}
            <div style={{ padding: "6px 24px 24px", background: "#f2f3f6", minHeight: "100%" }}>

                {/* KPI Cards */}
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : isTablet ? "repeat(3, 1fr)" : "repeat(5, 1fr)", gap: 10, marginBottom: 12 }}>
                    {kpis.map((k, i) => (
                        <KPICard key={k.label} delay={i * 60} {...k} />
                    ))}
                </div>

                {/* Row 1: Revenue Chart + Pipeline */}
                <div style={{ display: "grid", gridTemplateColumns: isMobile || isTablet ? "1fr" : "2fr 1fr", gap: 10, marginBottom: 12 }}>
                    {/* Revenue Chart */}
                    <SectionCard>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                            <div>
                                <SectionTitle>Monthly Revenue vs Target</SectionTitle>
                                <SectionSub>Actual vs Target vs Last Year</SectionSub>
                            </div>
                            <select style={miniSelectStyle} value={trendYear} onChange={e => setTrendYear(Number(e.target.value))}>
                                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                        <div style={{ height: 190, width: "100%" }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={monthlyRev} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f3f5" />
                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 500 }} dy={8} />
                                    <YAxis yAxisId="left" tickFormatter={formatCur} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#b0b8c8', fontWeight: 500 }} dx={-5} width={55} />
                                    <RechartsTooltip content={<DarkTooltip />} />
                                    <Legend wrapperStyle={{ paddingTop: '6px', fontSize: '9.5px', fontWeight: 500 }} />
                                    <Bar yAxisId="left" dataKey="actual" name={`Actual ${trendYear}`} barSize={20} fill="#6366f1" radius={[3, 3, 0, 0]} />
                                    <Bar yAxisId="left" dataKey="prevYear" name={`Last Year`} barSize={12} fill="#ddd6fe" radius={[3, 3, 0, 0]} />
                                    <Line yAxisId="left" type="step" dataKey="target" name="Target" stroke="#c0c7d2" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </SectionCard>

                    {/* Pipeline */}
                    <PipelineStages data={stageData} />
                </div>

                {/* Row 2: Sales Performance (3fr) + Top Revenue (2fr) */}
                <div style={{ display: "grid", gridTemplateColumns: isMobile || isTablet ? "1fr" : "3fr 2fr", gap: 10, marginBottom: 12 }}>

                    {/* ─── 4.1 Sales Performance vs Target ─── */}
                    <SectionCard>
                        <SectionTitle>Sales Performance vs Target</SectionTitle>
                        <SectionSub>Revenue achievement per sales rep</SectionSub>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {salesData.map((rep, i) => {
                                const maxVal = Math.max(...salesData.map(r => Math.max(r.actual, r.target)), 1)
                                const pct = rep.target > 0 ? (rep.actual / rep.target) * 100 : 0
                                const isUnassigned = rep.name === "Unassigned"
                                const barColor = isUnassigned ? "#94a3b8" : pct >= 100 ? "#10b981" : pct >= 70 ? "#6366f1" : "#ef4444"
                                return (
                                    <div key={rep.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <div style={{ width: 80, fontSize: 11, fontWeight: 500, color: isUnassigned ? "#94a3b8" : "#5a6178", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flexShrink: 0, fontStyle: isUnassigned ? "italic" : "normal" }}>
                                            {isUnassigned && <span style={{ marginRight: 3 }}>⚠</span>}{rep.name}
                                        </div>
                                        <div style={{ flex: 1, height: 28, background: "#f1f3f5", borderRadius: 4, position: "relative", overflow: "hidden" }}>
                                            {/* Ghost target bar */}
                                            <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${(rep.target / maxVal) * 100}%`, background: barColor, opacity: 0.1, borderRadius: 4 }} />
                                            {/* Actual bar */}
                                            <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${(rep.actual / maxVal) * 100}%`, background: barColor, borderRadius: 4, transition: "width .4s ease", minWidth: rep.actual > 0 ? 4 : 0 }} />
                                            {/* Achievement pill */}
                                            {rep.target > 0 && <span style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", fontSize: 9, fontWeight: 700, color: barColor, background: "#fff", padding: "0 4px", borderRadius: 3, lineHeight: "16px" }}>{pct.toFixed(0)}%</span>}
                                        </div>
                                        <div style={{ width: 100, fontSize: 10, textAlign: "right" as const, color: "#5a6178", flexShrink: 0, whiteSpace: "nowrap" }}>
                                            <span style={{ fontWeight: 700, color: "#0f1729" }}>{formatCur(rep.actual)}</span>
                                            {rep.target > 0 && <span style={{ color: "#94a3b8" }}> / {formatCur(rep.target)}</span>}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        {/* Legend */}
                        <div style={{ display: "flex", gap: 10, marginTop: 10, paddingTop: 8, borderTop: "1px solid #f1f3f5" }}>
                            {[{ color: "#10b981", label: "Above Target" }, { color: "#6366f1", label: "On Track" }, { color: "#ef4444", label: "Below Target" }, { color: "#94a3b8", label: "Unassigned" }].map(l => (
                                <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 9, color: "#94a3b8" }}>
                                    <div style={{ width: 6, height: 6, borderRadius: 2, background: l.color }} />{l.label}
                                </div>
                            ))}
                        </div>
                        {/* Insight callout */}
                        {(() => {
                            const unassigned = salesData.find(r => r.name === "Unassigned")
                            const lowPerf = salesData.find(r => r.name !== "Unassigned" && r.target > 0 && (r.actual / r.target) < 0.5)
                            if (unassigned && unassigned.actual > 0) return <InsightCallout icon="⚠" text={`${formatCur(unassigned.actual)} unassigned revenue — distribute to sales reps`} />
                            if (lowPerf) return <InsightCallout icon="⚠" text={`${lowPerf.name} at ${((lowPerf.actual / lowPerf.target) * 100).toFixed(0)}% — schedule performance review`} />
                            if (salesData.every(r => r.target <= 0 || (r.actual / r.target) >= 0.8)) return <InsightCallout icon="💡" text="Team on track — consider raising targets" />
                            return null
                        })()}
                    </SectionCard>

                    {/* ─── 4.2 Top Revenue Generators ─── */}
                    <SectionCard>
                        <SectionTitle>Top Revenue Generators</SectionTitle>
                        <SectionSub>Client companies by contribution</SectionSub>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {topComps.map((comp, i) => {
                                const maxRev = topComps[0]?.revenue || 1
                                const isUnknown = comp.name === "Unknown Company"
                                return (
                                    <div key={comp.name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <span style={{ width: 16, fontSize: 10, fontWeight: 700, color: i < 3 ? "#6366f1" : "#8892a4", textAlign: "right" as const, flexShrink: 0 }}>{i + 1}</span>
                                        <div style={{ width: 85, fontSize: 11, fontWeight: 500, color: isUnknown ? "#94a3b8" : "#5a6178", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flexShrink: 0, fontStyle: isUnknown ? "italic" : "normal" }}>{comp.name}</div>
                                        <div style={{ flex: 1, height: 22, background: "#f1f3f5", borderRadius: 4, overflow: "hidden" }}>
                                            <div style={{
                                                height: "100%", width: `${(comp.revenue / maxRev) * 100}%`,
                                                background: isUnknown ? "#e2e5ea" : `linear-gradient(90deg, #6366f1, #818cf8)`,
                                                borderRadius: 4, transition: "width .4s ease",
                                                borderStyle: isUnknown ? "dashed" : "none",
                                            }} />
                                        </div>
                                        <span style={{ width: 65, fontSize: 10, fontWeight: 700, color: "#0f1729", textAlign: "right" as const, flexShrink: 0, whiteSpace: "nowrap" }}>{formatCur(comp.revenue)}</span>
                                    </div>
                                )
                            })}
                        </div>
                        {/* Summary footer */}
                        <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid #f1f3f5", fontSize: 10.5, color: "#8892a4" }}>
                            Total Won Revenue: <span style={{ fontWeight: 700, color: "#0f1729" }}>{formatCur(topComps.reduce((s, c) => s + c.revenue, 0))}</span> from {topComps.length} {topComps.length === 1 ? "company" : "companies"}
                        </div>
                        {/* Insight */}
                        {(() => {
                            const total = topComps.reduce((s, c) => s + c.revenue, 0)
                            if (topComps.length > 0 && total > 0 && (topComps[0].revenue / total) > 0.5) {
                                return <InsightCallout icon="⚠" text={`High client concentration — ${topComps[0].name} is ${((topComps[0].revenue / total) * 100).toFixed(0)}% of revenue`} />
                            }
                            if (topComps.length >= 5) return <InsightCallout icon="💡" text={`Healthy diversification across ${topComps.length} clients`} />
                            return null
                        })()}
                    </SectionCard>
                </div>

                {/* Row 3: Lead Source + Classification + Stream */}
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : isTablet ? "1fr 1fr" : "1fr 1fr 1fr", gap: 10 }}>

                    {/* ─── 4.3 Lead Source (stacked bar + breakdown) ─── */}
                    <SectionCard>
                        <SectionTitle>Lead Source</SectionTitle>
                        <SectionSub>Origin channel distribution</SectionSub>
                        {(() => {
                            const totalLeads = sourceData.reduce((s, d) => s + d.value, 0)
                            const sourceColors: Record<string, string> = { "Referral": "#6366f1", "Event Partnership": "#8b5cf6", "Direct Request": "#0ea5e9", "Cold Call": "#f59e0b", "Repeat Client": "#10b981" }
                            return (
                                <>
                                    {/* Stacked bar */}
                                    <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", marginBottom: 12 }}>
                                        {sourceData.map((d, i) => (
                                            <div key={d.name} style={{ width: `${(d.value / totalLeads) * 100}%`, background: sourceColors[d.name] || CHART_COLORS[i % CHART_COLORS.length], transition: "width .4s ease" }} />
                                        ))}
                                    </div>
                                    <div style={{ fontSize: 9, color: "#94a3b8", textAlign: "right" as const, marginTop: -8, marginBottom: 8 }}>Total: {totalLeads}</div>
                                    {/* Breakdown list */}
                                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                        {sourceData.map((d, i) => {
                                            const color = sourceColors[d.name] || CHART_COLORS[i % CHART_COLORS.length]
                                            const pct = totalLeads > 0 ? (d.value / totalLeads) * 100 : 0
                                            return (
                                                <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                    <div style={{ width: 75, fontSize: 10.5, fontWeight: 500, color: "#5a6178", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flexShrink: 0 }}>{d.name}</div>
                                                    <div style={{ flex: 1, height: 6, background: "#f1f3f5", borderRadius: 3, overflow: "hidden" }}>
                                                        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width .4s" }} />
                                                    </div>
                                                    <span style={{ fontSize: 10.5, fontWeight: 700, color: "#0f1729", width: 20, textAlign: "right" as const, flexShrink: 0 }}>{d.value}</span>
                                                    <span style={{ fontSize: 9.5, color: "#94a3b8", width: 30, flexShrink: 0 }}>({pct.toFixed(0)}%)</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                    {/* Insight */}
                                    {sourceData.length > 0 && (() => {
                                        const topPct = totalLeads > 0 ? (sourceData[0].value / totalLeads) * 100 : 0
                                        const extra = topPct > 60 ? " — consider diversifying" : ""
                                        return <InsightCallout icon="💡" text={`${sourceData[0].name} is your top source at ${topPct.toFixed(0)}%${extra}`} />
                                    })()}
                                </>
                            )
                        })()}
                    </SectionCard>

                    {/* ─── 4.4 Classification (segmented bar + metric cards) ─── */}
                    <SectionCard>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 1 }}>
                            <SectionTitle>Lead Classification</SectionTitle>
                            <select style={{ ...miniSelectStyle, fontSize: 10 }} value={catToggle} onChange={(e: any) => setCatToggle(e.target.value)}>
                                <option value="category">Category</option>
                                <option value="grade_lead">Grade</option>
                            </select>
                        </div>
                        <SectionSub>Pipeline temperature breakdown</SectionSub>
                        {(() => {
                            const totalCat = catGradeData.reduce((s, d) => s + d.value, 0)
                            // Map categories to temperature colors
                            const tempColors: Record<string, string> = { "Hot": "#ef4444", "Warm": "#f59e0b", "Cold": "#6366f1", "A": "#ef4444", "B": "#f59e0b", "C": "#6366f1" }
                            const getColor = (name: string, idx: number) => tempColors[name] || CHART_COLORS[(idx + 3) % CHART_COLORS.length]

                            return (
                                <>
                                    {/* Segmented bar */}
                                    <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", marginBottom: 12 }}>
                                        {catGradeData.map((d, i) => (
                                            <div key={d.name} style={{ width: `${(d.value / totalCat) * 100}%`, background: getColor(d.name, i), transition: "width .4s ease" }} />
                                        ))}
                                    </div>
                                    <div style={{ fontSize: 9, color: "#94a3b8", textAlign: "right" as const, marginTop: -8, marginBottom: 8 }}>Total: {totalCat}</div>
                                    {/* Metric mini cards */}
                                    <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(catGradeData.length, 3)}, 1fr)`, gap: 6 }}>
                                        {catGradeData.slice(0, 3).map((d, i) => {
                                            const color = getColor(d.name, i)
                                            const pct = totalCat > 0 ? (d.value / totalCat) * 100 : 0
                                            return (
                                                <div key={d.name} style={{ background: color + "0d", borderRadius: 8, padding: 10, textAlign: "center" as const }}>
                                                    <div style={{ fontSize: 10, fontWeight: 600, color, marginBottom: 2 }}>{d.name}</div>
                                                    <div style={{ fontSize: 18, fontWeight: 800, color: "#0f1729", lineHeight: 1.2 }}>{d.value}</div>
                                                    <div style={{ fontSize: 10, color: "#8892a4", marginTop: 2 }}>{pct.toFixed(0)}%</div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                    {/* Remaining items if > 3 */}
                                    {catGradeData.length > 3 && (
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                                            {catGradeData.slice(3).map((d, i) => (
                                                <span key={d.name} style={{ fontSize: 9, color: "#8892a4", background: "#f4f5f7", padding: "2px 6px", borderRadius: 3, fontWeight: 500 }}>
                                                    {d.name}: {d.value}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    {/* Insight */}
                                    {catGradeData.length > 0 && (() => {
                                        const topPct = totalCat > 0 ? (catGradeData[0].value / totalCat) * 100 : 0
                                        const isHot = catGradeData[0].name.toLowerCase().includes("hot") || catGradeData[0].name === "A"
                                        if (isHot && topPct > 30) return <InsightCallout icon="💡" text={`Hot leads at ${topPct.toFixed(0)}% — prioritize immediate follow-up`} />
                                        return <InsightCallout icon="💡" text={`${catGradeData[0].name} leads dominate at ${topPct.toFixed(0)}%`} />
                                    })()}
                                </>
                            )
                        })()}
                    </SectionCard>

                    {/* ─── 4.5 Stream Alignment (horizontal bar breakdown) ─── */}
                    <SectionCard>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 1 }}>
                            <SectionTitle>Stream Alignment</SectionTitle>
                            <select style={{ ...miniSelectStyle, fontSize: 10 }} value={streamToggle} onChange={(e: any) => setStreamToggle(e.target.value)}>
                                <option value="main_stream">All</option>
                                <option value="stream_type">Sub Stream</option>
                                <option value="business_purpose">Biz Purpose</option>
                            </select>
                        </div>
                        <SectionSub>Business alignment distribution</SectionSub>
                        {(() => {
                            const totalStream = streamData.reduce((s, d) => s + d.value, 0)
                            const maxStream = streamData[0]?.value || 1
                            return (
                                <>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                                        {streamData.map((d, i) => {
                                            const color = CHART_COLORS[i % CHART_COLORS.length]
                                            const isUnspecified = d.name === "Unspecified"
                                            const pct = totalStream > 0 ? (d.value / totalStream) * 100 : 0
                                            return (
                                                <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                    <div style={{ width: 85, fontSize: 10.5, fontWeight: 500, color: isUnspecified ? "#94a3b8" : "#5a6178", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flexShrink: 0, fontStyle: isUnspecified ? "italic" : "normal" }}>
                                                        {isUnspecified && <span style={{ marginRight: 2 }}>⚠</span>}{d.name}
                                                    </div>
                                                    <div style={{ flex: 1, height: 6, background: "#f1f3f5", borderRadius: 3, overflow: "hidden" }}>
                                                        <div style={{ height: "100%", width: `${(d.value / maxStream) * 100}%`, background: isUnspecified ? "#e2e5ea" : color, borderRadius: 3, transition: "width .4s", borderStyle: isUnspecified ? "dashed" : "none" }} />
                                                    </div>
                                                    <span style={{ fontSize: 10.5, fontWeight: 700, color: "#0f1729", width: 18, textAlign: "right" as const, flexShrink: 0 }}>{d.value}</span>
                                                    <span style={{ fontSize: 9.5, color: "#94a3b8", width: 30, flexShrink: 0 }}>({pct.toFixed(0)}%)</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                    {/* Insight */}
                                    {streamData.length > 0 && (() => {
                                        const unspecPct = totalStream > 0 ? ((streamData.find(d => d.name === "Unspecified")?.value || 0) / totalStream) * 100 : 0
                                        if (unspecPct > 20) return <InsightCallout icon="⚠" text={`${unspecPct.toFixed(0)}% leads unspecified — improve data capture`} />
                                        return <InsightCallout icon="💡" text={`${streamData[0].name} leads the pipeline — align sales capacity`} />
                                    })()}
                                </>
                            )
                        })()}
                    </SectionCard>
                </div>

            </div>
        </>
    )
}
