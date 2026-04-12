"use client"

import { useMemo } from "react"
import { Lead } from "@/types"
import {
    TrendingUp, Target, BarChart3, AlertTriangle,
    ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react"

/* ─── Formatters ──────────────────────────────────────────────────────── */
function formatCompactCurrency(value: number): string {
    if (!value) return "Rp 0"
    if (value >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1)}B`
    if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(0)}M`
    if (value >= 1_000) return `Rp ${(value / 1_000).toFixed(0)}K`
    return `Rp ${value.toLocaleString("id-ID")}`
}

/* ─── Stage Classification Engine ─────────────────────────────────────── */
function classifyLead(lead: Lead): "won" | "lost" | "active" {
    // Primary: use the relational pipeline_stage join (source of truth)
    const stageName = (lead.pipeline_stage?.name || "").toLowerCase()
    if (stageName.includes("won") || stageName.includes("closed won")) return "won"
    if (stageName.includes("lost") || stageName.includes("closed lost")) return "lost"

    // Fallback: flat status field for backward compat
    const status = (lead.status || "").toLowerCase()
    if (status.includes("won")) return "won"
    if (status.includes("lost")) return "lost"

    return "active"
}

/* ─── Metric Card Variants ────────────────────────────────────────────── */
const CARD_THEMES = {
    pipeline:  { icon: TrendingUp,    gradient: "from-blue-500/10 via-blue-500/5 to-transparent",   iconBg: "bg-blue-100",      iconColor: "text-blue-600",    badgeBg: "bg-blue-50 text-blue-700 ring-blue-200/60" },
    winRate:   { icon: Target,        gradient: "from-emerald-500/10 via-emerald-500/5 to-transparent", iconBg: "bg-emerald-100", iconColor: "text-emerald-600", badgeBg: "bg-emerald-50 text-emerald-700 ring-emerald-200/60" },
    dealSize:  { icon: BarChart3,     gradient: "from-violet-500/10 via-violet-500/5 to-transparent",  iconBg: "bg-violet-100",  iconColor: "text-violet-600",  badgeBg: "bg-violet-50 text-violet-700 ring-violet-200/60" },
    atRisk:    { icon: AlertTriangle, gradient: "from-amber-500/10 via-amber-500/5 to-transparent",   iconBg: "bg-amber-100",    iconColor: "text-amber-600",   badgeBg: "bg-amber-50 text-amber-700 ring-amber-200/60" },
}

/* ─── Main Component ──────────────────────────────────────────────────── */
interface PipelineMetricsBarProps {
    leads: Lead[]
    loading?: boolean
}

