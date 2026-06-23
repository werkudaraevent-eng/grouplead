'use client'

import { useState, useEffect } from 'react'
import { Building2, Check, Globe, ChevronsUpDown, ChevronDown, Loader2 } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCompany } from '@/contexts/company-context'

export function CompanySwitcher() {
  const { activeCompany, companies, isHoldingView, switchCompany, isSwitching } = useCompany()
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
          disabled={isSwitching}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 group bg-sidebar-accent border border-sidebar-border text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-primary disabled:opacity-70 disabled:cursor-wait"
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
          {isSwitching
            ? <Loader2 className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/70 animate-spin" />
            : <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/50 group-hover:text-sidebar-foreground" />
          }
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
              {company.logoUrl
                ? // eslint-disable-next-line @next/next/no-img-element
                  <img src={company.logoUrl} alt={company.name} className="h-4 w-4 rounded object-cover shrink-0" />
                : <Building2 className="h-4 w-4 text-muted-foreground" />
              }
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

/**
 * CompanySwitcherHeader — Notion/Linear style header-integrated switcher.
 * Logo + company name as a single clickable dropdown trigger.
 */
export function CompanySwitcherHeader() {
  const { activeCompany, companies, isHoldingView, switchCompany, isSwitching } = useCompany()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => { setIsMounted(true) }, [])

  const holdingCompany = companies.find(c => c.isHolding)
  const regularCompanies = companies.filter(c => !c.isHolding)

  const displayName = isHoldingView ? 'All units' : (activeCompany?.name ?? 'Werkudara')
  const subtitle = isHoldingView ? 'Every business unit' : 'Single unit'
  const activeLogo = isHoldingView
    ? (holdingCompany?.logoUrl ?? null)
    : (activeCompany?.logoUrl ?? null)

  if (!isMounted) {
    return (
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-sidebar-accent/30 animate-pulse" />
        <div className="flex flex-col gap-1">
          <div className="w-20 h-3 rounded bg-sidebar-accent/30 animate-pulse" />
          <div className="w-14 h-2 rounded bg-sidebar-accent/20 animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button disabled={isSwitching} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 -ml-1.5 transition-colors duration-150 hover:bg-sidebar-accent/50 focus:outline-none focus-visible:outline-none group min-w-0 overflow-hidden disabled:cursor-wait">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0 overflow-hidden">
            {activeLogo
              ? // eslint-disable-next-line @next/next/no-img-element
                <img src={activeLogo} alt={displayName} className="w-full h-full object-cover" />
              : <span className="text-white font-bold text-sm">W</span>
            }
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="font-semibold text-sm tracking-tight leading-none text-sidebar-accent-foreground truncate">
              {displayName}
            </p>
            <p className="text-[11px] font-medium text-sidebar-foreground/50 mt-0.5 truncate whitespace-nowrap">
              {isSwitching ? 'Loading\u2026' : subtitle}
            </p>
          </div>
          {isSwitching
            ? <Loader2 className="h-3 w-3 shrink-0 text-sidebar-foreground/60 animate-spin" />
            : <ChevronDown className="h-3 w-3 shrink-0 text-sidebar-foreground/40 group-hover:text-sidebar-foreground/70 transition-colors" />
          }
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">View data for</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {holdingCompany && (
          <>
            <DropdownMenuItem onClick={() => switchCompany('holding')} className="flex items-center gap-2 cursor-pointer">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1">All units</span>
              {isHoldingView && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
            {regularCompanies.length > 0 && <DropdownMenuSeparator />}
          </>
        )}
        {regularCompanies.map(company => {
          const isSelected = !isHoldingView && activeCompany?.id === company.id
          return (
            <DropdownMenuItem key={company.id} onClick={() => switchCompany(company.slug)} className="flex items-center gap-2 cursor-pointer">
              {company.logoUrl
                ? // eslint-disable-next-line @next/next/no-img-element
                  <img src={company.logoUrl} alt={company.name} className="h-4 w-4 rounded object-cover shrink-0" />
                : <Building2 className="h-4 w-4 text-muted-foreground" />
              }
              <span className="flex-1 truncate">{company.name}</span>
              {isSelected && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
