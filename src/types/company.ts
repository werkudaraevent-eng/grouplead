export interface Company {
  id: string
  created_at: string
  updated_at: string
  name: string
  slug: string
  is_holding: boolean
  logo_url: string | null
}

export type CompanyInsert = Omit<Company, 'id' | 'created_at' | 'updated_at'>
export type CompanyUpdate = Partial<CompanyInsert>

export type UserType = 'staff' | 'leader' | 'executive' | 'admin' | 'super_admin'

export interface CompanyMember {
  id: string
  created_at: string
  company_id: string
  user_id: string
  user_type: UserType
  // Joined data
  profiles?: {
    full_name: string | null
    email: string | null
    avatar_url: string | null
  }
  companies?: {
    name: string
    slug: string
    is_holding: boolean
  }
}

export interface RolePermission {
  id: string
  created_at: string
  company_id: string
  user_type: UserType
  resource: string
  action: string
  is_allowed: boolean
}

export interface CompanyContext {
  id: string
  slug: string
  name: string
  isHolding: boolean
}

export interface ActiveCompanyState {
  activeCompany: CompanyContext | null
  companies: CompanyContext[]
  isHoldingView: boolean
  switchCompany: (slug: string) => void
}
