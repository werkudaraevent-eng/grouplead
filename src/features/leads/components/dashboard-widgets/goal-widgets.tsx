"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/utils/supabase/client"
import { useGoalData } from "@/features/goals/hooks/use-goal-data"
import { useCompany } from "@/contexts/company-context"
import { useCurrency } from "@/contexts/currency-context"
import { calculateAttainmentV2 } from "@/features/goals/lib/attainment-calculator"
import { SectionCard, SectionTitle, SectionSub, EmptyState } from "./shared"
import { TrendingUp, Target, ArrowDown, ArrowUp, Building2, PieChart as PieChartIcon, BarChart3 } from "lucide-react"
import { useHasMounted } from "@/hooks/use-has-mounted"
import {
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts"
import type { GoalV2, LeadAttainmentInput } from "@/types/goals"

// ─── Shared Helpers ─────────────────────────────────────────────────────────

function NoGoalData({ message }: { message?: string }) {
  return (
    <EmptyState
      message={message || "No active goal configured"}
      cta="Configure Goals"
      href="/settings"
    />
  )
}

function LoadingDot() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "12px 0" }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#cbd5e1" }} />
      <span style={{ fontSize: 11, color: "#94a3b8" }}>Loading…</span>
    </div>
  )
}

function ChartPlaceholder() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, minHeight: 60, color: "#cbd5e1", fontSize: 11 }}>
      Loading chart…
    </div>
  )
}

