'use client'

import { useState, useEffect } from 'react'
import { Building2, Check, Globe, ChevronsUpDown, Loader2 } from "@/components/icons"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCompany } from '@/contexts/company-context'
import { AppIcon } from '@/components/layout/app-icon'
import { PRODUCT_NAME, unitScopeLabel } from '@/lib/navigation/app-nav'

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
                  <img src={company.logoUrl} alt={company.name} className="h-4 w-4 rounded-full object-cover shrink-0" />
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
 * CompanySwitcherHeader: the drawer header's identity, as ONE control, the
 * same pattern as Sales Activity's (DESIGN.md, "The drawer: header, app
 * switcher, collapse"): the app's icon (the family tile with the funnel),
 * the app's name on the first line, the unit the data is shown for on the
 * second ("Every business unit" or the unit's name), and a trailing up-down
 * chevron. A press anywhere on it opens the unit menu. A long unit name is
 * cut with an ellipsis and given in full in the tooltip (`title`).
 *
 * Never a company's logo as the mark: the app is not the unit, and a round
 * logo beside a name read as a person's avatar. The units' logos stay in
 * the menu, beside each unit, where a unit is chosen.
 *
 * The menu drops from the header 8px in from the drawer's edge and is the
 * drawer's width minus both insets (224px), as the app switcher's is, so
 * neither covers the page.
 */
export function CompanySwitcherHeader() {
  const { activeCompany, companies, isHoldingView, switchCompany, isSwitching } = useCompany()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => { setIsMounted(true) }, [])

  const holdingCompany = companies.find(c => c.isHolding)
  const regularCompanies = companies.filter(c => !c.isHolding)

  const scope = unitScopeLabel(isHoldingView, activeCompany?.name)

  // The two lines, drawn the same before and after hydration: the product's
  // name is fixed and the scope comes from the server's company, so nothing
  // moves when the menu becomes live.
  const identity = (
    <>
      <AppIcon app="leadengine" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold leading-[18px] tracking-tight text-sidebar-accent-foreground">
          {PRODUCT_NAME}
        </span>
        <span className="block truncate text-[11px] leading-[14px] text-sidebar-foreground">
          {isSwitching ? 'Loading\u2026' : scope}
        </span>
      </span>
    </>
  )

  // The Radix menu's ids are only stable once mounted (see the note on
  // AppSwitcher in sidebar.tsx), so the first HTML draws the same identity
  // as a plain block.
  if (!isMounted) {
    return (
      <div className="flex h-12 min-w-0 flex-1 items-center gap-2 px-1.5" aria-hidden="true">
        {identity}
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground" aria-hidden="true" />
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={isSwitching}
          title={`${PRODUCT_NAME} \u00b7 ${scope}`}
          aria-label={`${PRODUCT_NAME}, ${scope}. Change business unit`}
          className="group flex h-12 min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 text-left transition-colors duration-150 hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[state=open]:bg-sidebar-accent disabled:cursor-wait"
        >
          {identity}
          {isSwitching
            ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-sidebar-foreground" aria-hidden="true" />
            : <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground transition-colors group-hover:text-sidebar-accent-foreground" aria-hidden="true" />
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
              <span className="flex-1">Werkudara Group</span>
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
                  <img src={company.logoUrl} alt={company.name} className="h-4 w-4 rounded-full object-cover shrink-0" />
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
