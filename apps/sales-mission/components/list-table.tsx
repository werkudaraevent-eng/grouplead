"use client"

import type { CSSProperties, ReactNode } from "react"
import { Table } from "@/components/ui/table"
import type { ColumnSpec } from "@/lib/lists/list-columns"
import { cn } from "@/lib/utils"

/**
 * The desk geometry the Aktivitas, Prospek and Laporan tables share, and
 * LeadEngine's `list-table.tsx` draws: the selection box and the record's
 * name are frozen at the leading edge, with one edge shadow on the name,
 * while the other columns scroll sideways inside the card; the row's own
 * action column, where a list has one, stays put at the trailing edge
 * with the mirror of that edge (hairline and shadow on its left), so a
 * column sliding under it reads as passing beneath, not as cut off.
 * Every row is 52dp and every cell one line, cut with an ellipsis and
 * carrying its full text in its title (M3 data table; Gmail, HubSpot,
 * Linear).
 *
 * The card fills what the page leaves under its toolbar (`WorkspacePage
 * fill`) and scrolls inside itself in both directions: the header row sticks
 * to its top, the footer sits under it, and the sideways scrollbar is always
 * at the card's visible foot rather than after the last row (M3 data table;
 * Airtable, HubSpot, Sheets; LeadEngine's Contacts).
 *
 * A column is as wide as what it holds (M3): the table lays itself out from
 * its content. Each data column has a floor, its spec width, which its cells
 * reach through `CellBox` and never pass, so a long value is cut inside its
 * column instead of widening it; the action column is exactly as wide as the
 * widest button on the page; the name column takes whatever is left, down to
 * its own floor. Below the sum of the floors the card scrolls sideways.
 * Frozen cells need opaque backgrounds, which the table primitives give them
 * (hover and selection are mixes, not alphas); the edge and the attention
 * mark are drawn by `.list-table` in globals.css. The header row group is
 * sticky and layered above the frozen body cells, and its own frozen cells
 * above the header cells that scroll under them.
 */

/** Width of the leading selection column. */
export const SELECT_COL = 44

/** A data cell's horizontal padding, both sides together (`px-4`, 16dp each). */
const CELL_PADDING_X = 32

/** The selection cell's padding: 12dp leading, none trailing beside a checkbox (`px-3`, `pr-0`). */
const SELECT_PADDING_X = 12

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
 * The card, its scroller and the table. The column group fixes the
 * selection column and each data column at its floor, leaves the name
 * column free to take the rest, and shrinks the action column to its
 * content (a 1px width that the buttons widen).
 */
export function ListTableFrame({
  columns,
  hasSelect,
  hasAction = false,
  footer,
  children,
}: {
  /** The drawn columns, the locked name column first. */
  columns: ColumnSpec[]
  hasSelect: boolean
  /** Whether the list has the frozen trailing action column. */
  hasAction?: boolean
  footer?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="hidden min-h-60 flex-1 flex-col overflow-hidden rounded-xl border bg-card md:flex">
      <div className="data-table-scroll list-table isolate min-h-0 flex-1 overflow-auto">
        <Table>
          <colgroup>
            {hasSelect && <col style={{ width: SELECT_COL }} />}
            {columns.map((column) => (
              <col key={column.id} style={column.locked ? undefined : { width: column.width }} />
            ))}
            {hasAction && <col style={{ width: 1 }} />}
          </colgroup>
          {children}
        </Table>
      </div>
      {footer}
    </div>
  )
}

/**
 * The box a data cell's content sits in. It tells the table how wide the
 * column must at least be (the column's spec width, padding included) and
 * nothing more: its content can be as long as it likes, it is cut with an
 * ellipsis inside the column rather than widening it. A one-column grid of
 * `minmax(0, 1fr)` is what makes the content's own width drop out of the
 * measure while the box still fills the cell.
 */
export function CellBox({ column, children }: { column: ColumnSpec; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)]" style={{ minWidth: Math.max(0, column.width - CELL_PADDING_X) }}>
      {children}
    </div>
  )
}

/** The selection box's cell content, holding its column at exactly `SELECT_COL`, which the frozen name's offset relies on. */
export function SelectBox({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center" style={{ minWidth: SELECT_COL - SELECT_PADDING_X }}>
      {children}
    </div>
  )
}

/** The `data-*` props that let `.list-table` draw a frozen cell's edge: the leading name's on its right, the trailing action's on its left. */
export function edgeProps(edge: boolean | undefined, trailing = false): Record<string, string> {
  if (trailing) return { "data-frozen-trailing": "" }
  return edge ? { "data-frozen-edge": "" } : {}
}

/** Text that stays on one line and ends in an ellipsis when the column is narrower than it. */
export function CellText({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("block truncate", className)}>{children}</span>
}
