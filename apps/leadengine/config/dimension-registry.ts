/**
 * Unified Dimension Registry
 *
 * Single source of truth for all analyzable lead dimensions.
 * Auto-derives available dimensions from:
 *   1. Entity-based (hardcoded): Subsidiary, Sales Owner, Client Company
 *   2. Attribute-based (from master_options): Category, Area, etc.
 *   3. Segment-based (from goal_segments): custom segment groupings
 *
 * Replaces the old hardcoded LEAD_FIELD_REGISTRY.
 */

// ── Types ──

export type ValueSource =
  | { type: 'master_options'; optionType: string }
  | { type: 'leads_distinct'; column: string }
  | { type: 'profiles' }
  | { type: 'client_companies' }
  | { type: 'client_company_field'; column: string }
  | { type: 'subsidiaries' }

export interface LeadFieldEntry {
  key: string
  label: string
  valueSource: ValueSource
  isSystemDefault: boolean
  supportsSegmentation: boolean
}

export type DimensionGroup = 'entity' | 'lead_attribute' | 'company_attribute' | 'contact_attribute' | 'segment'

export interface DimensionOption {
  value: string
  label: string
  field: string
  group: DimensionGroup
  /** Number of active options available (for attribute-based) */
  optionCount?: number
}

// ── Entity Dimensions (compile-time, always available) ──

export const ENTITY_DIMENSIONS: DimensionOption[] = [
  { value: 'subsidiary', label: 'Subsidiary', field: 'company_id', group: 'entity' },
  { value: 'sales_owner', label: 'Sales Owner', field: 'pic_sales_id', group: 'entity' },
  { value: 'client_company', label: 'Client Company', field: 'client_company_id', group: 'entity' },
  { value: 'month', label: 'Month', field: 'month', group: 'entity' },
]

// ── Mapping from master_options option_type → lead field key ──
// Some lead field keys differ from the option_type name.
// This map ensures we use the correct lead column for attribution.

const OPTION_TYPE_TO_FIELD_KEY: Record<string, string> = {
  area: 'area',
  category: 'category',
  lead_source: 'lead_source',
  main_stream: 'main_stream',
  grade_lead: 'grade_lead',
  stream_type: 'stream_type',
  business_purpose: 'business_purpose',
  tipe: 'tipe',
  event_format: 'event_format',
  lost_reason: 'lost_reason',
  event_city: 'event_city',
  tentative_month: 'tentative_month',
  tentative_year: 'tentative_year',
  sector: 'sector',
  nationality: 'nationality',
  line_industry: 'line_industry',
  // Custom categories use their option_type as field key directly
}

// option_types that should NOT appear as goal hierarchy dimensions
const EXCLUDED_OPTION_TYPES = new Set([
  'status',
  'bu_revenue',
  'system_setting',
  'tentative_month',
  'tentative_year',
])

// option_types that belong to the Company module
const COMPANY_OPTION_TYPES = new Set([
  'sector',
  'line_industry',
  'area',
  'nationality',
])

// option_types that belong to the Contact module
const CONTACT_OPTION_TYPES = new Set<string>([
  // add contact-specific option_types here if any
])

/**
 * Classify an option_type into its module group.
 */
function classifyOptionType(optionType: string): DimensionGroup {
  if (optionType.startsWith('custom_companies__')) return 'company_attribute'
  if (optionType.startsWith('custom_contacts__')) return 'contact_attribute'
  if (COMPANY_OPTION_TYPES.has(optionType)) return 'company_attribute'
  if (CONTACT_OPTION_TYPES.has(optionType)) return 'contact_attribute'
  return 'lead_attribute'
}

/**
 * Format an option_type key into a human-readable label.
 * e.g. "main_stream" → "Main Stream", "custom_leads__event_scale" → "Event Scale"
 */
