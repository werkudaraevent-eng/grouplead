"use client"

import * as React from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
        {/* A plain dropdown of the few sizes on offer (M3 menu, as Gmail and
            Sales Activity do it), not a searchable combobox whose stacked
            arrows read as a number stepper. */}
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <span id="rows-per-page-label">Rows per page</span>
          <Select value={String(perPage)} onValueChange={(value) => onPerPageChange(Number(value))}>
            <SelectTrigger size="sm" className="w-[76px]" aria-labelledby="rows-per-page-label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {perPageOptions.map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={onPageChange} size="sm" />
      </div>
    </div>
  )
}
