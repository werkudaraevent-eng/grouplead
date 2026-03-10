"use client"

import { useMemo } from "react"
import { Lead } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    DollarSign, TrendingUp, Users, AlertTriangle,
    ArrowUpRight, ArrowDownRight
} from "lucide-react"
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Cell
} from "recharts"

// ============================================================
// HELPERS
// ============================================================

function formatCurrencyCompact(amount: number): string {
    if (amount >= 1_000_000_000) return `Rp${(amount / 1_000_000_000).toFixed(1)}B`
    if (amount >= 1_000_000) return `Rp${(amount / 1_000_000).toFixed(0)}M`
    if (amount >= 1_000) return `Rp${(amount / 1_000).toFixed(0)}K`
    return `Rp${amount}`
}

function formatCurrencyFull(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount)
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
    })
}

function getStatusColor(status: string | null): string {
    switch ((status || "").toLowerCase()) {
        case "lead masuk": return "text-blue-600 bg-blue-50"
        case "estimasi project": return "text-amber-600 bg-amber-50"
        case "proposal sent": return "text-violet-600 bg-violet-50"
        case "closed won": return "text-emerald-600 bg-emerald-50"
        case "closed lost": return "text-red-500 bg-red-50"
        default: return "text-gray-500 bg-gray-50"
    }
}

const BU_COLORS: Record<string, string> = {
    WNW: "#3b82f6",
    WNS: "#8b5cf6",
    UK: "#f59e0b",
    TEP: "#10b981",
    CREATIVE: "#ec4899",
}

// ============================================================
// COMPONENT
// ============================================================

interface AnalyticsDashboardProps {
    leads: Lead[]
}

export function AnalyticsDashboard({ leads }: AnalyticsDashboardProps) {
    const stats = useMemo(() => {
        const now = new Date()
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

        let activePipeline = 0
        let closedWonRevenue = 0
        let atRiskCount = 0

        for (const lead of leads) {
            const status = (lead.status || "").toLowerCase()
            const revenue = lead.estimated_revenue ?? 0

            if (status !== "closed won" && status !== "closed lost") {
                activePipeline += revenue
            }
            if (status === "closed won") {
                closedWonRevenue += lead.nominal_konfirmasi ?? lead.estimated_revenue ?? 0
            }
            if (status === "lead masuk" && lead.date_lead_received) {
                const received = new Date(lead.date_lead_received)
                if (received < sevenDaysAgo) atRiskCount++
            }
        }

        return { activePipeline, closedWonRevenue, totalLeads: leads.length, atRiskCount }
    }, [leads])

    const buChartData = useMemo(() => {
        const byBU: Record<string, number> = {}
        for (const lead of leads) {
            const bu = lead.bu_revenue || "Other"
            const rev = lead.estimated_revenue ?? 0
            byBU[bu] = (byBU[bu] || 0) + rev
        }
        return Object.entries(byBU)
            .map(([name, revenue]) => ({ name, revenue }))
            .sort((a, b) => b.revenue - a.revenue)
    }, [leads])

    const recentLeads = useMemo(() => {
        return [...leads]
            .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
            .slice(0, 5)
    }, [leads])

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
                <p className="text-sm text-muted-foreground">
                    Pipeline overview and key metrics
                </p>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                <KPICard
                    title="Active Pipeline"
                    value={formatCurrencyCompact(stats.activePipeline)}
                    subtitle="Sum of est. revenue (excl. Won/Lost)"
                    icon={TrendingUp}
                    iconColor="text-blue-600"
                    iconBg="bg-blue-50"
                />
                <KPICard
                    title="Closed Won Revenue"
                    value={formatCurrencyCompact(stats.closedWonRevenue)}
                    subtitle="Confirmed deal revenue"
                    icon={DollarSign}
                    iconColor="text-emerald-600"
                    iconBg="bg-emerald-50"
                    trend={stats.closedWonRevenue > 0 ? "up" : undefined}
                />
                <KPICard
                    title="Total Leads"
                    value={stats.totalLeads.toString()}
                    subtitle="All leads in pipeline"
                    icon={Users}
                    iconColor="text-violet-600"
                    iconBg="bg-violet-50"
                />
                <KPICard
                    title="At Risk"
                    value={stats.atRiskCount.toString()}
                    subtitle="New leads idle > 7 days"
                    icon={AlertTriangle}
                    iconColor="text-amber-600"
                    iconBg="bg-amber-50"
                    trend={stats.atRiskCount > 0 ? "down" : undefined}
                />
            </div>

            {/* Charts + Recent Activity */}
            <div className="grid gap-6 grid-cols-1 lg:grid-cols-5">
                {/* Bar Chart */}
                <Card className="lg:col-span-3">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold">Revenue by Business Unit</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {buChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={buChartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                    <XAxis dataKey="name" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                                    <YAxis
                                        tick={{ fontSize: 11 }}
                                        tickFormatter={(v) => formatCurrencyCompact(v)}
                                        className="text-muted-foreground"
                                    />
                                    <Tooltip
                                        formatter={(value) => [formatCurrencyFull(Number(value)), "Revenue"]}
                                        contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid hsl(var(--border))" }}
                                    />
                                    <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                                        {buChartData.map((entry) => (
                                            <Cell key={entry.name} fill={BU_COLORS[entry.name] || "#94a3b8"} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground">
                                No revenue data available
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Recent Activity */}
                <Card className="lg:col-span-2">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold">Recent Activity</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {recentLeads.length > 0 ? (
                            <div className="divide-y">
                                {recentLeads.map((lead) => (
                                    <div key={lead.id} className="px-6 py-3 flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium truncate">{lead.project_name || "Untitled"}</p>
                                            <p className="text-xs text-muted-foreground truncate">{lead.company_name}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${getStatusColor(lead.status)}`}>
                                                {lead.status || "N/A"}
                                            </span>
                                            <p className="text-[10px] text-muted-foreground mt-1">
                                                {formatDate(lead.updated_at)}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
                                No leads yet
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

// ============================================================
// KPI CARD
// ============================================================

function KPICard({
    title,
    value,
    subtitle,
    icon: Icon,
    iconColor,
    iconBg,
    trend,
}: {
    title: string
    value: string
    subtitle: string
    icon: typeof DollarSign
    iconColor: string
    iconBg: string
    trend?: "up" | "down"
}) {
    return (
        <Card>
            <CardContent className="p-5">
                <div className="flex items-start justify-between">
                    <div className="space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
                        <p className="text-2xl font-bold tracking-tight">{value}</p>
                        <p className="text-[11px] text-muted-foreground">{subtitle}</p>
                    </div>
                    <div className={`p-2.5 rounded-lg ${iconBg}`}>
                        <Icon className={`h-5 w-5 ${iconColor}`} />
                    </div>
                </div>
                {trend && (
                    <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend === "up" ? "text-emerald-600" : "text-red-500"}`}>
                        {trend === "up" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {trend === "up" ? "Positive" : "Needs attention"}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
