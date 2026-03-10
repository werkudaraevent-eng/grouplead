'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { CompanyContext, ActiveCompanyState } from '@/types/company'

const CompanyCtx = createContext<ActiveCompanyState | null>(null)

interface CompanyProviderProps {
  initialCompany: CompanyContext | null
  companies: CompanyContext[]
  children: React.ReactNode
}

export function CompanyProvider({ initialCompany, companies: initialCompanies, children }: CompanyProviderProps) {
  const router = useRouter()
  const [activeCompany, setActiveCompany] = useState<CompanyContext | null>(initialCompany)
  const [companies] = useState<CompanyContext[]>(initialCompanies)

  const switchCompany = useCallback((slug: string) => {
    document.cookie = `active_company=${slug}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`
    if (slug === 'holding') {
      const holdingCompany = companies.find(c => c.isHolding)
      if (holdingCompany) setActiveCompany({ ...holdingCompany, isHolding: true })
    } else {
      const company = companies.find(c => c.slug === slug)
      if (company) setActiveCompany(company)
    }
    router.refresh()
  }, [companies, router])

  const isHoldingView = activeCompany?.isHolding === true

  return (
    <CompanyCtx.Provider value={{ activeCompany, companies, isHoldingView, switchCompany }}>
      {children}
    </CompanyCtx.Provider>
  )
}

export function useCompany(): ActiveCompanyState {
  const ctx = useContext(CompanyCtx)
  if (!ctx) throw new Error('useCompany must be used within a CompanyProvider')
  return ctx
}
