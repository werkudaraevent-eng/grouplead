"use client"

import * as React from "react"
import { SlidersHorizontal } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Tooltip } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { SearchField } from "./search-field"
import { FilterBuilder } from "./filter-builder"
import { FilterChip } from "./filter-chip"
import { filterValueLabel, isEffectiveFilter, type FilterDefinition, type FilterValue } from "./filter-builder-types"

interface ToolbarSearch {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  "aria-label"?: string
}

interface ToolbarFilters {
  definitions: FilterDefinition[]
  value: FilterValue[]
  onChange: (filters: FilterValue[]) => void
  /** "Clear all" for the whole view (search included); without it, Clear all empties the filters only. */
  onClearAll?: () => void
}

/**
 * The toolbar of a list page (Material: the page's primary action lives in
 * the header; the toolbar holds search, filters and secondary actions as
 * icon buttons).
 *
 * From `md` up it is one row while everything fits. Search and the filter
 * chips flow in one group that wraps onto a second line when there are
 * more filters than room, so an applied filter is always in sight and never
 * cut at an edge (M3 chip sets wrap on wide screens; Linear, Notion,
 * HubSpot; the same behaviour as Sales Activity's filter bar). The icon
 * actions stay at the top right of the first line.
 *
 * On a phone, search stays and the filter chips move behind one "Filter"
 * button carrying the count of what narrows the list, which opens them in
 * a bottom sheet; what is applied is repeated under the search as one
 * sideways-scrolling row of chips, each with an ✕, then "Clear all"
 * (Sales Activity's `FilterBarFrame`; M3 filter chips in a modal bottom
 * sheet). The view tools (save view, columns) are desk tools and stay
 * there: the phone shows cards, not columns.
 */
export function ListToolbar({
  search,
  filters,
  actions,
  className,
}: {
  search: ToolbarSearch
  filters: ToolbarFilters
  /** Right-hand icon actions (`ToolbarIconButton`s), from `md` up. */
  actions?: React.ReactNode
  className?: string
}) {
  const searchActive = search.value.trim() !== "" && Boolean(filters.onClearAll)
  return (
    <>
      <div className={cn("hidden items-start gap-3 md:flex", className)}>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <SearchField value={search.value} onChange={search.onChange} placeholder={search.placeholder} aria-label={search["aria-label"]} className="mr-1" />
          <FilterBuilder
            definitions={filters.definitions}
            value={filters.value}
            onChange={filters.onChange}
            onClearAll={filters.onClearAll}
            extraActive={searchActive}
            className="contents"
          />
        </div>
        {actions && <div className="-my-0.5 flex h-10 shrink-0 items-center gap-1">{actions}</div>}
      </div>
      <PhoneFilterBar search={search} filters={filters} className={cn("md:hidden", className)} />
    </>
  )
}

function PhoneFilterBar({ search, filters, className }: { search: ToolbarSearch; filters: ToolbarFilters; className?: string }) {
  const [open, setOpen] = React.useState(false)
  const q = search.value.trim()
  const applied = filters.value.filter(isEffectiveFilter)
  const count = applied.length + (q ? 1 : 0)
  const byField = new Map(filters.definitions.map((d) => [d.field, d]))
  const clearAll = () => {
    if (filters.onClearAll) filters.onClearAll()
    else {
      search.onChange("")
      filters.onChange([])
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <SearchField
          value={search.value}
          onChange={search.onChange}
          placeholder={search.placeholder}
          aria-label={search["aria-label"]}
          className="h-11 min-w-0 max-w-none flex-1 basis-auto"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={cn("h-11 shrink-0 gap-2", count > 0 && "border-primary/50 bg-primary/5")}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filter
          {count > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] font-bold tabular-nums text-primary-foreground">{count}</span>}
        </Button>
      </div>
      {count > 0 && (
        <div className="chip-scroll -mx-4 flex items-center overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex shrink-0 items-center gap-1.5">
            {q && <FilterChip label={`“${q}”`} onRemove={() => search.onChange("")} />}
            {applied.map((f) => {
              const def = byField.get(f.field)
              if (!def) return null
              return (
                <FilterChip
                  key={f.field}
                  label={`${def.label}: ${filterValueLabel(def, f)}`}
                  onRemove={() => filters.onChange(filters.value.filter((v) => v.field !== f.field))}
                />
              )
            })}
            <button type="button" onClick={clearAll} className="ml-1 shrink-0 whitespace-nowrap text-xs font-semibold text-primary hover:underline">
              Clear all
            </button>
          </div>
        </div>
      )}
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title="Filter"
        description="Pick one or more; the list updates as you go."
        footer={
          <Button type="button" className="h-12 w-full" onClick={() => setOpen(false)}>
            Done
          </Button>
        }
      >
        <div className="px-4 pb-2">
          <FilterBuilder
            definitions={filters.definitions}
            value={filters.value}
            onChange={filters.onChange}
            onClearAll={filters.onClearAll}
            extraActive={q !== "" && Boolean(filters.onClearAll)}
          />
        </div>
      </BottomSheet>
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