export function PipelineMetricsBar({ leads, loading }: PipelineMetricsBarProps) {
    const metrics = useMemo(() => {
        const now = new Date()
        const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

        // ── Accumulate from single pass ────────────────────────────────
        let activePipelineValue = 0
        let activeDeals = 0
        let closedWon = 0
        let closedLost = 0
        let closedWonValue = 0
        let staleCount = 0
        const atRiskSet = new Set<number>()  // Deduplicate by lead id

        for (const lead of leads) {
            const classification = classifyLead(lead)
            const estimatedValue = Number(lead.estimated_value) || 0

            if (classification === "won") {
                closedWon++
                closedWonValue += lead.actual_value ?? estimatedValue
            } else if (classification === "lost") {
                closedLost++
            } else {
                // ── Active deal metrics ────────────────────────────────
                activeDeals++
                activePipelineValue += estimatedValue

                const lastUpdated = new Date(lead.updated_at || lead.created_at)

                // Risk Signal 1: Stale — no update in >14 days
                if (lastUpdated < fourteenDaysAgo) {
                    staleCount++
                    atRiskSet.add(lead.id)
                }

                // Risk Signal 2: Overdue target close date
                if (lead.target_close_date && new Date(lead.target_close_date) < now) {
                    atRiskSet.add(lead.id)
                }
            }
        }

        // ── Derived metrics ────────────────────────────────────────────
        const totalClosed = closedWon + closedLost
        const winRate = totalClosed > 0 ? Math.round((closedWon / totalClosed) * 100) : 0
        const avgDealSize = activeDeals > 0 ? Math.round(activePipelineValue / activeDeals) : 0

        return {
            activePipelineValue,
            activeDeals,
            winRate,
            totalClosed,
            avgDealSize,
            atRiskDeals: atRiskSet.size,
            staleCount,
            closedWonValue,
        }
    }, [leads])

    if (loading) {
        return (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-6 pt-4 animate-pulse">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-card border border-border rounded-xl h-[108px]" />
                ))}
            </div>
        )
    }

    const cards: {
        key: string
        theme: keyof typeof CARD_THEMES
        label: string
        value: string
        subtitle: string
        badge?: string
        trend?: "up" | "down" | "neutral"
    }[] = [
        {
            key: "pipeline",
            theme: "pipeline",
            label: "Pipeline Health",
            value: formatCompactCurrency(metrics.activePipelineValue),
            subtitle: `${metrics.activeDeals} active deal${metrics.activeDeals !== 1 ? "s" : ""} in pipeline`,
            badge: "Active pipeline",
            trend: metrics.activePipelineValue > 0 ? "up" : "neutral",
        },
        {
            key: "winRate",
            theme: "winRate",
            label: "Win Rate",
            value: metrics.totalClosed > 0 ? `${metrics.winRate}%` : "—",
            subtitle: metrics.totalClosed > 0
                ? `${metrics.totalClosed} total closed deal${metrics.totalClosed !== 1 ? "s" : ""}`
                : "No closed deals yet",
            trend: metrics.winRate >= 30 ? "up" : metrics.winRate > 0 ? "down" : "neutral",
        },
        {
            key: "dealSize",
            theme: "dealSize",
            label: "Avg. Deal Size",
            value: metrics.avgDealSize > 0 ? formatCompactCurrency(metrics.avgDealSize) : "—",
            subtitle: metrics.activeDeals > 0
                ? "Across active pipeline"
                : "No active deals",
        },
        {
            key: "atRisk",
            theme: "atRisk",
            label: "Deals at Risk",
            value: metrics.atRiskDeals.toString(),
            subtitle: metrics.staleCount > 0
                ? `${metrics.staleCount} stale deal${metrics.staleCount !== 1 ? "s" : ""} (>14 days)`
                : "No stale deals detected",
            trend: metrics.atRiskDeals > 0 ? "down" : "up",
        },
    ]

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-6 pt-4 shrink-0">
            {cards.map((card) => {
                const t = CARD_THEMES[card.theme]
                const Icon = t.icon
                return (
                    <div
                        key={card.key}
                        className={`
                            relative overflow-hidden bg-card border border-border rounded-xl p-4
                            shadow-sm hover:shadow-md transition-shadow duration-200 group
                        `}
                    >
                        {/* Gradient wash */}
                        <div className={`absolute inset-0 bg-gradient-to-br ${t.gradient} pointer-events-none`} />

                        <div className="relative flex flex-col gap-2">
                            {/* Top row: label + icon */}
                            <div className="flex items-start justify-between">
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase">
                                        {card.label}
                                    </span>
                                    {card.badge && (
                                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ring-1 w-fit ${t.badgeBg}`}>
                                            {card.badge}
                                        </span>
                                    )}
                                </div>
                                <div className={`p-2 rounded-lg ${t.iconBg} group-hover:scale-110 transition-transform duration-200`}>
                                    <Icon className={`h-4 w-4 ${t.iconColor}`} />
                                </div>
                            </div>

                            {/* Value */}
                            <span className="text-2xl font-bold text-foreground tracking-tight leading-none">
                                {card.value}
                            </span>

                            {/* Footer: subtitle + trend */}
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] text-muted-foreground leading-snug line-clamp-1">
                                    {card.subtitle}
                                </span>
                                {card.trend && (
                                    <div className={`flex items-center gap-0.5 text-[10px] font-semibold shrink-0 ${
                                        card.trend === "up" ? "text-emerald-600"
                                            : card.trend === "down" ? "text-red-500"
                                            : "text-muted-foreground"
                                    }`}>
                                        {card.trend === "up" ? <ArrowUpRight className="h-3 w-3" />
                                            : card.trend === "down" ? <ArrowDownRight className="h-3 w-3" />
                                            : <Minus className="h-3 w-3" />}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
