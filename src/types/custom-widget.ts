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
  }
  created_at: string
  updated_at: string
}

export type CustomWidgetInput = Omit<CustomWidget, 'id' | 'user_id' | 'created_at' | 'updated_at'>
