import type { Layout, LayoutItem } from "react-grid-layout"
import { createClient } from "@/utils/supabase/client"

// ─── Widget Registry ────────────────────────────────────────────────────────
export const WIDGET_IDS = [
  "kpi-total-leads",
  "kpi-won-revenue",
  "kpi-deal-win-rate",
  "kpi-lead-conversion",
  "kpi-avg-deal-size",
  "kpi-pipeline-value",
  "revenue-chart",
  "pipeline",
  "sales-perf",
  "top-revenue",
  "lead-source",
  "classification",
  "stream",
  "contact-analytics",
  "goal-attainment",
  "goal-forecast",
  "goal-variance",
  "goal-company-breakdown",
  "goal-segment-breakdown",
  "goal-trend",
] as const

export type WidgetId = (typeof WIDGET_IDS)[number]

export const WIDGET_LABELS: Record<WidgetId, string> = {
  "kpi-total-leads": "Total Leads",
  "kpi-won-revenue": "Won Revenue",
  "kpi-deal-win-rate": "Deal Win Rate",
  "kpi-lead-conversion": "Lead Conversion",
  "kpi-avg-deal-size": "Avg Deal Size",
  "kpi-pipeline-value": "Pipeline Value",
  "revenue-chart": "Monthly Revenue vs Target",
  "pipeline": "Pipeline Stages",
  "sales-perf": "Sales Performance",
  "top-revenue": "Top Revenue Generators",
  "lead-source": "Lead Source",
  "classification": "Lead Classification",
  "stream": "Stream Alignment",
  "contact-analytics": "Top Contacts by Revenue",
  "goal-attainment": "Goal Attainment vs Target",
  "goal-forecast": "Weighted Forecast",
  "goal-variance": "Variance / Gap Indicators",
  "goal-company-breakdown": "Goal Breakdown by Company",
  "goal-segment-breakdown": "Goal Breakdown by Segment",
  "goal-trend": "Historical Goal Trend",
}

// ─── Grid Constants ─────────────────────────────────────────────────────────
// ALWAYS 12 columns, locked. No breakpoint switching.
export const GRID_COLS = 12
export const GRID_ROW_HEIGHT = 50



// ─── Default Hidden Widgets ─────────────────────────────────────────────────
// Goal widgets and contact analytics are hidden by default because they
// require goal configuration to be useful. Users can add them via the
// "Add Widget" gallery.
export const DEFAULT_HIDDEN_WIDGETS: WidgetId[] = [
  "contact-analytics",
  "goal-attainment",
  "goal-forecast",
  "goal-variance",
  "goal-company-breakdown",
  "goal-segment-breakdown",
  "goal-trend",
]

export function getDefaultLayout(): Layout {
  // Layout grid: 12 cols, rowHeight 50px, margin 10px
  // Height formula: px = (h * 50) + ((h - 1) * 10)
  //   h:2 = 110px | h:3 = 170px | h:6 = 350px | h:7 = 410px
  //
  // Visual map (default visible widgets only):
  //
  // Row 0-1:  [KPI:2] [KPI:3] [KPI:2] [KPI:2] [KPI:3]     ← 5 KPI cards
  // Row 2-8:  [Revenue Chart ........:8w,7h] [Pipeline:4w,7h]
  // Row 9-15: [Sales Perf .....:6w,7h] [Top Revenue:6w,7h]
  // Row 16-21:[LeadSrc:4w,6h] [Classif:4w,6h] [Stream:4w,6h]
  //
  // No overlaps. Every row boundary is clean.

  return [
    // ── Row 0: KPI Cards ── h:2 = 110px, 6 cards × 2 cols = 12
    { i: "kpi-total-leads",    x: 0,  y: 0, w: 2, h: 2, minW: 2, minH: 2, maxW: 4, maxH: 3 },
    { i: "kpi-won-revenue",    x: 2,  y: 0, w: 2, h: 2, minW: 2, minH: 2, maxW: 4, maxH: 3 },
    { i: "kpi-deal-win-rate",  x: 4,  y: 0, w: 2, h: 2, minW: 2, minH: 2, maxW: 4, maxH: 3 },
    { i: "kpi-lead-conversion",x: 6,  y: 0, w: 2, h: 2, minW: 2, minH: 2, maxW: 4, maxH: 3 },
    { i: "kpi-avg-deal-size",  x: 8,  y: 0, w: 2, h: 2, minW: 2, minH: 2, maxW: 4, maxH: 3 },
    { i: "kpi-pipeline-value", x: 10, y: 0, w: 2, h: 2, minW: 2, minH: 2, maxW: 4, maxH: 3 },

    // ── Row 1: Primary Charts ── both h:7 = 410px, same height, no overlap
    { i: "revenue-chart",      x: 0, y: 2, w: 8, h: 7, minW: 4, minH: 4, maxH: 12 },
    { i: "pipeline",           x: 8, y: 2, w: 4, h: 7, minW: 3, minH: 4, maxH: 12 },

    // ── Row 2: Secondary Charts ── both h:7, equal width (6+6=12)
    { i: "sales-perf",         x: 0, y: 9, w: 6, h: 7, minW: 4, minH: 4, maxH: 12 },
    { i: "top-revenue",        x: 6, y: 9, w: 6, h: 7, minW: 3, minH: 4, maxH: 12 },

    // ── Row 3: Distribution Charts ── 3 equal columns (4+4+4=12)
    { i: "lead-source",        x: 0, y: 16, w: 4, h: 6, minW: 3, minH: 3, maxH: 10 },
    { i: "classification",     x: 4, y: 16, w: 4, h: 6, minW: 3, minH: 3, maxH: 10 },
    { i: "stream",             x: 8, y: 16, w: 4, h: 6, minW: 3, minH: 3, maxH: 10 },

    // ── Hidden by default (goal & contact widgets) ──
    // These still need layout entries so they have positions when un-hidden.
    { i: "contact-analytics",       x: 0, y: 22, w: 6, h: 6, minW: 4, minH: 3, maxH: 10 },
    { i: "goal-attainment",         x: 6, y: 22, w: 3, h: 6, minW: 3, minH: 3, maxH: 10 },
    { i: "goal-forecast",           x: 9, y: 22, w: 3, h: 6, minW: 3, minH: 3, maxH: 10 },
    { i: "goal-variance",           x: 0, y: 28, w: 4, h: 6, minW: 3, minH: 3, maxH: 10 },
    { i: "goal-company-breakdown",  x: 4, y: 28, w: 4, h: 6, minW: 3, minH: 3, maxH: 10 },
    { i: "goal-segment-breakdown",  x: 8, y: 28, w: 4, h: 6, minW: 3, minH: 3, maxH: 10 },
    { i: "goal-trend",              x: 0, y: 34, w: 12, h: 6, minW: 6, minH: 3, maxH: 10 },
  ]
}

