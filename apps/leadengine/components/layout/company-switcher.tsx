'use client'

import { useState, useEffect } from 'react'
import { Building2, Check, Globe, ChevronsUpDown, Loader2 } from "@/components/icons"
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
 * CompanySwitcherHeader: the drawer header's identity, as ONE control (Slack's
 * workspace menu, Linear's and Notion's workspace switcher, Atlassian's site
 * switcher): the unit's logo, its name on one line, the scope on the line
 * under it, and a trailing up-down chevron; a press anywhere on it opens the
 * unit menu. It spans the header's free width, so "Werkudara Group" and
 * "Every business unit" read in full in the 240px drawer; a longer name is
 * cut with an ellipsis and given in full in the tooltip (`title`).
 *
 * The menu drops from the header 8px in from the drawer's edge and is the
 * drawer's width minus both insets (224px), as the app switcher's is, so
 * neither covers the page. See DESIGN.md, "The drawer: header, app
 * switcher, collapse".
 */
export function CompanySwitcherHeader() {
  const { activeCompany, companies, isHoldingView, switchCompany, isSwitching } = useCompany()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => { setIsMounted(true) }, [])

  const holdingCompany = companies.find(c => c.isHolding)
  const regularCompanies = companies.filter(c => !c.isHolding)

  const displayName = isHoldingView ? 'Werkudara Group' : (activeCompany?.name ?? 'Werkudara')
  const subtitle = isHoldingView ? 'Every business unit' : 'Single unit'
  const activeLogo = isHoldingView
    ? (holdingCompany?.logoUrl ?? null)
    : (activeCompany?.logoUrl ?? null)

  if (!isMounted) {
    return (
      <div className="flex h-12 min-w-0 flex-1 items-center gap-2 px-1.5" aria-hidden="true">
        <div className="h-8 w-8 shrink-0 rounded-full bg-sidebar-accent/30 animate-pulse" />
        <div className="flex flex-col gap-1.5">
          <div className="h-3 w-24 rounded bg-sidebar-accent/30 animate-pulse" />
          <div className="h-2 w-20 rounded bg-sidebar-accent/20 animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={isSwitching}
          title={displayName}
          className="group flex h-12 min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 text-left transition-colors duration-150 hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[state=open]:bg-sidebar-accent disabled:cursor-wait"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-primary">
            {activeLogo
              ? // eslint-disable-next-line @next/next/no-img-element
                <img src={activeLogo} alt="" className="h-full w-full object-cover" />
              : <span className="text-sm font-bold text-primary-foreground">W</span>
            }
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold leading-[18px] tracking-tight text-sidebar-accent-foreground">
              {displayName}
            </span>
            <span className="block truncate text-[11px] leading-[14px] text-sidebar-foreground">
              {isSwitching ? 'Loading\u2026' : subtitle}
            </span>
          </span>
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