/** Dark-themed tooltip used across all goal widgets */
function GoalTooltip({ active, payload, label, fmt }: { active?: boolean; payload?: any[]; label?: string; fmt: (v: number) => string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
        background: "#0f172a", color: "#fff", padding: "8px 11px", borderRadius: 8,
      fontSize: 11, lineHeight: 1.6, boxShadow: "0 4px 16px rgba(0,0,0,.25)",
    }}>
      {label && <div style={{ fontWeight: 700, marginBottom: 1 }}>{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <div style={{ width: 6, height: 6, borderRadius: 2, background: p.color ?? p.fill, flexShrink: 0 }} />
          <span>{p.name}: {typeof p.value === "number" ? fmt(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  )
}

// ─── 1. Goal Attainment Widget ──────────────────────────────────────────────

export function GoalAttainmentWidget() {
  const { fmt } = useCurrency()
  const data = useGoalData()
  const mounted = useHasMounted()
  const pct = data.target > 0 ? (data.attainment / data.target) * 100 : 0
  const clampedPct = Math.min(pct, 100)
  const fillColor = pct >= 100 ? "#10b981" : pct >= 70 ? "#0ea5e9" : "#f59e0b"

  const chartData = [{ name: "Attainment", value: clampedPct, fill: fillColor }]

  return (
    <SectionCard>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
        <TrendingUp style={{ width: 13, height: 13, color: "#94a3b8" }} />
        <SectionTitle>Goal Attainment</SectionTitle>
      </div>
      <SectionSub>Attainment vs target</SectionSub>
      {data.loading ? (
        <LoadingDot />
      ) : !data.goal ? (
        <NoGoalData />
      ) : !mounted ? (
        <ChartPlaceholder />
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ flex: 1, minHeight: 80, width: "100%", position: "relative" }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                cx="50%"
                cy="50%"
                innerRadius="70%"
                outerRadius="100%"
                barSize={14}
                data={chartData}
                startAngle={90}
                endAngle={-270}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                <RadialBar
                  background={{ fill: "#f1f5f9" }}
                  dataKey="value"
                  angleAxisId={0}
                  cornerRadius={8}
                />
              </RadialBarChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div style={{
              position: "absolute", top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              textAlign: "center", pointerEvents: "none",
            }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: fillColor, lineHeight: 1 }}>
                {pct.toFixed(0)}%
              </div>
            </div>
          </div>
          <div style={{ textAlign: "center", marginTop: 4, flexShrink: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.3px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {fmt(data.attainment)}
            </div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1 }}>
              {pct.toFixed(1)}% of {fmt(data.target)}
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  )
}

// ─── 2. Goal Forecast Widget ────────────────────────────────────────────────

export function GoalForecastWidget() {
  const { fmt, fmtAxis } = useCurrency()
  const data = useGoalData()
  const mounted = useHasMounted()

  const chartData = [
    { name: "Raw Pipeline", value: data.forecastRaw, fill: "#0ea5e9" },
    { name: "Weighted Forecast", value: data.forecastWeighted, fill: "#6366f1" },
  ]

  return (
    <SectionCard>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
        <Target style={{ width: 13, height: 13, color: "#94a3b8" }} />
        <SectionTitle>Weighted Forecast</SectionTitle>
      </div>
      <SectionSub>Pipeline + weighted forecast</SectionSub>
      {data.loading ? (
        <LoadingDot />
      ) : !data.goal ? (
        <NoGoalData />
      ) : !mounted ? (
        <ChartPlaceholder />
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ flex: 1, minHeight: 80, width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={fmtAxis} width={60} />
                <Tooltip content={<GoalTooltip fmt={fmt} />} cursor={{ fill: "rgba(0,0,0,.04)" }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} name="Amount">
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "flex", justifyContent: "space-around", marginTop: 4, flexShrink: 0 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "#94a3b8" }}>Raw Pipeline</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#0ea5e9" }}>{fmt(data.forecastRaw)}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "#94a3b8" }}>Weighted</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#6366f1" }}>{fmt(data.forecastWeighted)}</div>
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  )
}

// ─── 3. Goal Variance Widget ────────────────────────────────────────────────

export function GoalVarianceWidget() {
  const { fmt, fmtAxis } = useCurrency()
  const data = useGoalData()
  const mounted = useHasMounted()
  // Positive gap = shortfall (target > attainment), negative gap = surplus
  const gapAttainment = data.target - data.attainment
  const gapWithForecast = data.target - (data.attainment + data.forecastWeighted)

  // For the chart, we invert: surplus is positive bar, shortfall is negative bar
  const chartData = [
    {
      name: "Gap to Target",
      value: -gapAttainment, // negative when shortfall, positive when surplus
      fill: gapAttainment > 0 ? "#ef4444" : "#10b981",
    },
    {
      name: "Gap with Forecast",
      value: -gapWithForecast,
      fill: gapWithForecast > 0 ? "#ef4444" : "#10b981",
    },
  ]

  return (
    <SectionCard>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
        <ArrowDown style={{ width: 13, height: 13, color: "#94a3b8" }} />
        <SectionTitle>Variance / Gap</SectionTitle>
      </div>
      <SectionSub>Gap indicators</SectionSub>
      {data.loading ? (
        <LoadingDot />
      ) : !data.goal ? (
        <NoGoalData />
      ) : !mounted ? (
        <ChartPlaceholder />
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ flex: 1, minHeight: 80, width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={fmtAxis} width={60} />
                <Tooltip content={<GoalTooltip fmt={fmt} />} cursor={{ fill: "rgba(0,0,0,.04)" }} />
                <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} name="Gap">
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "flex", justifyContent: "space-around", marginTop: 4, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              {gapAttainment > 0 ? (
                <ArrowDown style={{ width: 10, height: 10, color: "#ef4444" }} />
              ) : (
                <ArrowUp style={{ width: 10, height: 10, color: "#10b981" }} />
              )}
              <span style={{ fontSize: 9, color: "#94a3b8" }}>
                {fmt(Math.abs(gapAttainment))} {gapAttainment > 0 ? "below" : "above"}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              {gapWithForecast > 0 ? (
                <ArrowDown style={{ width: 10, height: 10, color: "#ef4444" }} />
              ) : (
                <ArrowUp style={{ width: 10, height: 10, color: "#10b981" }} />
              )}
              <span style={{ fontSize: 9, color: "#94a3b8" }}>
                {fmt(Math.abs(gapWithForecast))} {gapWithForecast > 0 ? "shortfall" : "surplus"}
              </span>
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  )
}

// ─── 4. Goal Company Breakdown Widget ───────────────────────────────────────

const COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6", "#8b5cf6"]

interface BreakdownRow { id: string; name: string; wonRevenue: number; target: number }

export function GoalCompanyBreakdownWidget() {
  const { fmt, fmtAxis } = useCurrency()
  const { activeCompany } = useCompany()
  const data = useGoalData()
  const mounted = useHasMounted()
  const [rows, setRows] = useState<BreakdownRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!data.goal || !activeCompany?.id) { setRows([]); return }

    const load = async () => {
      setLoading(true)
      const supabase = createClient()
      // Fetch leads with client_company join (CRM customers, NOT internal business units)
      const { data: leads } = await supabase
        .from("leads")
        .select("id, actual_value, client_company_id, client_company:client_companies!client_company_id(id, name), pipeline_stage:pipeline_stages!pipeline_stage_id(closed_status)")
        .eq("company_id", activeCompany.id)

      const grouped = new Map<string, { name: string; wonRevenue: number }>()
      for (const lead of ((leads ?? []) as unknown) as Array<{ id: number; actual_value: number | null; client_company_id: string | null; client_company: { id: string; name: string } | null; pipeline_stage: { closed_status: string | null } | null }>) {
        if (lead.pipeline_stage?.closed_status !== "won") continue
        const cid = lead.client_company_id ?? "unassigned"
        const cname = lead.client_company?.name ?? "Unknown Company"
        const existing = grouped.get(cid) ?? { name: cname, wonRevenue: 0 }
        existing.wonRevenue += lead.actual_value ?? 0
        grouped.set(cid, existing)
      }

      const sorted = Array.from(grouped.entries())
        .map(([id, v]) => ({ id, name: v.name, wonRevenue: v.wonRevenue, target: 0 }))
        .sort((a, b) => b.wonRevenue - a.wonRevenue)
        .slice(0, 8)

      setRows(sorted)
      setLoading(false)
    }
    load()
  }, [data.goal, activeCompany?.id])

  return (
    <SectionCard>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
        <Building2 style={{ width: 13, height: 13, color: "#94a3b8" }} />
        <SectionTitle>By Client Company</SectionTitle>
      </div>
      <SectionSub>Won revenue by client company</SectionSub>
      {data.loading || loading ? (
        <LoadingDot />
      ) : !data.goal ? (
        <NoGoalData />
      ) : rows.length === 0 ? (
        <div style={{ fontSize: 11, color: "#94a3b8" }}>No breakdown data.</div>
      ) : !mounted ? (
        <ChartPlaceholder />
      ) : (
        <div className="thin-scrollbar" style={{ flex: 1, width: "100%", minHeight: 0, overflowY: "auto", overflowX: "hidden" }}>
          <div style={{ width: "100%", height: Math.max(rows.length * 36, 80) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} layout="vertical" barCategoryGap="20%" margin={{ left: 0, right: 12, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={fmtAxis} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#64748b", fontWeight: 500 }} axisLine={false} tickLine={false} width={80} />
                <Tooltip content={<GoalTooltip fmt={fmt} />} cursor={{ fill: "rgba(0,0,0,.04)" }} />
                <Bar dataKey="wonRevenue" name="Revenue" radius={[0, 4, 4, 0]}>
                  {rows.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </SectionCard>
  )
}

// ─── 5. Goal Segment Breakdown Widget ───────────────────────────────────────

export function GoalSegmentBreakdownWidget() {
  const { fmt } = useCurrency()
  const { activeCompany } = useCompany()
  const data = useGoalData()
  const mounted = useHasMounted()
  const [rows, setRows] = useState<Array<{ name: string; wonRevenue: number }>>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!data.goal || !activeCompany?.id) { setRows([]); return }

    const load = async () => {
      setLoading(true)
      const supabase = createClient()
      const [segmentsRes, leadsRes] = await Promise.all([
        supabase.from("goal_segments").select("id, source_field, fallback_name, mappings").eq("company_id", activeCompany.id).limit(1),
        supabase.from("leads").select("id, actual_value, pipeline_stage:pipeline_stages!pipeline_stage_id(closed_status), category, lead_source, main_stream, grade_lead, stream_type, business_purpose, tipe, nationality, sector, area, referral_source, event_format").eq("company_id", activeCompany.id),
      ])

      const segments = segmentsRes.data ?? []
      if (!segments.length) { setRows([]); setLoading(false); return }

      const seg = segments[0] as { source_field: string; fallback_name: string; mappings: Array<{ segment_name: string; match_values: string[] }> }
      const leads = ((leadsRes.data ?? []) as unknown) as Array<{ id: number; actual_value: number | null; pipeline_stage: { closed_status: string | null } | null; [key: string]: unknown }>

      const totals = new Map<string, number>()
      for (const lead of leads) {
        if (lead.pipeline_stage?.closed_status !== "won") continue
        const raw = lead[seg.source_field] as string | null
        let segName = seg.fallback_name
        if (raw) {
          for (const m of seg.mappings) {
            if (m.match_values.includes(raw)) { segName = m.segment_name; break }
          }
        }
        totals.set(segName, (totals.get(segName) ?? 0) + (lead.actual_value ?? 0))
      }

      setRows(Array.from(totals.entries()).map(([name, wonRevenue]) => ({ name, wonRevenue })).sort((a, b) => b.wonRevenue - a.wonRevenue).slice(0, 8))
      setLoading(false)
    }
    load()
  }, [data.goal, activeCompany?.id])

  const total = rows.reduce((s, r) => s + r.wonRevenue, 0)

  const pieData = rows.map((r, i) => ({
    name: r.name,
    value: r.wonRevenue,
    fill: COLORS[i % COLORS.length],
    share: total > 0 ? ((r.wonRevenue / total) * 100).toFixed(1) : "0",
  }))

  const renderLegend = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4, maxHeight: 80, overflowY: "auto", flexShrink: 0 }}>
      {pieData.map((entry, i) => (
        <div key={entry.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: entry.fill, flexShrink: 0 }} />
            <span style={{ fontWeight: 600, color: "#0f172a" }}>{entry.name}</span>
          </div>
          <span style={{ color: "#94a3b8" }}>{fmt(entry.value)} ({entry.share}%)</span>
        </div>
      ))}
    </div>
  )

  const SegmentTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    return (
      <div style={{
      background: "#0f172a", color: "#fff", padding: "8px 11px", borderRadius: 8,
        fontSize: 11, lineHeight: 1.6, boxShadow: "0 4px 16px rgba(0,0,0,.25)",
      }}>
        <div style={{ fontWeight: 700, marginBottom: 1 }}>{d.name}</div>
        <div>Revenue: {fmt(d.value)}</div>
        <div>Share: {d.share}%</div>
      </div>
    )
  }

  return (
    <SectionCard>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
        <PieChartIcon style={{ width: 13, height: 13, color: "#94a3b8" }} />
        <SectionTitle>By Segment</SectionTitle>
      </div>
      <SectionSub>Goal breakdown by segment</SectionSub>
      {data.loading || loading ? (
        <LoadingDot />
      ) : !data.goal ? (
        <NoGoalData />
      ) : rows.length === 0 ? (
        <div style={{ fontSize: 11, color: "#94a3b8" }}>No segment data.</div>
      ) : !mounted ? (
        <ChartPlaceholder />
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, minHeight: 80, width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="50%"
                  outerRadius="80%"
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<SegmentTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {renderLegend()}
        </div>
      )}
    </SectionCard>
  )
}

