// ── New Core Entities (V2) ──

export interface BreakdownLevelConfig {
  field: string   // lead field key or "segment:{segmentId}"
  label: string   // display name
}

export interface BreakdownTargets {
  [fieldValue: string]: {
    _target: number
    [childFieldValue: string]: BreakdownTargets[string] | number
  }
}

export interface GoalV2 {
  id: string
  created_at: string
  updated_at: string
  company_id: string
  name: string
  slug: string
  period_type: 'monthly' | 'quarterly' | 'yearly'
  target_amount: number
  is_active: boolean
  attribution_basis: 'event_date' | 'closed_won_date'
  monthly_cutoff_day: number
  per_month_cutoffs: Record<string, number> | null
  weighted_forecast_enabled: boolean
  breakdown_config: BreakdownLevelConfig[]
  breakdown_targets: BreakdownTargets
  monthly_weights: MonthlyWeights | null
  created_by: string | null
  period_start: string | null
  period_end: string | null
}

export type GoalV2Insert = Omit<GoalV2, 'id' | 'created_at' | 'updated_at' | 'slug'> & { slug?: string }
export type GoalV2Update = Partial<Omit<GoalV2Insert, 'company_id'>>

export interface SegmentMappingEntry {
  segment_name: string
  match_values: string[]
}

export interface GoalSegment {
  id: string
  created_at: string
  updated_at: string
  company_id: string
  name: string
  source_field: string
  fallback_name: string
  mappings: SegmentMappingEntry[]
}

export type GoalSegmentInsert = Omit<GoalSegment, 'id' | 'created_at' | 'updated_at'>
export type GoalSegmentUpdate = Partial<Omit<GoalSegmentInsert, 'company_id'>>

export interface GoalUserTarget {
  id: string
  created_at: string
  updated_at: string
  goal_id: string
  user_id: string
  company_id: string
  period_start: string
  period_end: string
  target_amount: number
  node_id: string | null
}

export type GoalUserTargetInsert = Omit<GoalUserTarget, 'id' | 'created_at' | 'updated_at'>
export type GoalUserTargetUpdate = Partial<Pick<GoalUserTarget, 'target_amount' | 'period_start' | 'period_end' | 'node_id'>>

export interface StageWeightsMap {
  [pipelineId: string]: {
    [stageId: string]: number  // weight_percent 0-100
  }
}

export interface GoalSettingsV2 {
  id: string
  created_at: string
  updated_at: string
  company_id: string
  reporting_critical_fields: string[]
  auto_lock_enabled: boolean
  auto_lock_day_offset: number
  stage_weights: StageWeightsMap
  /** Target lead conversion rate (%). e.g. 30 = 30% */
  conversion_target_pct: number | null
}

export type GoalSettingsV2Update = Partial<Pick<GoalSettingsV2,
  'reporting_critical_fields' | 'auto_lock_enabled' | 'auto_lock_day_offset' | 'stage_weights' | 'conversion_target_pct'
>>

// ── Saved Views (unchanged) ──

export interface SavedView {
  id: string
  created_at: string
  updated_at: string
  company_id: string
  user_id: string
  name: string
  is_shared: boolean
  view_config: SavedViewConfig
}

export interface SavedViewConfig {
  goal_id: string | null
  company_id_filter: string | null
  attribution_basis: string | null
  filters: Record<string, string[]>
  widget_order: string[]
}

export type SavedViewInsert = Omit<SavedView, 'id' | 'created_at' | 'updated_at'>
export type SavedViewUpdate = Partial<Pick<SavedView, 'name' | 'is_shared' | 'view_config'>>

// ── Attribution Settings (references GoalV2 fields) ──

export interface AttributionSettings {
  attribution_basis: 'event_date' | 'closed_won_date'
  monthly_cutoff_day: number
  per_month_cutoffs: Record<string, number> | null
}

// ── Engine Input Types (unchanged) ──

export interface LeadClassificationInput {
  id: number
  company_id: string
  pic_sales_id: string | null
  line_industry: string | null
  category: string | null
  lead_source: string | null
  [key: string]: unknown  // dynamic field access
}

export interface LeadAttributionInput {
  id: number
  event_date_start: string | null
  event_date_end: string | null
  closed_won_date: string | null
}

export interface LeadAttainmentInput {
  id: number
  actual_value: number | null
  is_closed_won: boolean
}

export interface LeadForecastInput {
  id: number
  estimated_value: number | null
  actual_value: number | null
  stage_id: string
  is_closed_won: boolean
  is_lost: boolean
}

// ── Overlap Warning (moved from classification-engine) ──

export interface OverlapWarning {
  value: string
  segments: string[]
}

// ── Goal Node Types (recursive tree) ──

export type AllocationMode = 'percentage' | 'absolute'

/** Monthly weight distribution — keys "1"-"12", values are decimal fractions summing to 1.0 */
export type MonthlyWeights = Record<string, number>

/** Per-node monthly target overrides — keys "1"-"12", values are absolute amounts */
export type MonthlyTargets = Record<string, number>

export interface GoalNode {
  id: string
  created_at: string
  updated_at: string
  goal_id: string
  parent_node_id: string | null
  name: string
  dimension_type: string
  reference_field: string
  reference_value: string
  allocation_mode: AllocationMode
  percentage: number | null
  target_amount: number
  monthly_targets: MonthlyTargets | null
  sort_order: number
  company_id: string
}

export type GoalNodeInsert = Omit<GoalNode, 'id' | 'created_at' | 'updated_at'>
export type GoalNodeUpdate = Partial<Omit<GoalNodeInsert, 'goal_id' | 'company_id'>>

/** In-memory tree representation for recursive rendering */
export interface GoalNodeTree extends GoalNode {
  children: GoalNodeTree[]
  attainment?: number
  forecast_raw?: number
  forecast_weighted?: number
}
