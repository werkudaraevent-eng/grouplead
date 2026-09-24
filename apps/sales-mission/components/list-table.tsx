"use client"

import type { CSSProperties, ReactNode } from "react"
import { Table } from "@/components/ui/table"
import { tableMinWidth, type ColumnSpec } from "@/lib/lists/list-columns"
import { cn } from "@/lib/utils"

/**
 * The desk geometry the Aktivitas, Prospek and Laporan tables share, and
 * LeadEngine's `list-table.tsx` draws: the selection box and the record's
 * name are frozen at the leading edge, with one edge shadow on the name,
 * while the other columns scroll sideways inside the card; the row's own
 * action column, where a list has one, stays put at the trailing edge.
 * Every row is 52dp and every cell one line, cut with an ellipsis and
 * carrying its full text in its title (M3 data table; Gmail, HubSpot,
 * Linear).
 *
 * The layout is fixed: each column has its width, the name column has
 * none and takes what the others leave, and the table's minimum width is
 * the sum, so below it the card scrolls and above it the name widens.
 * Frozen cells need opaque backgrounds, which the table primitives give
 * them (hover and selection are mixes, not alphas); the edge and the
 * attention mark are drawn by `.list-table` in globals.css.
 */

/** Width of the leading selection column. */
export const SELECT_COL = 44

/** One 52dp line per cell; the cell's own content truncates inside it. */
export const LIST_CELL = "h-13 py-0 whitespace-nowrap"

export type FrozenPart = "select" | "name" | "trailing"

/** Class and style for a frozen cell (header or body). */
export function frozen(part: FrozenPart, hasSelect: boolean): { className: string; style?: CSSProperties; edge?: boolean } {
  if (part === "select") return { className: "sticky left-0 z-10" }
  if (part === "name") return { className: "sticky z-10", style: { left: hasSelect ? SELECT_COL : 0 }, edge: true }
  return { className: "sticky right-0 z-10" }
}

/**
 * The card, its sideways scroller and the table, with a column group that
 * fixes every width but the name's.
 */
export function ListTableFrame({
  columns,
  hasSelect,
  trailingWidth,
  footer,
  children,
}: {
  /** The drawn columns, the locked name column first. */
  columns: ColumnSpec[]
  hasSelect: boolean
  /** Width of the frozen trailing action column, when the list has one. */
  trailingWidth?: number
  footer?: ReactNode
  children: ReactNode
}) {
  const minWidth = tableMinWidth(columns, (hasSelect ? SELECT_COL : 0) + (trailingWidth ?? 0))
  return (
    <div className="hidden rounded-xl border bg-card md:block">
      <div className={cn("data-table-scroll list-table overflow-x-auto", footer ? "rounded-t-xl" : "rounded-xl")}>
        <Table className="table-fixed" style={{ minWidth }}>
          <colgroup>
            {hasSelect && <col style={{ width: SELECT_COL }} />}
            {columns.map((column) => (
              <col key={column.id} style={column.locked ? undefined : { width: column.width }} />
            ))}
            {trailingWidth !== undefined && <col style={{ width: trailingWidth }} />}
          </colgroup>
          {children}
        </Table>
      </div>
      {footer}
    </div>
  )
}

/** The `data-*` props that let `.list-table` draw a frozen cell's edge. */
export function edgeProps(edge: boolean | undefined, trailing = false): Record<string, string> {
  if (trailing) return { "data-frozen-trailing": "" }
  return edge ? { "data-frozen-edge": "" } : {}
}

/** Text that stays on one line and ends in an ellipsis when the column is narrower than it. */
export function CellText({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("block truncate", className)}>{children}</span>
}
