'use client'

import { useState, useEffect } from 'react'
import { Building2, ChevronDown, Check, Globe, ChevronsUpDown } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCompany } from '@/contexts/company-context'

interface CompanySwitcherProps {
  isDark?: boolean
}

export function CompanySwitcher({ isDark = false }: CompanySwitcherProps) {
  const { activeCompany, companies, isHoldingView, switchCompany } = useCompany()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => { setIsMounted(true) }, [])

  const holdingCompany = companies.find(c => c.isHolding)
  const regularCompanies = companies.filter(c => !c.isHolding)

  if (!isMounted) {
    return <div className="w-full h-10 rounded-lg bg-sidebar-accent/30 animate-pulse" />
  }

  // Dark dropdown styles
  const contentClass = isDark
    ? 'w-56 bg-[#232838] border-white/10 text-slate-200'
    : 'w-56'
  const labelClass = isDark
    ? 'text-xs text-slate-500 font-normal'
    : 'text-xs text-muted-foreground font-normal'
  const separatorClass = isDark
    ? 'bg-white/8'
    : ''
  const itemClass = (isSelected: boolean) => isDark
    ? `flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white focus:bg-white/10 focus:text-white ${isSelected ? 'text-white' : ''}`
    : 'flex items-center gap-2 cursor-pointer'
  const iconClass = isDark
    ? 'h-4 w-4 text-slate-500'
    : 'h-4 w-4 text-muted-foreground'
  const checkClass = isDark
    ? 'h-4 w-4 text-blue-400'
    : 'h-4 w-4 text-primary'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          id="company-switcher-trigger"
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 group ${
            isDark
              ? 'bg-white/6 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
              : 'bg-white border border-slate-200 shadow-sm text-slate-700 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-center shrink-0">
            {isHoldingView
              ? <Globe className={`h-4 w-4 ${isDark ? 'text-slate-500 group-hover:text-slate-300' : 'text-slate-500 group-hover:text-slate-700'}`} />
              : <Building2 className={`h-4 w-4 ${isDark ? 'text-slate-500 group-hover:text-slate-300' : 'text-slate-500 group-hover:text-slate-700'}`} />
            }
          </div>
          <span className="flex-1 text-left truncate text-sm">
            {isHoldingView ? 'Holding View' : (activeCompany?.name ?? 'Select Company')}
          </span>
          <ChevronsUpDown className={`h-3.5 w-3.5 shrink-0 ${isDark ? 'text-slate-600 group-hover:text-slate-400' : 'text-slate-400 group-hover:text-slate-600'}`} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={contentClass}>
        <DropdownMenuLabel className={labelClass}>Switch Company</DropdownMenuLabel>
        <DropdownMenuSeparator className={separatorClass} />
        {holdingCompany && (
          <>
            <DropdownMenuItem onClick={() => switchCompany('holding')} className={itemClass(isHoldingView)}>
              <Globe className={iconClass} />
              <span className="flex-1">Holding View</span>
              {isHoldingView && <Check className={checkClass} />}
            </DropdownMenuItem>
            {regularCompanies.length > 0 && <DropdownMenuSeparator className={separatorClass} />}
          </>
        )}
        {regularCompanies.map(company => {
          const isSelected = !isHoldingView && activeCompany?.id === company.id
          return (
            <DropdownMenuItem key={company.id} onClick={() => switchCompany(company.slug)} className={itemClass(isSelected)}>
              <Building2 className={iconClass} />
              <span className="flex-1 truncate">{company.name}</span>
              {isSelected && <Check className={checkClass} />}
            </DropdownMenuItem>
          )
        })}
        {companies.length === 0 && (
          <DropdownMenuItem disabled>
            <span className={isDark ? 'text-slate-600 text-xs' : 'text-muted-foreground text-xs'}>No companies found</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
