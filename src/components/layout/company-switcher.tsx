'use client'

import { Building2, ChevronDown, Check, Globe } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCompany } from '@/contexts/company-context'

export function CompanySwitcher() {
  const { activeCompany, companies, isHoldingView, switchCompany } = useCompany()

  const holdingCompany = companies.find(c => c.isHolding)
  const regularCompanies = companies.filter(c => !c.isHolding)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-all duration-150 group">
          <div className="w-6 h-6 rounded-md bg-primary/20 flex items-center justify-center shrink-0">
            {isHoldingView ? <Globe className="h-3.5 w-3.5 text-primary" /> : <Building2 className="h-3.5 w-3.5 text-primary" />}
          </div>
          <span className="flex-1 text-left truncate text-xs">
            {isHoldingView ? 'Holding View' : (activeCompany?.name ?? 'Select Company')}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-sidebar-foreground/40 group-hover:text-sidebar-foreground/60 shrink-0" />
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
        {regularCompanies.map(company => (
          <DropdownMenuItem key={company.id} onClick={() => switchCompany(company.slug)} className="flex items-center gap-2 cursor-pointer">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 truncate">{company.name}</span>
            {!isHoldingView && activeCompany?.id === company.id && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        {companies.length === 0 && (
          <DropdownMenuItem disabled>
            <span className="text-muted-foreground text-xs">No companies found</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
