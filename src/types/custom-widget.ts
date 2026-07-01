export interface CustomWidget {
  id: string
  user_id: string
  company_id: string | null
  title: string
  widget_type: 'kpi' | 'bar' | 'pie' | 'list'
  metric_field: '_count' | 'actual_value' | 'estimated_value' | 'pax_count'
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
  }
  created_at: string
  updated_at: string
}

export type CustomWidgetInput = Omit<CustomWidget, 'id' | 'user_id' | 'created_at' | 'updated_at'>
