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
