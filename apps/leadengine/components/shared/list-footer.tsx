"use client"

import * as React from "react"
import { SearchableSelect } from "./searchable-select"
import { Pagination } from "./pagination"

/**
 * The strip under a list: what is shown, how many per page, and the pages
 * (Material pagination: the range on the left, controls on the right, one
 * fixed height so the table above never jumps).
 */
export function ListFooter({
  total,
  page,
  perPage,
  onPageChange,
  onPerPageChange,
  perPageOptions = [10, 20, 50, 100],
  noun = "rows",
}: {
  total: number
  page: number
  perPage: number
  onPageChange: (page: number) => void
  onPerPageChange: (perPage: number) => void
  perPageOptions?: number[]
  noun?: string
}) {
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const first = total === 0 ? 0 : (page - 1) * perPage + 1
  const last = Math.min(page * perPage, total)
  return (
    <div className="mt-auto flex h-14 shrink-0 items-center justify-between gap-4 border-t border-border bg-card px-4">
      <p className="text-[13px] text-muted-foreground" aria-live="polite">
        <span className="font-semibold text-foreground tabular-nums">{first}</span>–<span className="font-semibold text-foreground tabular-nums">{last}</span> of{" "}
        <span className="font-semibold text-foreground tabular-nums">{total}</span> {noun}
      </p>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
          Rows per page
          <SearchableSelect
            value={String(perPage)}
            onChange={(value) => value && onPerPageChange(Number(value))}
            options={perPageOptions.map((n) => ({ value: String(n), label: String(n) }))}
            clearable={false}
            contentWidth="auto"
            className="h-9 w-[76px]"
          />
        </label>
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={onPageChange} size="sm" />
      </div>
    </div>
  )
}