// ─── 6. Goal Trend Widget ───────────────────────────────────────────────────

interface TrendEntry { label: string; attainment: number; target: number }

export function GoalTrendWidget() {
  const { fmt, fmtAxis } = useCurrency()
  const { activeCompany } = useCompany()
  const data = useGoalData()
  const mounted = useHasMounted()
  const [entries, setEntries] = useState<TrendEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!data.goal || !activeCompany?.id) { setEntries([]); setLoading(false); return }
    const goal = data.goal as GoalV2

    const fetchTrend = async () => {
      setLoading(true)
      const supabase = createClient()

      const { data: leads } = await supabase
        .from("leads")
        .select("id, actual_value, event_date_end, event_date_start, closed_won_date, pipeline_stage:pipeline_stages!pipeline_stage_id(closed_status)")
        .eq("company_id", activeCompany.id)

      const monthMap = new Map<string, LeadAttainmentInput[]>()
      const now = new Date()
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        monthMap.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, [])
      }

      for (const lead of ((leads ?? []) as unknown) as Array<{ id: number; actual_value: number | null; event_date_end: string | null; event_date_start: string | null; closed_won_date: string | null; pipeline_stage: { closed_status: string | null } | null }>) {
        const dateStr = goal.attribution_basis === "closed_won_date" ? lead.closed_won_date : (lead.event_date_end ?? lead.event_date_start)
        if (!dateStr) continue
        const d = new Date(dateStr)
        if (isNaN(d.getTime())) continue
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        if (!monthMap.has(key)) continue
        monthMap.get(key)!.push({ id: lead.id, actual_value: lead.actual_value, is_closed_won: lead.pipeline_stage?.closed_status === "won" })
      }

      // Calculate monthly target using same priority as revenue chart:
      // monthly_weights > equal distribution
      const hasMonthlyWeights = goal.monthly_weights && Object.keys(goal.monthly_weights).length > 0

      const trendData: TrendEntry[] = Array.from(monthMap.entries()).map(([key, monthLeads]) => {
        const [year, month] = key.split("-")
        const monthIdx = Number(month) // 1-12
        const label = new Date(Number(year), monthIdx - 1, 1).toLocaleDateString("id-ID", { month: "short", year: "2-digit" })
        const { total } = calculateAttainmentV2(monthLeads)

        let monthTarget = goal.target_amount / 12
        if (hasMonthlyWeights) {
          const weight = goal.monthly_weights![String(monthIdx)] || (1 / 12)
          monthTarget = goal.target_amount * weight
        }

        return { label, attainment: total, target: monthTarget }
      })

      setEntries(trendData)
      setLoading(false)
    }

    fetchTrend()
  }, [data.goal, activeCompany?.id])

  return (
    <SectionCard>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
        <BarChart3 style={{ width: 13, height: 13, color: "#94a3b8" }} />
        <SectionTitle>Historical Trend</SectionTitle>
      </div>
      <SectionSub>Monthly attainment (last 12 months)</SectionSub>
      {data.loading || loading ? (
        <LoadingDot />
      ) : !data.goal ? (
        <NoGoalData />
      ) : entries.length === 0 ? (
        <div style={{ fontSize: 11, color: "#94a3b8" }}>No trend data.</div>
      ) : !mounted ? (
        <ChartPlaceholder />
      ) : (
        <div style={{ flex: 1, width: "100%", minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={entries} barCategoryGap="20%" margin={{ left: 0, right: 4, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={fmtAxis} width={55} />
              <Tooltip content={<GoalTooltip fmt={fmt} />} cursor={{ fill: "rgba(0,0,0,.04)" }} />
              <Bar dataKey="attainment" name="Attainment" fill="#10b981" radius={[3, 3, 0, 0]} />
              <Bar dataKey="target" name="Target" fill="#cbd5e1" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </SectionCard>
  )
}
