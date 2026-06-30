import type { Lead } from '@/types'

/**
 * Fields that exist on both `leads` and `client_companies`.
 * When the lead's own value is empty, we fall back to the client company's value.
 */
const CLIENT_COMPANY_FIELDS = new Set([
  'line_industry',
  'area',
  'sector',
  'nationality',
  'industry',
])

/**
 * Some fields use a different column name on `client_companies` than on
 * `leads`. The "Sector" dimension is stored as `sector` on a lead but as
 * `industry` on a client company (the UI labels `industry` as "Sector").
 * This maps the lead field key → the client_company column to read when
 * falling back to the company relation.
 */
const CLIENT_COMPANY_FIELD_ALIAS: Record<string, string> = {
  sector: 'industry',
}

/**
 * Company-module CUSTOM fields whose values live in
 * `client_companies.custom_data` JSONB (keyed by field_key) rather than a
 * native column. Resolved through the lead's client_company relation.
 * "segment" is a custom company field (option_type custom_companies__segment).
 */
const COMPANY_CUSTOM_DATA_FIELDS = new Set([
  'segment',
])

/**
 * Resolves a field value from a lead, with multi-level relation fallback.
 *
 * Resolution order:
 *   1. lead[field]                          — direct lead field
 *   2. lead.client_company[field]           — 2nd level: client company
 *   3. (future: lead.client_company.parent) — 3rd level: parent company
 *
 * This is the SINGLE source of truth for field resolution across the
 * entire platform. All dashboard widgets, aggregation engines, and
 * analytics should use this instead of direct field access.
 *
 * @param lead    - The lead record (with joined relations)
 * @param field   - The field key to resolve (e.g. "line_industry", "area")
 * @returns The resolved string value, or null if not found at any level
 */
export function resolveLeadField(lead: Lead, field: string): string | null {
  // Level 1: direct lead field
  const direct = (lead as unknown as Record<string, unknown>)[field]
  if (direct != null && direct !== '') return String(direct)

  // Company custom-field dimensions: stored in client_company.custom_data JSONB
  // (per-tenant custom fields like "Segment"). Resolved through the company
  // relation since leads have no own column for them.
  if (COMPANY_CUSTOM_DATA_FIELDS.has(field)) {
    const cc = lead.client_company as Record<string, unknown> | null
    const customData = cc?.custom_data as Record<string, unknown> | null | undefined
    const cdVal = customData?.[field]
    if (cdVal != null && cdVal !== '') return String(cdVal)
    return null
  }

  // Level 2: client_company relation
  if (CLIENT_COMPANY_FIELDS.has(field)) {
    const cc = lead.client_company as Record<string, unknown> | null
    if (cc) {
      // Honour column aliases (e.g. lead "sector" → company "industry").
      const ccField = CLIENT_COMPANY_FIELD_ALIAS[field] ?? field
      const relVal = cc[ccField]
      if (relVal != null && relVal !== '') return String(relVal)
    }
  }

  // Level 3: client_company.parent (if available in the future)
  // const parent = (lead.client_company as any)?.parent as Record<string, unknown> | null
  // if (parent && CLIENT_COMPANY_FIELDS.has(field)) { ... }

  return null
}

/**
 * Resolves a company name from a lead, checking multiple relations.
 *
 * Resolution order:
 *   1. lead.client_company.name             — direct company relation
 *   2. lead.contact.client_company.name     — via contact's company (3rd level)
 *
 * @returns Company name or null
 */
export function resolveCompanyName(lead: Lead): string | null {
  // Level 1: direct client_company
  if (lead.client_company?.name) return lead.client_company.name

  // Level 2: via contact's client_company (3rd level relation)
  // This requires the contact join to include client_company
  // For now, return null — can be expanded when contact join is enriched
  return null
}

/**
 * Resolves the TOP-LEVEL (group / holding) company name for a lead.
 *
 * Client companies form a one-level "Holding → Division" hierarchy via
 * `client_companies.parent_id` (see migration 20260311_client_company_hierarchy).
 * When a lead's company has a parent, this returns the parent's name so the
 * dashboard can roll up sibling divisions (e.g. "Bank Indonesia KPw Jabar",
 * "Bank Indonesia Pusat") under one group ("Bank Indonesia"). When there is no
 * parent, it falls back to the company's own name.
 *
 * NOTE: the dashboard query only joins ONE parent level. If deeper chains are
 * introduced later, this needs to walk `parent_id` to the root instead.
 *
 * @returns Top-level company name, or null when no company is attached.
 */
export function resolveTopLevelCompanyName(lead: Lead): string | null {
  const cc = lead.client_company
  if (!cc) return null
  return cc.parent?.name ?? cc.name ?? null
}