// ─── Local Storage (fast fallback) ──────────────────────────────────────────
const LS_KEY = "dashboard-layout-v10" // v10: fixed overlap, curated defaults, maxW/maxH constraints

export function saveLayoutToLocal(layout: Layout | LayoutItem[]) {
  try {
    const items = Array.isArray(layout) ? layout : [...layout]
    localStorage.setItem(LS_KEY, JSON.stringify(items))
  } catch { /* quota exceeded */ }
}

export function loadLayoutFromLocal(): LayoutItem[] | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)

    // Accept both plain array and versioned wrapper { version, items }
    if (Array.isArray(parsed)) return parsed as LayoutItem[]
    if (parsed && typeof parsed === "object" && "items" in parsed && Array.isArray(parsed.items)) {
      return parsed.items as LayoutItem[]
    }
    return null
  } catch {
    return null
  }
}

export function clearLocalLayout() {
  try { localStorage.removeItem(LS_KEY) } catch { /* noop */ }
}

// ─── Hidden Widgets Persistence ─────────────────────────────────────────────
const LS_HIDDEN_KEY = "dashboard-hidden-widgets-v1"

export function saveHiddenToLocal(hidden: WidgetId[]) {
  try {
    localStorage.setItem(LS_HIDDEN_KEY, JSON.stringify(hidden))
  } catch { /* quota exceeded */ }
}

export function loadHiddenFromLocal(): WidgetId[] | null {
  try {
    const raw = localStorage.getItem(LS_HIDDEN_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function clearHiddenLocal() {
  try { localStorage.removeItem(LS_HIDDEN_KEY) } catch { /* noop */ }
}

// ─── Supabase Persistence (per-user) ────────────────────────────────────────
export async function saveLayoutToSupabase(
  layout: Layout | LayoutItem[],
  hiddenWidgets?: WidgetId[],
): Promise<boolean> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const payload: Record<string, unknown> = {
      user_id: user.id,
      layout_data: Array.isArray(layout) ? layout : [...layout],
    }
    if (hiddenWidgets !== undefined) {
      payload.hidden_widgets = hiddenWidgets
    }

    const { error } = await supabase
      .from("user_dashboard_layouts")
      .upsert(payload, { onConflict: "user_id" })

    return !error
  } catch {
    return false
  }
}

export async function loadLayoutFromSupabase(): Promise<{
  layout: LayoutItem[] | null
  hiddenWidgets: WidgetId[] | null
}> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { layout: null, hiddenWidgets: null }

    const { data, error } = await supabase
      .from("user_dashboard_layouts")
      .select("layout_data, hidden_widgets")
      .eq("user_id", user.id)
      .single()

    if (error || !data) return { layout: null, hiddenWidgets: null }

    // Accept both plain array and versioned wrapper { version, items }
    const raw = data.layout_data as any
    let layoutItems: LayoutItem[] | null = null

    if (Array.isArray(raw)) {
      layoutItems = raw as LayoutItem[]
    } else if (raw && typeof raw === "object" && "items" in raw && Array.isArray(raw.items)) {
      layoutItems = raw.items as LayoutItem[]
    }

    return {
      layout: layoutItems,
      hiddenWidgets: (data.hidden_widgets as WidgetId[] | null) ?? null,
    }
  } catch {
    return { layout: null, hiddenWidgets: null }
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
