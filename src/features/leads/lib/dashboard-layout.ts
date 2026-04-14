import type { Layout, LayoutItem } from "react-grid-layout"
import { createClient } from "@/utils/supabase/client"

// ─── Widget Registry ────────────────────────────────────────────────────────
export const WIDGET_IDS = [
  "kpi-total-leads",
  "kpi-won-revenue",
  "kpi-deal-win-rate",
  "kpi-lead-conversion",
  "kpi-avg-deal-size",
  "revenue-chart",
  "pipeline",
  "sales-perf",
  "top-revenue",
  "lead-source",
  "classification",
  "stream",
] as const

export type WidgetId = (typeof WIDGET_IDS)[number]

export const WIDGET_LABELS: Record<WidgetId, string> = {
  "kpi-total-leads": "Total Leads",
  "kpi-won-revenue": "Won Revenue",
  "kpi-deal-win-rate": "Deal Win Rate",
  "kpi-lead-conversion": "Lead Conversion",
  "kpi-avg-deal-size": "Avg Deal Size",
  "revenue-chart": "Monthly Revenue vs Target",
  "pipeline": "Pipeline Stages",
  "sales-perf": "Sales Performance",
  "top-revenue": "Top Revenue Generators",
  "lead-source": "Lead Source",
  "classification": "Lead Classification",
  "stream": "Stream Alignment",
}

// ─── Grid Constants ─────────────────────────────────────────────────────────
// ALWAYS 12 columns, locked. No breakpoint switching.
export const GRID_COLS = 12
export const GRID_ROW_HEIGHT = 60

export function getDefaultLayout(): Layout {
  return [
    // KPI Cards — 5 individual cards across the top row (2+3+2+2+3 = 12)
    { i: "kpi-total-leads",    x: 0,  y: 0, w: 2, h: 2, minW: 2, minH: 2 },
    { i: "kpi-won-revenue",    x: 2,  y: 0, w: 3, h: 2, minW: 2, minH: 2 },
    { i: "kpi-deal-win-rate",  x: 5,  y: 0, w: 2, h: 2, minW: 2, minH: 2 },
    { i: "kpi-lead-conversion",x: 7,  y: 0, w: 2, h: 2, minW: 2, minH: 2 },
    { i: "kpi-avg-deal-size",  x: 9,  y: 0, w: 3, h: 2, minW: 2, minH: 2 },
    // Chart widgets
    { i: "revenue-chart",  x: 0,  y: 2,  w: 8,  h: 5, minW: 4,  minH: 3 },
    { i: "pipeline",       x: 8,  y: 2,  w: 4,  h: 5, minW: 3,  minH: 3 },
    { i: "sales-perf",     x: 0,  y: 7,  w: 7,  h: 5, minW: 4,  minH: 3 },
    { i: "top-revenue",    x: 7,  y: 7,  w: 5,  h: 5, minW: 3,  minH: 3 },
    { i: "lead-source",    x: 0,  y: 12, w: 4,  h: 5, minW: 3,  minH: 3 },
    { i: "classification", x: 4,  y: 12, w: 4,  h: 5, minW: 3,  minH: 3 },
    { i: "stream",         x: 8,  y: 12, w: 4,  h: 5, minW: 3,  minH: 3 },
  ]
}

// ─── Local Storage (fast fallback) ──────────────────────────────────────────
const LS_KEY = "dashboard-layout-v7" // v7: rolled back from CSS Grid, fresh RGL state

export function saveLayoutToLocal(layout: Layout | LayoutItem[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(layout))
  } catch { /* quota exceeded */ }
}

export function loadLayoutFromLocal(): LayoutItem[] | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function clearLocalLayout() {
  try { localStorage.removeItem(LS_KEY) } catch { /* noop */ }
}

// ─── Supabase Persistence (per-user) ────────────────────────────────────────
export async function saveLayoutToSupabase(layout: Layout | LayoutItem[]): Promise<boolean> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const { error } = await supabase
      .from("user_dashboard_layouts")
      .upsert({
        user_id: user.id,
        layout_data: layout,
      }, { onConflict: "user_id" })

    return !error
  } catch {
    return false
  }
}

export async function loadLayoutFromSupabase(): Promise<LayoutItem[] | null> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from("user_dashboard_layouts")
      .select("layout_data")
      .eq("user_id", user.id)
      .single()

    if (error || !data) return null
    return data.layout_data as LayoutItem[]
  } catch {
    return null
  }
}

export async function resetLayoutInSupabase(): Promise<boolean> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    await supabase
      .from("user_dashboard_layouts")
      .delete()
      .eq("user_id", user.id)

    return true
  } catch {
    return false
  }
}
