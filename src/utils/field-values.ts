import { LEAD_FIELD_REGISTRY, type LeadFieldEntry } from '@/config/lead-field-registry'
import type { LeadFieldSetting } from '@/types'

export interface FieldValue {
  id: string
  label: string
  value: string
}

/**
 * Fetch possible values for a registered lead field from the appropriate source table.
 */
export async function fetchFieldValues(
  supabase: any,
  fieldKey: string,
  companyId: string
): Promise<FieldValue[]> {
  const entry = LEAD_FIELD_REGISTRY.find((f) => f.key === fieldKey)
  if (!entry) return []

  const src = entry.valueSource

  switch (src.type) {
    case 'master_options': {
      const { data } = await supabase
        .from('master_options')
        .select('id, label, value')
        .eq('option_type', src.optionType)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      return (data ?? []).map((o: any) => ({
        id: String(o.id),
        label: o.label,
        value: o.value,
      }))
    }

    case 'leads_distinct': {
      const { data } = await supabase
        .from('leads')
        .select(src.column)
        .not(src.column, 'is', null)

      if (!data) return []
      const rawValues: string[] = data.map((r: any) => String(r[src.column] ?? '')).filter(Boolean)
      const unique = Array.from(new Set(rawValues)).sort()
      return unique.map((v) => ({ id: v, label: v, value: v }))
    }

    case 'profiles': {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('is_active', true)
        .order('full_name', { ascending: true })

      return (data ?? []).map((p: any) => ({
        id: p.id,
        label: p.full_name ?? 'Unknown',
        value: p.id,
      }))
    }

    case 'client_companies': {
      const { data } = await supabase
        .from('client_companies')
        .select('id, name')
        .order('name', { ascending: true })

      return (data ?? []).map((c: any) => ({
        id: c.id,
        label: c.name,
        value: c.id,
      }))
    }

    case 'client_company_field': {
      // First try master_options with matching optionType (column name)
      const { data: masterOpts } = await supabase
        .from('master_options')
        .select('id, label, value')
        .eq('option_type', src.column)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (masterOpts && masterOpts.length > 0) {
        return masterOpts.map((o: any) => ({
          id: String(o.id),
          label: o.label,
          value: o.value,
        }))
      }

      // Fallback: distinct values from client_companies column
      const { data } = await supabase
        .from('client_companies')
        .select(src.column)
        .not(src.column, 'is', null)

      if (!data) return []
      const rawValues: string[] = data.map((r: any) => String(r[src.column] ?? '')).filter(Boolean)
      const unique = Array.from(new Set(rawValues)).sort()
      return unique.map((v) => ({ id: v, label: v, value: v }))
    }

    case 'subsidiaries': {
      const { data } = await supabase
        .from('companies')
        .select('id, name')
        .eq('is_holding', false)
        .order('name', { ascending: true })

      return (data ?? []).map((c: any) => ({
        id: c.id,
        label: c.name,
        value: c.id,
      }))
    }

    default:
      return []
  }
}

/**
 * Merge the static Lead Field Registry with per-company overrides.
 * Fields without an override default to active.
 * Returns only active fields.
 */
export function getActiveFields(settings?: LeadFieldSetting[]): LeadFieldEntry[] {
  const overrideMap = new Map<string, LeadFieldSetting>()
  if (settings) {
    for (const s of settings) {
      overrideMap.set(s.field_key, s)
    }
  }

  return LEAD_FIELD_REGISTRY.filter((field) => {
    const override = overrideMap.get(field.key)
    // If there's an override, respect its is_active flag; otherwise default to active
    if (override) return override.is_active
    return true
  })
}

/**
 * Simple case-insensitive filter for field values by search string.
 */
export function filterFieldValues(values: FieldValue[], search: string): FieldValue[] {
  if (!search) return values
  const lower = search.toLowerCase()
  return values.filter((v) => v.label.toLowerCase().includes(lower))
}
