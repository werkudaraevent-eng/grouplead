/**
 * Applies a company_id filter to a Supabase query builder when companyId is provided.
 * When companyId is null (holding view), returns the query unchanged — RLS handles scoping.
 *
 * Usage:
 *   const base = supabase.from('leads').select('id, project_name, status')
 *   const scoped = scopedQuery(base, activeCompany?.id ?? null)
 *   const { data } = await scoped.order('created_at', { ascending: false })
 */
export function getScopedCompanyId<T extends { id: string; isHolding?: boolean }>(
  company: T | null
): string | null {
  if (!company || company.isHolding) return null
  return company.id
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function scopedQuery<T extends { eq: (col: string, val: string) => any }>(
  query: T,
  companyId: string | null
): T {
  if (companyId !== null) {
    return query.eq('company_id', companyId) as T
  }
  return query
}

/**
 * The same scope for records a business unit shares with the whole group:
 * the active unit's rows plus the unassigned ones (`company_id` null), which
 * row security shows to everyone. Contacts and client companies are such
 * records: one created from the Add dialog carries no unit, and a strict
 * `company_id = unit` would hide it from the very list it was added to.
 * Returned as a PostgREST logic term, so a list can AND it with its own
 * filters in one `or=(and(…))` parameter; null in the holding view, where
 * row security alone decides. The same rule as `.or("company_id.eq.X,
 * company_id.is.null")` in config/dimension-registry.ts and the goal actions.
 */
export function sharedScopeTerm(companyId: string | null): string | null {
  if (companyId === null) return null
  return `or(company_id.eq.${companyId},company_id.is.null)`
}
