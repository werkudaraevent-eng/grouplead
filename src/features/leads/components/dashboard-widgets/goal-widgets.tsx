"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/utils/supabase/client"
import { useGoalData } from "@/features/goals/hooks/use-goal-data"
import { useCompany } from "@/contexts/company-context"
import { calculateAttainmentV2 } from "@/features/goals/lib/attainment-calculator"
import { SectionCard, SectionTitle, SectionSub } from "./shared"
import { TrendingUp, Target, ArrowDown, ArrowUp, Building2, PieChart, BarChart3 } from "lucide-react"
import type { GoalV2, LeadAttainmentInput } from "@/types/goals"

// ─── Shared Helpers ─────────────────────────────────────────────────────────

function formatIDR(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) return `Rp${(value / 1_000_000_000).toFixed(1)}B`
  if (Math.abs(value) >= 1_000_000) return `Rp${(value / 1_000_000).toFixed(0)}M`
  if (Math.abs(value) >= 1_000) return `Rp${(value / 1_000).toFixed(0)}K`
  return `Rp${value.toLocaleString("id-ID")}`
}

function NoGoalData() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 80 }}>
      <span style={{ fontSize: 11.5, color: "#8892a4" }}>No goal data configured</span>
    </div>
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

// ─── 1. Goal Attainment Widget ──────────────────────────────────────────────

export function GoalAttainmentWidget() {
  const data = useGoalData()
  const pct = data.target > 0 ? (data.attainment / data.target) * 100 : 0
  const barWidth = Math.min(pct, 100)

  return (
    <SectionCard>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
        <TrendingUp style={{ width: 13, height: 13, color: "#8892a4" }} />
        <SectionTitle>Goal Attainment</SectionTitle>
      </div>
      <SectionSub>Attainment vs target</SectionSub>
      {data.loading ? (
        <LoadingDot />
      ) : !data.goal ? (
        <NoGoalData />
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#0f1729", letterSpacing: "-0.5px" }}>
            {formatIDR(data.attainment)}
          </div>
          <div style={{ fontSize: 11, color: "#8892a4", marginTop: 2 }}>
            {pct.toFixed(1)}% of {formatIDR(data.target)} target
          </div>
          <div style={{ marginTop: 10, height: 6, borderRadius: 4, background: "#f1f5f9", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                borderRadius: 4,
                background: pct >= 100 ? "#10b981" : pct >= 70 ? "#0ea5e9" : "#f59e0b",
                width: `${barWidth}%`,
                transition: "width 0.5s ease",
              }}
            />
          </div>
        </div>
      )}
    </SectionCard>
  )
}

// ─── 2. Goal Forecast Widget ────────────────────────────────────────────────

export function GoalForecastWidget() {
  const data = useGoalData()

  return (
    <SectionCard>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
        <Target style={{ width: 13, height: 13, color: "#8892a4" }} />
        <SectionTitle>Weighted Forecast</SectionTitle>
      </div>
      <SectionSub>Pipeline + weighted forecast</SectionSub>
      {data.loading ? (
        <LoadingDot />
      ) : !data.goal ? (
        <NoGoalData />
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 12 }}>
          <div>
            <div style={{ fontSize: 10.5, color: "#8892a4", marginBottom: 2 }}>Raw Pipeline</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#0f1729" }}>{formatIDR(data.forecastRaw)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: "#8892a4", marginBottom: 2 }}>Weighted Forecast</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#6366f1" }}>{formatIDR(data.forecastWeighted)}</div>
          </div>
        </div>
      )}
    </SectionCard>
  )
}

// ─── 3. Goal Variance Widget ────────────────────────────────────────────────

