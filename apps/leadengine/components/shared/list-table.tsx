"use client"

import * as React from "react"
import { ArrowDown, ArrowUp, ArrowUpDown, MoreVertical } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { TableHead } from "@/components/ui/table"
import { cn } from "@/lib/utils"

/**
 * The pieces a list table shares beyond the primitives: frozen-column
 * geometry, a sortable header, the trailing row menu, and an empty state.
 * The two list pages used to carry their own copies of each.
 */

/**
 * Width of the leading fixed select column. There is no row-number column:
 * a row's number changes with every sort and filter and names nothing, and
 * HubSpot, Salesforce, Pipedrive and Attio leave it out; the footer says
 * "1–25 of 1,196".
 */
export const SELECT_COL = 44
export const MENU_COL = 56

/** The leading frozen edge: a hairline and a soft shadow over what scrolls under it. */
const LEADING_EDGE = "shadow-[inset_-1px_0_0_var(--border),4px_0_8px_-6px_rgba(0,0,0,0.18)]"

/**
 * The trailing row-menu column, header and body cells: sticky at the right
 * with the mirror of the leading edge (hairline and shadow on its left), so
 * a column sliding under it reads as passing beneath rather than as a word
 * cut off. The backgrounds come from the primitives, as for `frozenCell`.
 */
export const MENU_CELL = "sticky right-0 z-10 shadow-[inset_1px_0_0_var(--border),-4px_0_8px_-6px_rgba(0,0,0,0.18)]"

export interface FrozenColumn {
  id: string
  width: number
}

/**
 * Sticky geometry for the first two data columns. Returns the class and
 * inline style for a header or body cell at `index`; the backgrounds come
 * from the primitives (hover and selection included), so only position and
 * the edge shadow are decided here.
 */
export function frozenCell(index: number, columns: FrozenColumn[]): { className: string; style: React.CSSProperties } {
  const column = columns[index]
  const isSticky = index < 2
  const isLastSticky = index === Math.min(1, columns.length - 1)
  const left = index === 0 ? SELECT_COL : SELECT_COL + (columns[0]?.width ?? 0)
  return {
    className: cn(isSticky && "sticky z-10", isSticky && isLastSticky && LEADING_EDGE),
    style: isSticky
      ? { left, minWidth: column.width, maxWidth: column.width, width: column.width }
      : { minWidth: column.width, maxWidth: column.width, width: column.width },
  }
}

export { nextSort, type SortState } from "@/lib/list-sort"

export function SortableHead({
  label,
  active,
  direction,
  onSort,
  className,
  style,
}: {
  label: string
  active: boolean
  direction?: "asc" | "desc"
  onSort: () => void
  className?: string
  style?: React.CSSProperties
}) {
  const Icon = active ? (direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown
  return (
    <TableHead className={className} style={style} aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}>
      {/* The arrow shows on the sorted column, and on another only while it
          is hovered or focused (M3 data table sort), so a header row is not
          a row of arrows. */}
      <button
        type="button"
        onClick={onSort}
        title={!active ? `Sort by ${label}, A to Z` : direction === "asc" ? `Sort by ${label}, Z to A` : "Back to the default order"}
        className={cn("group/sort flex h-full items-center gap-1.5 transition-colors", active ? "text-foreground" : "hover:text-foreground")}
      >
        {label}
        <Icon
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-opacity",
            active ? "text-primary" : "opacity-0 group-hover/sort:opacity-60 group-focus-visible/sort:opacity-60",
          )}
          aria-hidden="true"
        />
      </button>
    </TableHead>
  )
}

/** The trailing overflow menu of a row: a round icon button that shows on hover, focus, or while open. */
export function RowMenu({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          className={cn(
            "h-8 w-8 rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100",
            className
          )}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ListEmpty({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ElementType
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center justify-center py-16 text-center">
      <span className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-6 w-6" />
      </span>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/** Placeholder cards for a list's first load on a phone, shaped like the cards that replace them. */
/**
 * The phone's cards while the first page loads, drawn to `RecordCard`'s
 * measurements (the three lines, the hairline, the owner and the ⋮ in the
 * footer, 12px apart), so nothing moves when the records arrive.
 */
export function ListCardSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul className="space-y-3" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="overflow-hidden rounded-xl border border-border bg-card">
          <span className="block p-4">
            <span className="flex h-6 items-center">
              <span className="block h-3.5 animate-pulse rounded bg-muted" style={{ width: `${55 + ((i * 13) % 30)}%` }} />
            </span>
            <span className="flex h-4 items-center">
              <span className="block h-3 animate-pulse rounded bg-muted/70" style={{ width: `${40 + ((i * 17) % 35)}%` }} />
            </span>
            <span className="mt-2 flex h-5 items-center">
              <span className="block h-3 animate-pulse rounded bg-muted/70" style={{ width: `${50 + ((i * 11) % 30)}%` }} />
            </span>
          </span>
          <span className="flex min-h-11 items-center justify-between gap-3 border-t border-border px-3 py-2">
            <span className="flex items-center gap-2">
              <span className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-muted" />
              <span className="block h-3 w-24 animate-pulse rounded bg-muted/70" />
            </span>
            <span className="grid h-11 w-11 place-items-center">
              <span className="h-1 w-1 rounded-full bg-muted" />
            </span>
          </span>
        </li>
      ))}
    </ul>
  )
}
