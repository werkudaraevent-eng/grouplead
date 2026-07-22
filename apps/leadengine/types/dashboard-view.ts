import type { LayoutItem } from "react-grid-layout"
import type { WidgetId } from "@/features/leads/lib/dashboard-layout"

/**
 * A saved dashboard filter snapshot.
 * Captures the header filter state so restoring a view also restores what
 * slice of data the user was looking at.
 *
 * All fields are optional for forward-compatibility — future filter additions
 * won't invalidate existing saved views.
 */
export interface DashboardFiltersSnapshot {
  /** Main period selector value: "this_month" | "this_quarter" | "this_year" | "all_time" | "custom" */
  period?: string
  customStart?: string
  customEnd?: string
  /** Holding-view company filter. "all" means all companies. */
  companyFilter?: string
  /** Revenue chart basis: "revenue_recognition" | "closed_won" */
  revenueBasis?: string
  /** Classification chart toggle (field id, e.g. "category"). */
  catToggle?: string
  /** Stream chart toggle (field id, e.g. "main_stream"). */
  streamToggle?: string
  /** @deprecated Legacy field. The revenue chart now fixes its main series
   *  to the current year and uses `compareYear` for the optional overlay. */
  trendYear?: number
  /** Optional historical year overlaid on the revenue chart. `null`/absent
   *  means no comparison (default). Only years with real revenue data appear
   *  in the picker. */
  compareYear?: number | null
  /** Active pipeline id for stage-based widgets (Pipeline Funnel etc.). */
  pipelineId?: string
}

/**
 * A saved, named dashboard view owned by a single user.
 * Represents one complete dashboard configuration the user can switch to.
 */
export interface DashboardView {
  id: string
  user_id: string
  name: string
  layout_data: LayoutItem[]
  hidden_widgets: WidgetId[]
  filters: DashboardFiltersSnapshot
  is_default: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

/**
 * Payload used when creating or updating a view.
 * `id` is only present for updates.
 */
export interface DashboardViewInput {
  id?: string
  name: string
  layout_data: LayoutItem[]
  hidden_widgets: WidgetId[]
  filters: DashboardFiltersSnapshot
  is_default?: boolean
}
