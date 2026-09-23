"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Tooltip } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { SearchField } from "./search-field"
import { FilterBuilder } from "./filter-builder"
import type { FilterDefinition, FilterValue } from "./filter-builder-types"

/**
 * The toolbar of a list page (Material: the page's primary action lives in
 * the header; the toolbar holds search, filters and secondary actions as
 * icon buttons).
 *
 * One row while everything fits. Search and the filter chips flow in one
 * group that wraps onto a second line when there are more filters than
 * room, so an applied filter is always in sight and never cut at an edge
 * (M3 chip sets wrap on wide screens; Linear, Notion, HubSpot; the same
 * behaviour as Sales Activity's filter bar). The icon actions stay at the
 * top right of the first line.
 */
export function ListToolbar({
  search,
  filters,
  actions,
  className,
}: {
  search: { value: string; onChange: (value: string) => void; placeholder?: string; "aria-label"?: string }
  filters: { definitions: FilterDefinition[]; value: FilterValue[]; onChange: (filters: FilterValue[]) => void }
  /** Right-hand icon actions (`ToolbarIconButton`s). */
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <SearchField value={search.value} onChange={search.onChange} placeholder={search.placeholder} aria-label={search["aria-label"]} className="mr-1" />
        <FilterBuilder definitions={filters.definitions} value={filters.value} onChange={filters.onChange} className="contents" />
      </div>
      {actions && <div className="-my-0.5 flex h-10 shrink-0 items-center gap-1">{actions}</div>}
    </div>
  )
}

/** A 40dp round icon button with a tooltip and an accessible name; optional small count badge. */
export const ToolbarIconButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button> & { label: string; badge?: string }
>(function ToolbarIconButton({ label, badge, className, children, ...props }, ref) {
  return (
    <Tooltip content={label}>
      <Button
        ref={ref}
        type="button"
        variant="ghost"
        size="icon-lg"
        aria-label={label}
        className={cn("relative h-10 w-10 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground", className)}
        {...props}
      >
        {children}
        {badge && (
          <span className="absolute -right-0.5 -top-0.5 rounded-full bg-primary px-1.5 py-px text-[10px] font-semibold leading-tight text-primary-foreground tabular-nums">
            {badge}
          </span>
        )}
      </Button>
    </Tooltip>
  )
})
