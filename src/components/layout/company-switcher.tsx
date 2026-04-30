'use client'

import { useState, useEffect } from 'react'
import { Building2, Check, Globe, ChevronsUpDown } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCompany } from '@/contexts/company-context'

export function CompanySwitcher() {
  const { activeCompany, companies, isHoldingView, switchCompany } = useCompany()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => { setIsMounted(true) }, [])

  const holdingCompany = companies.find(c => c.isHolding)
  const regularCompanies = companies.filter(c => !c.isHolding)

  if (!isMounted) {
    return <div className="w-full h-10 rounded-lg bg-sidebar-accent/30 animate-pulse" />
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          id="company-switcher-trigger"
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 group bg-sidebar-accent border border-sidebar-border text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-primary"
        >
          <div className="flex items-center justify-center shrink-0">
            {isHoldingView
              ? <Globe className="h-4 w-4 text-sidebar-foreground/70 group-hover:text-sidebar-accent-foreground" />
              : <Building2 className="h-4 w-4 text-sidebar-foreground/70 group-hover:text-sidebar-accent-foreground" />
            }
          </div>
          <span className="flex-1 text-left truncate text-sm">
            {isHoldingView ? 'Holding View' : (activeCompany?.name ?? 'Select Company')}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/50 group-hover:text-sidebar-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Switch Company</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {holdingCompany && (
          <>
            <DropdownMenuItem onClick={() => switchCompany('holding')} className="flex items-center gap-2 cursor-pointer">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1">Holding View</span>
              {isHoldingView && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
            {regularCompanies.length > 0 && <DropdownMenuSeparator />}
          </>
        )}
        {regularCompanies.map(company => {
          const isSelected = !isHoldingView && activeCompany?.id === company.id
          return (
            <DropdownMenuItem key={company.id} onClick={() => switchCompany(company.slug)} className="flex items-center gap-2 cursor-pointer">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 truncate">{company.name}</span>
              {isSelected && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          )
        })}
        {companies.length === 0 && (
          <DropdownMenuItem disabled>
            <span className="text-muted-foreground text-xs">No companies found</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
