/**
 * Lead Field Registry — single source of truth for analyzable lead fields.
 *
 * Each entry defines the field key, display label, value source, and whether
 * the field supports segmentation. The registry is consumed by Goal Breakdown,
 * Segment Settings, Dashboard Widgets, and the Registry Settings UI.
 */

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
