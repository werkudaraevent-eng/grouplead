"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Tooltip } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { SearchField } from "./search-field"
import { FilterBuilder } from "./filter-builder"
import type { FilterDefinition, FilterValue } from "./filter-builder-types"

/**
 * One toolbar row for a list page (Material: the page's primary action
 * lives in the header; the toolbar holds search, filters and secondary
 * actions as icon buttons).
 *
 * The row is exactly one row tall on every width. The search bar keeps its
 * size, the filter chips ride in a rail that scrolls sideways when there
 * is no room (never wrapping, never pushing the table down), and the
 * actions on the right are 40dp icon buttons with tooltips instead of
 * three labelled buttons competing for the same line.
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
    <div className={cn("flex h-10 items-center gap-3", className)}>
      <SearchField value={search.value} onChange={search.onChange} placeholder={search.placeholder} aria-label={search["aria-label"]} />
      <FilterBuilder layout="rail" definitions={filters.definitions} value={filters.value} onChange={filters.onChange} className="min-w-0 flex-[2]" />
      {actions && <div className="ml-auto flex shrink-0 items-center gap-1">{actions}</div>}
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