export function GoalVarianceWidget() {
  const data = useGoalData()
  const gapAttainment = data.target - data.attainment
  const gapWithForecast = data.target - (data.attainment + data.forecastWeighted)

  return (
    <SectionCard>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
        <SectionTitle>Variance / Gap</SectionTitle>
      </div>
      <SectionSub>Gap indicators</SectionSub>
      {data.loading ? (
        <LoadingDot />
      ) : !data.goal ? (
        <NoGoalData />
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 14 }}>
          <div>
            <div style={{ fontSize: 10.5, color: "#8892a4", marginBottom: 3 }}>Gap to Target</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {gapAttainment > 0 ? (
                <ArrowDown style={{ width: 14, height: 14, color: "#ef4444" }} />
              ) : (
                <ArrowUp style={{ width: 14, height: 14, color: "#10b981" }} />
              )}
              <span style={{ fontSize: 18, fontWeight: 800, color: gapAttainment > 0 ? "#ef4444" : "#10b981" }}>
                {formatIDR(Math.abs(gapAttainment))}
              </span>
              <span style={{ fontSize: 10, color: "#8892a4" }}>
                {gapAttainment > 0 ? "below target" : "above target"}
              </span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: "#8892a4", marginBottom: 3 }}>Gap with Forecast</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {gapWithForecast > 0 ? (
                <ArrowDown style={{ width: 14, height: 14, color: "#f59e0b" }} />
              ) : (
                <ArrowUp style={{ width: 14, height: 14, color: "#10b981" }} />
              )}
              <span style={{ fontSize: 18, fontWeight: 800, color: gapWithForecast > 0 ? "#f59e0b" : "#10b981" }}>
                {formatIDR(Math.abs(gapWithForecast))}
              </span>
              <span style={{ fontSize: 10, color: "#8892a4" }}>
                {gapWithForecast > 0 ? "projected shortfall" : "projected surplus"}
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
  const { activeCompany } = useCompany()
  const data = useGoalData()
  const [rows, setRows] = useState<BreakdownRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!data.goal || !activeCompany?.id) { setRows([]); return }
    const goal = data.goal as GoalV2
    if (!goal.breakdown_config?.length) { setRows([]); return }

    const load = async () => {
      setLoading(true)
      const supabase = createClient()
      const { data: leads } = await supabase
        .from("leads")
        .select("id, actual_value, company_id, pipeline_stage:pipeline_stages!pipeline_stage_id(closed_status)")
        .eq("company_id", activeCompany.id)

      const { data: companies } = await supabase.from("companies").select("id, name")
      const companyMap = new Map((companies ?? []).map((c: { id: string; name: string }) => [c.id, c.name]))

      const grouped = new Map<string, { name: string; wonRevenue: number }>()
      for (const lead of (leads ?? []) as Array<{ id: number; actual_value: number | null; company_id: string | null; pipeline_stage: { closed_status: string | null } | null }>) {
        if (lead.pipeline_stage?.closed_status !== "won") continue
        const cid = lead.company_id ?? "unassigned"
        const existing = grouped.get(cid) ?? { name: companyMap.get(cid) ?? cid, wonRevenue: 0 }
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
        <Building2 style={{ width: 13, height: 13, color: "#8892a4" }} />
        <SectionTitle>By Company</SectionTitle>
      </div>
      <SectionSub>Goal breakdown by company</SectionSub>
      {data.loading || loading ? (
        <LoadingDot />
      ) : !data.goal ? (
        <NoGoalData />
      ) : rows.length === 0 ? (
        <div style={{ fontSize: 11, color: "#8892a4" }}>No breakdown data.</div>
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          {rows.map((row, i) => (
            <div key={row.id}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                <span style={{ fontWeight: 600, color: "#0f1729" }}>{row.name}</span>
                <span style={{ color: "#8892a4" }}>{formatIDR(row.wonRevenue)}</span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: "#f1f5f9", overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 2, background: COLORS[i % COLORS.length], width: "100%", transition: "width 0.4s ease" }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  )
}

// ─── 5. Goal Segment Breakdown Widget ───────────────────────────────────────

export function GoalSegmentBreakdownWidget() {
  const { activeCompany } = useCompany()
  const data = useGoalData()
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
      const leads = (leadsRes.data ?? []) as Array<{ id: number; actual_value: number | null; pipeline_stage: { closed_status: string | null } | null; [key: string]: unknown }>

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

  return (
    <SectionCard>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
        <PieChart style={{ width: 13, height: 13, color: "#8892a4" }} />
        <SectionTitle>By Segment</SectionTitle>
      </div>
      <SectionSub>Goal breakdown by segment</SectionSub>
      {data.loading || loading ? (
        <LoadingDot />
      ) : !data.goal ? (
        <NoGoalData />
      ) : rows.length === 0 ? (
        <div style={{ fontSize: 11, color: "#8892a4" }}>No segment data.</div>
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          {rows.map((row, i) => {
            const share = total > 0 ? (row.wonRevenue / total) * 100 : 0
            return (
              <div key={row.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, padding: "2px 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, color: "#0f1729" }}>{row.name}</span>
                </div>
                <span style={{ color: "#8892a4" }}>{formatIDR(row.wonRevenue)} ({share.toFixed(0)}%)</span>
              </div>
            )
          })}
        </div>
      )}
    </SectionCard>
  )
}

// ─── 6. Goal Trend Widget ───────────────────────────────────────────────────

interface TrendEntry { label: string; attainment: number; target: number }

export function GoalTrendWidget() {
  const { activeCompany } = useCompany()
  const data = useGoalData()
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

      for (const lead of (leads ?? []) as Array<{ id: number; actual_value: number | null; event_date_end: string | null; event_date_start: string | null; closed_won_date: string | null; pipeline_stage: { closed_status: string | null } | null }>) {
        const dateStr = goal.attribution_basis === "closed_won_date" ? lead.closed_won_date : (lead.event_date_end ?? lead.event_date_start)
        if (!dateStr) continue
        const d = new Date(dateStr)
        if (isNaN(d.getTime())) continue
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        if (!monthMap.has(key)) continue
        monthMap.get(key)!.push({ id: lead.id, actual_value: lead.actual_value, is_closed_won: lead.pipeline_stage?.closed_status === "won" })
      }

      const trendData: TrendEntry[] = Array.from(monthMap.entries()).map(([key, monthLeads]) => {
        const [year, month] = key.split("-")
        const label = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("id-ID", { month: "short", year: "2-digit" })
        const { total } = calculateAttainmentV2(monthLeads)
        return { label, attainment: total, target: goal.target_amount / 12 }
      })

      setEntries(trendData)
      setLoading(false)
    }

    fetchTrend()
  }, [data.goal, activeCompany?.id])

  const maxVal = Math.max(...entries.map((e) => Math.max(e.attainment, e.target, 1)), 1)

  return (
    <SectionCard>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
        <BarChart3 style={{ width: 13, height: 13, color: "#8892a4" }} />
        <SectionTitle>Historical Trend</SectionTitle>
      </div>
      <SectionSub>Monthly attainment (last 12 months)</SectionSub>
      {data.loading || loading ? (
        <LoadingDot />
      ) : !data.goal ? (
        <NoGoalData />
      ) : entries.length === 0 ? (
        <div style={{ fontSize: 11, color: "#8892a4" }}>No trend data.</div>
      ) : (
        <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 4, minHeight: 100 }}>
          {entries.map((entry, i) => {
            const attH = (entry.attainment / maxVal) * 100
            const tgtH = (entry.target / maxVal) * 100
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height: 80 }}>
                  <div style={{ width: 10, borderRadius: "3px 3px 0 0", background: "#10b981", height: `${attH}%`, transition: "height 0.4s ease" }} title={`Attainment: ${formatIDR(entry.attainment)}`} />
                  <div style={{ width: 10, borderRadius: "3px 3px 0 0", background: "#cbd5e1", height: `${tgtH}%`, transition: "height 0.4s ease" }} title={`Target: ${formatIDR(entry.target)}`} />
                </div>
                <span style={{ fontSize: 9, color: "#8892a4" }}>{entry.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </SectionCard>
  )
}