function formatOptionTypeLabel(key: string): string {
  // Strip custom prefix
  const labelKey = key.replace(/^custom_[a-z]+__/, '')
  return labelKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// ── Async Registry Builder ──

/**
 * Fetches the full dimension registry from the database.
 * Returns grouped, labeled dimensions for use in Goal hierarchy dropdowns.
 */
export async function getDimensionRegistry(
  supabase: any,
  companyId: string
): Promise<DimensionOption[]> {
  const result: DimensionOption[] = [...ENTITY_DIMENSIONS]

  // 1. Fetch attribute dimensions from master_options
  //    Get unique option_types with their active count
  const { data: optionTypes } = await supabase
    .from('master_options')
    .select('option_type')
    .eq('is_active', true)
    .or(`company_id.eq.${companyId},company_id.is.null`)

  if (optionTypes) {
    // Count per option_type
    const typeCountMap = new Map<string, number>()
    for (const row of optionTypes as { option_type: string }[]) {
      typeCountMap.set(row.option_type, (typeCountMap.get(row.option_type) ?? 0) + 1)
    }

    // Add each unique option_type as a dimension
    for (const [optionType, count] of typeCountMap) {
      if (EXCLUDED_OPTION_TYPES.has(optionType)) continue

      const fieldKey = OPTION_TYPE_TO_FIELD_KEY[optionType] ?? optionType
      const group = classifyOptionType(optionType)
      result.push({
        value: fieldKey,
        label: formatOptionTypeLabel(optionType),
        field: fieldKey,
        group,
        optionCount: count,
      })
    }
  }

  // 2. Fetch segment dimensions from goal_segments
  const { data: segments } = await supabase
    .from('goal_segments')
    .select('id, name')
    .eq('company_id', companyId)

  if (segments) {
    for (const seg of segments as { id: string; name: string }[]) {
      result.push({
        value: `segment:${seg.id}`,
        label: seg.name,
        field: 'segment',
        group: 'segment',
      })
    }
  }

  return result
}

// ── Backward Compatibility ──
// The old LEAD_FIELD_REGISTRY is still needed by internal modules
// (breakdown-utils, node-attribution, field-values) that do field-level
// resolution at runtime. We keep it but mark it as legacy.

export const LEAD_FIELD_REGISTRY: LeadFieldEntry[] = [
  { key: 'category', label: 'Category', valueSource: { type: 'master_options', optionType: 'category' }, isSystemDefault: true, supportsSegmentation: true },
  { key: 'lead_source', label: 'Lead Source', valueSource: { type: 'master_options', optionType: 'lead_source' }, isSystemDefault: true, supportsSegmentation: true },
  { key: 'main_stream', label: 'Main Stream', valueSource: { type: 'master_options', optionType: 'main_stream' }, isSystemDefault: true, supportsSegmentation: true },
  { key: 'grade_lead', label: 'Grade Lead', valueSource: { type: 'master_options', optionType: 'grade_lead' }, isSystemDefault: true, supportsSegmentation: true },
  { key: 'stream_type', label: 'Stream Type', valueSource: { type: 'master_options', optionType: 'stream_type' }, isSystemDefault: true, supportsSegmentation: true },
  { key: 'business_purpose', label: 'Business Purpose', valueSource: { type: 'master_options', optionType: 'business_purpose' }, isSystemDefault: true, supportsSegmentation: true },
  { key: 'tipe', label: 'Tipe', valueSource: { type: 'master_options', optionType: 'tipe' }, isSystemDefault: true, supportsSegmentation: true },
  { key: 'nationality', label: 'Nationality', valueSource: { type: 'master_options', optionType: 'nationality' }, isSystemDefault: true, supportsSegmentation: true },
  { key: 'sector', label: 'Sector', valueSource: { type: 'master_options', optionType: 'sector' }, isSystemDefault: true, supportsSegmentation: true },
  { key: 'line_industry', label: 'Line Industry', valueSource: { type: 'client_company_field', column: 'line_industry' }, isSystemDefault: true, supportsSegmentation: true },
  { key: 'area', label: 'Area', valueSource: { type: 'master_options', optionType: 'area' }, isSystemDefault: true, supportsSegmentation: true },
  { key: 'referral_source', label: 'Referral Source', valueSource: { type: 'leads_distinct', column: 'referral_source' }, isSystemDefault: true, supportsSegmentation: true },
  { key: 'event_format', label: 'Event Format', valueSource: { type: 'master_options', optionType: 'event_format' }, isSystemDefault: true, supportsSegmentation: true },
  { key: 'pic_sales_id', label: 'Sales Owner', valueSource: { type: 'profiles' }, isSystemDefault: true, supportsSegmentation: false },
  { key: 'client_company_id', label: 'Client Company', valueSource: { type: 'client_companies' }, isSystemDefault: true, supportsSegmentation: false },
  { key: 'company_id', label: 'Subsidiary', valueSource: { type: 'subsidiaries' }, isSystemDefault: true, supportsSegmentation: false },
]
