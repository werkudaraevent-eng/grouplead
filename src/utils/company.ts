import { createClient } from '@/utils/supabase/server'
import type { CompanyContext } from '@/types/company'

/**
 * Reads the active_company cookie and returns the validated CompanyContext.
 * Falls back to the user's first company if the cookie is missing or invalid.
 * Returns null if the user has no company memberships.
 */
export async function getActiveCompany(): Promise<CompanyContext | null> {
  const supabase = await createClient()

  // Get the current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Read the active_company cookie
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const activeCompanyCookie = cookieStore.get('active_company')?.value

  // Handle holding view
  if (activeCompanyCookie === 'holding') {
    const { data: hasHolding } = await supabase.rpc('fn_user_has_holding_access')
    if (hasHolding) {
      // Get the holding company details
      const { data: holdingCompany } = await supabase
        .from('companies')
        .select('id, slug, name, is_holding')
        .eq('is_holding', true)
        .single()

      if (holdingCompany) {
        return {
          id: holdingCompany.id,
          slug: holdingCompany.slug,
          name: holdingCompany.name,
          isHolding: true,
        }
      }
    }
  }

  // Try to find the company matching the cookie slug
  if (activeCompanyCookie && activeCompanyCookie !== 'holding') {
    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id, companies(id, slug, name, is_holding)')
      .eq('user_id', user.id)
      .eq('companies.slug', activeCompanyCookie)
      .single()

    if (membership?.companies) {
      const company = membership.companies as unknown as { id: string; slug: string; name: string; is_holding: boolean }
      return {
        id: company.id,
        slug: company.slug,
        name: company.name,
        isHolding: company.is_holding,
      }
    }
  }

  // Fallback: return the user's first company
  const { data: firstMembership } = await supabase
    .from('company_members')
    .select('company_id, companies(id, slug, name, is_holding)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (firstMembership?.companies) {
    const company = firstMembership.companies as unknown as { id: string; slug: string; name: string; is_holding: boolean }
    return {
      id: company.id,
      slug: company.slug,
      name: company.name,
      isHolding: company.is_holding,
    }
  }

  return null
}

/**
 * Returns all companies the current user is a member of.
 */
export async function getUserCompanies(): Promise<CompanyContext[]> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: memberships } = await supabase
    .from('company_members')
    .select('companies(id, slug, name, is_holding)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (!memberships) return []

  return memberships
    .filter(m => m.companies)
    .map(m => {
      const company = m.companies as unknown as { id: string; slug: string; name: string; is_holding: boolean }
      return {
        id: company.id,
        slug: company.slug,
        name: company.name,
        isHolding: company.is_holding,
      }
    })
}
