import type { Layout, LayoutItem } from "react-grid-layout"
import { createClient } from "@/utils/supabase/client"

// ─── Widget Registry ────────────────────────────────────────────────────────
export const WIDGET_IDS = [
  "kpi-incoming-lead",
  "kpi-lead-events",
  "kpi-lead-conversion",
  "kpi-won",
  "kpi-lost",
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
  "kpi-incoming-lead": "Incoming Lead",
  "kpi-lead-events": "Lead Events",
  "kpi-lead-conversion": "Lead Conversion",
  "kpi-won": "Won",
  "kpi-lost": "Lost",
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
  //   h:3 = 170px | h:6 = 350px | h:7 = 410px
  //
  // Visual map (default visible widgets only):
  //
  // Row 0-2:  [KPI:3] [KPI:3] [KPI:2] [KPI:2] [KPI:2]     ← 5 KPI cards
  // Row 3-9:  [Revenue Chart ........:8w,7h] [Pipeline:4w,7h]
  // Row 10-16:[Sales Perf .....:6w,7h] [Top Revenue:6w,7h]
  // Row 17-22:[LeadSrc:4w,6h] [Classif:4w,6h] [Stream:4w,6h]
  //
  // No overlaps. Every row boundary is clean.
  //
  // KPI cards are h:3 (not h:2) because each now carries a hero number plus
  // a supporting metrics line (total value + average) under it.

  return [
    // ── Row 0: KPI Cards ── h:3 = 170px, widths 3+3+2+2+2 = 12
    // minH:2 so cards can be shrunk in edit mode; maxH:4 caps the stretch.
    { i: "kpi-incoming-lead",  x: 0,  y: 0, w: 3, h: 3, minW: 2, minH: 2, maxW: 4, maxH: 4 },
    { i: "kpi-lead-events",    x: 3,  y: 0, w: 3, h: 3, minW: 2, minH: 2, maxW: 4, maxH: 4 },
    { i: "kpi-lead-conversion",x: 6,  y: 0, w: 2, h: 3, minW: 2, minH: 2, maxW: 4, maxH: 4 },
    { i: "kpi-won",            x: 8,  y: 0, w: 2, h: 3, minW: 2, minH: 2, maxW: 4, maxH: 4 },
    { i: "kpi-lost",           x: 10, y: 0, w: 2, h: 3, minW: 2, minH: 3, maxW: 4, maxH: 4 },

    // ── Row 1: Primary Charts ── both h:7 = 410px, same height, no overlap
    { i: "revenue-chart",      x: 0, y: 3, w: 8, h: 7, minW: 4, minH: 4, maxH: 12 },
    { i: "pipeline",           x: 8, y: 3, w: 4, h: 7, minW: 3, minH: 4, maxH: 12 },

    // ── Row 2: Secondary Charts ── both h:7, equal width (6+6=12)
    { i: "sales-perf",         x: 0, y: 10, w: 6, h: 7, minW: 4, minH: 4, maxH: 12 },
    { i: "top-revenue",        x: 6, y: 10, w: 6, h: 7, minW: 3, minH: 4, maxH: 12 },

    // ── Row 3: Distribution Charts ── 3 equal columns (4+4+4=12)
    { i: "lead-source",        x: 0, y: 17, w: 4, h: 6, minW: 3, minH: 3, maxH: 10 },
    { i: "classification",     x: 4, y: 17, w: 4, h: 6, minW: 3, minH: 3, maxH: 10 },
    { i: "stream",             x: 8, y: 17, w: 4, h: 6, minW: 3, minH: 3, maxH: 10 },

    // ── Hidden by default (goal & contact widgets) ──
    // These still need layout entries so they have positions when un-hidden.
    { i: "contact-analytics",       x: 0, y: 23, w: 6, h: 6, minW: 4, minH: 3, maxH: 10 },
    { i: "goal-attainment",         x: 6, y: 23, w: 3, h: 6, minW: 3, minH: 3, maxH: 10 },
    { i: "goal-forecast",           x: 9, y: 23, w: 3, h: 6, minW: 3, minH: 3, maxH: 10 },
    { i: "goal-variance",           x: 0, y: 29, w: 4, h: 6, minW: 3, minH: 3, maxH: 10 },
    { i: "goal-company-breakdown",  x: 4, y: 29, w: 4, h: 6, minW: 3, minH: 3, maxH: 10 },
    { i: "goal-segment-breakdown",  x: 8, y: 29, w: 4, h: 6, minW: 3, minH: 3, maxH: 10 },
    { i: "goal-trend",              x: 0, y: 35, w: 12, h: 6, minW: 6, minH: 3, maxH: 10 },
  ]
}

// ─── Custom Widget Size Presets ─────────────────────────────────────────────
// Type-aware sizing for user-built custom widgets, mirroring how mature
// dashboard platforms (Zoho Analytics, Salesforce Lightning) constrain each
// widget kind differently instead of using one global minimum:
//
//   • KPI  — a single hero number. Shrinks to the same compact 2×2 floor as the
//            built-in KPI cards; capped short (maxH:4) since extra height is
//            just whitespace. Wide banner KPIs are allowed (maxW:6).
//   • Bar/List — need vertical room for rows + horizontal room for category
//            labels, so a 3×3 floor. Tall stretch allowed for long lists.
//   • Pie  — donut + legend needs a squarer minimum footprint (3×3).
//
// The content itself is already responsive: SingleKPIWidget uses container
// queries (font clamps + sparkline hides < 170px) and the chart renderers use
// Recharts ResponsiveContainer, so shrinking a widget reflows its contents
// rather than clipping them.
export type CustomWidgetType = 'kpi' | 'bar' | 'pie' | 'list'

export interface WidgetSizePreset {
  w: number
  h: number
  minW: number
  minH: number
  maxW: number
  maxH: number
}

export const CUSTOM_WIDGET_SIZE_PRESETS: Record<CustomWidgetType, WidgetSizePreset> = {
  // Matches the built-in KPI cards: 2×2 min, 3×3 default, capped short.
  kpi:  { w: 3, h: 3, minW: 2, minH: 2, maxW: 6,  maxH: 4  },
  bar:  { w: 4, h: 5, minW: 3, minH: 3, maxW: 12, maxH: 12 },
  pie:  { w: 4, h: 5, minW: 3, minH: 3, maxW: 12, maxH: 10 },
  list: { w: 5, h: 5, minW: 3, minH: 3, maxW: 12, maxH: 12 },
}

/** Resolve the size preset for a custom widget type. Falls back to the compact
 *  KPI preset for unknown types. */
export function getCustomWidgetSize(type: CustomWidgetType | string | null | undefined): WidgetSizePreset {
  return CUSTOM_WIDGET_SIZE_PRESETS[(type as CustomWidgetType)] ?? CUSTOM_WIDGET_SIZE_PRESETS.kpi
}

// ─── Local Storage (fast fallback) ──────────────────────────────────────────
const LS_KEY = "dashboard-layout-v11" // v11: 5 KPI cards (incoming/events/conversion/won/lost), taller h:3

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
