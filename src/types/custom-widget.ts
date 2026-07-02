// ─── Custom formula metric ───────────────────────────────────────────────────
// A user-built metric expressed as numerator ÷ denominator, where each side is
// one "measure". Lets users define ratios like win-rate-by-revenue without a
// hardcoded metric. KPI cards only.

/** Which subset of leads a measure counts. */
export type FormulaCondition = 'all' | 'won' | 'lost' | 'active' | 'closed'

/** A single aggregated quantity: aggregation(field) over `condition` leads,
 *  optionally narrowed to one value of a dimension. */
export interface FormulaMeasure {
  /** 'count' ignores `field`; 'sum' totals the chosen value field. */
  aggregation: 'count' | 'sum'
  /** Value field to sum. '_deal_value' auto-resolves won→actual, lost→estimated. */
  field?: '_deal_value' | 'actual_value' | 'estimated_value' | 'pax_count'
  /** Lead subset this measure counts. */
  condition: FormulaCondition
  /** Optional extra narrowing: only leads whose `field` equals `value`. */
  filter?: { field: string; value: string }
}

/** numerator ÷ denominator, formatted per `format`. denominator omitted = ÷1. */
export interface FormulaConfig {
  numerator: FormulaMeasure
  denominator?: FormulaMeasure | null
  /** How the final number is displayed. */
  format: 'percent' | 'number' | 'currency' | 'multiplier'
}

export interface CustomWidget {
  id: string
  user_id: string
  company_id: string | null
  title: string
  widget_type: 'kpi' | 'bar' | 'pie' | 'list'
  /** Preset metric key, or '_formula' when a custom formula (config.formula)
   *  drives the value. Widened to string since the engine accepts computed
   *  metric keys like '_win_rate', '_avg_deal_size', etc. */
  metric_field: '_count' | 'actual_value' | 'estimated_value' | 'pax_count' | '_formula' | string
  aggregation: 'count' | 'sum' | 'avg'
  group_by: string | null
  config: {
    limit?: number
    color?: string
    sort?: 'asc' | 'desc'
    /**
     * Optional interactive filter. When set, the rendered widget shows a
     * dropdown in its header letting the viewer narrow the data to one value
     * of `field` before aggregation (e.g. field="segment_tier" to switch
     * between Main / Secondary segments). The selection is ephemeral — it
     * resets to `defaultValue` (or "All") on reload.
     */
    filter?: {
      field: string
      label: string
      defaultValue?: string | null
    }
    /**
     * Optional secondary metric shown in the KPI card footer, computed
     * independently from the main metric (same period + interactive filter).
     * Lets a card pair e.g. a Win Rate % headline with a raw project count
     * underneath. `label` overrides the auto-generated caption.
     */
    footer?: {
      metric_field: string
      aggregation: 'count' | 'sum' | 'avg'
      label?: string
    }
    /**
     * Optional user-defined formula metric (numerator ÷ denominator). When set
     * AND metric_field === '_formula', the KPI value is computed from this
     * instead of the preset metric. KPI cards only.
     */
    formula?: FormulaConfig
    /**
     * Optional explanation shown in a hover tooltip (ⓘ icon) on the KPI card,
     * e.g. to describe how the metric is calculated or where the data comes
     * from. Plain text. KPI cards only.
     */
    tooltip?: string
  }
  created_at: string
  updated_at: string
}

export type CustomWidgetInput = Omit<CustomWidget, 'id' | 'user_id' | 'created_at' | 'updated_at'>
