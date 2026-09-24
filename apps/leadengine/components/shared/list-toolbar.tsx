"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Tooltip } from "@/components/ui/tooltip"
import { useQuickReturn } from "@/hooks/use-quick-return"
import { cn } from "@/lib/utils"
import { SearchField } from "./search-field"
import { FilterBuilder } from "./filter-builder"
import { FilterChip } from "./filter-chip"
import { PhoneFilterFrame } from "./phone-filter-frame"
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
 * HubSpot; the same behaviour as Sales Activity's filter bar). The view
 * tools (the Views menu, then the columns button) stay at the top right of
 * the first line. The toolbar holds controls only: the count of matches is
 * in the table's footer (`ListFooter`).
 *
 * On a phone, search stays and the filter chips move behind one "Filter"
 * button carrying the count of what narrows the list, which opens them in
 * a bottom sheet; what is applied is repeated under the search as one
 * sideways-scrolling row of chips, each with an ✕, then "Clear all"
 * (`PhoneFilterFrame`, shared with the Pipeline and the Dashboard; Sales
 * Activity's `FilterBarFrame`; M3 filter chips in a modal bottom sheet),
 * the row fading at each edge it can still scroll toward. The view tools (the Views menu, columns) are desk tools and stay
 * there: the phone shows cards, not columns, and chooses a saved view from
 * the chips the page draws above the search (`SavedViewsBar`). The search
 * row and the applied chips sit 12px apart; the page wraps them, with the
 * saved views, in `ListControls`.
 */
export function ListToolbar({
  search,
  filters,
  actions,
  className,
}: {
  search: ToolbarSearch
  filters: ToolbarFilters
  /** Right-hand view tools (`ViewsMenu`, `ColumnsMenu`), from `md` up. */
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
        {actions && <div className="-my-0.5 flex h-10 shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <PhoneFilterBar search={search} filters={filters} className={cn("md:hidden", className)} />
    </>
  )
}

function PhoneFilterBar({ search, filters, className }: { search: ToolbarSearch; filters: ToolbarFilters; className?: string }) {
  const q = search.value.trim()
  const applied = filters.value.filter(isEffectiveFilter)
  const byField = new Map(filters.definitions.map((d) => [d.field, d]))
  const clearAll = () => {
    if (filters.onClearAll) filters.onClearAll()
    else {
      search.onChange("")
      filters.onChange([])
    }
  }
  const chips: React.ReactNode[] = []
  if (q) chips.push(<FilterChip key="search" label={`“${q}”`} onRemove={() => search.onChange("")} />)
  for (const f of applied) {
    const def = byField.get(f.field)
    if (!def) continue
    chips.push(
      <FilterChip
        key={f.field}
        label={`${def.label}: ${filterValueLabel(def, f)}`}
        onRemove={() => filters.onChange(filters.value.filter((v) => v.field !== f.field))}
      />,
    )
  }

  return (
    <PhoneFilterFrame
      search={search}
      count={applied.length + (q ? 1 : 0)}
      chips={chips}
      onClearAll={clearAll}
      description="Pick one or more; the list updates as you go."
      className={className}
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
    </PhoneFilterFrame>
  )
}

/**
 * The block that holds a list page's controls, directly under its header.
 *
 * From `md` up it is the toolbar's band over the table, as it always was:
 * `pb-4` and one hairline under it; between `md` and `lg`, where the page's
 * header row gives way to the top app bar, it keeps its 12px top padding
 * so the search does not touch the bar.
 *
 * Below `md` it is one quick-return block (M3 top app bar, "enter always";
 * Gmail, Google Contacts): the saved-view chips, the search with its Filter
 * button and the applied chips, 12px apart and 12px from the first card.
 * It scrolls away as the reader reads down and slides back, pinned under
 * the top app bar, the moment they scroll up (`useQuickReturn`); near the
 * top it is simply in its place. Sticky in the shell's `<main>` on an
 * opaque surface, above the cards and below every sheet, menu and dialog
 * (they are portalled at z-50); edge to edge, because the page gives each
 * band its own side padding. While slid away it is `inert`, so nothing in
 * it can be tabbed to or tapped; it never slides away while someone is in
 * it (typing in the search, moving through it by keyboard) or while its
 * Filter sheet or a menu opened from it is open. The hairline
 * under it shows only while it is pinned with the list passing under it,
 * and its 1px is part of the 12px (`pb-[11px]`), so nothing moves when it
 * appears. The slide is 200ms, and instant under reduced motion.
 */
export function ListControls({ children }: { children: React.ReactNode }) {
  const anchor = React.useRef<HTMLDivElement>(null)
  const block = React.useRef<HTMLDivElement>(null)
  const { hidden, stuck } = useQuickReturn(block, anchor)
  return (
    <>
      {/* The block's own place in the page, which its pinned box no longer tells. */}
      <div ref={anchor} aria-hidden="true" className="md:hidden" />
      <div
        ref={block}
        inert={hidden}
        className={cn(
          "sticky top-0 z-20 flex shrink-0 flex-col gap-3 border-b bg-background px-4 pt-3 pb-[11px] sm:px-6",
          "transition-transform duration-200 ease-out motion-reduce:transition-none",
          hidden && "pointer-events-none -translate-y-full",
          stuck && !hidden ? "border-border" : "border-transparent",
          "md:static md:z-auto md:block md:border-border md:pb-4 lg:px-8 lg:pt-0",
        )}
      >
        {children}
      </div>
    </>
  )
}

/**
 * A 40dp round icon button with a tooltip and an accessible name. No badge:
 * an M3 badge flags something new or waiting, never a setting.
 */
export const ToolbarIconButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button> & { label: string }
>(function ToolbarIconButton({ label, className, children, ...props }, ref) {
  return (
    <Tooltip content={label}>
      <Button
        ref={ref}
        type="button"
        variant="ghost"
        size="icon-lg"
        aria-label={label}
        className={cn("h-10 w-10 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground", className)}
        {...props}
      >
        {children}
      </Button>
    </Tooltip>
  )
})
