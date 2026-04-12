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
  user_type?: UserType | null
  role_id: string | null
  module_id: string
  can_create: boolean
  can_read: 'none' | 'own' | 'company' | 'all'
  can_update: boolean
  can_delete: boolean
}

export interface AppModule {
  id: string
  name: string
  description: string | null
  sort_order: number
}

export interface Role {
  id: string
  created_at: string
  name: string
  description: string | null
  parent_id: string | null
  sort_order: number
  is_system: boolean
  peer_data_visibility: boolean
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
