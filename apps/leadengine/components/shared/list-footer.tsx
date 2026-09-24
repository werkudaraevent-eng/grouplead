"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, Loader2 } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PAGE_SIZES, lastPage, loadMoreStep, matchCountLabel, pageRange, type PageSize } from "@/lib/lists/list-state"
import { cn } from "@/lib/utils"

const fmt = (n: number) => n.toLocaleString("en-US")

/**
 * The strip under a server-paged list, as Sales Activity's lists and
 * Material's data table lay it out: on a desk, rows per page, the range
 * with the total ("1–25 of 1,196 contacts") and previous / next at the
 * trailing edge, at one fixed height so the table above never jumps. No
 * page numbers: a list sorted and filtered in the database is read forward
 * and back, not jumped into at page 17 (Gmail, Sales Activity).
 *
 * Its leading end holds the count of matches, and only while a search or
 * filter narrows the list ("170 of 1,196 contacts", "Filtering…" while it
 * loads; `matchCountLabel`): unfiltered, the range already says the total,
 * and the toolbar above holds controls only.
 *
 * On a phone the list grows instead of turning pages: "Load more" widens
 * the first page up to the largest size, and only past that do Previous
 * and Next step through pages of 100 (M3 guidance for long lists on compact
 * windows; Sales Activity's `MissionPagination`).
 */
export function ListFooter({
    total,
    page,
    size,
    onPageChange,
    onSizeChange,
    noun = "rows",
    pending = false,
    narrowed = false,
    unfiltered = null,
    className,
}: {
    total: number
    /** 0-based. */
    page: number
    size: PageSize
    onPageChange: (page: number) => void
    onSizeChange: (size: PageSize) => void
    noun?: string
    pending?: boolean
    /** A search or filter narrows the list: the desk footer says how many of the list match. */
    narrowed?: boolean
    /** The rows before the search and filters (`useListPage().unfiltered`). */
    unfiltered?: number | null
    className?: string
}) {
    const { first, last } = pageRange(page, size, total)
    const final = lastPage(total, size)
    const more = loadMoreStep(page, size, total)
    const count = matchCountLabel({ narrowed, pending, total, unfiltered, noun })
    const range = (
        <span className="inline-flex items-center gap-1.5 tabular-nums" aria-live="polite">
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            <span>
                <span className="font-semibold text-foreground">{fmt(first)}</span>–<span className="font-semibold text-foreground">{fmt(last)}</span> of{" "}
                <span className="font-semibold text-foreground">{fmt(total)}</span> {noun}
            </span>
        </span>
    )

    return (
        <div className={cn("shrink-0 border-t border-border bg-card text-[13px] text-muted-foreground", className)}>
            <div className="hidden h-14 items-center justify-between gap-6 px-4 md:flex">
                {/* Always in the tree, so a screen reader hears it change. */}
                <span className="min-w-0 truncate text-sm text-muted-foreground" aria-live="polite">
                    {count}
                </span>
                <div className="flex shrink-0 items-center gap-6">
                    {/* A plain dropdown of the few sizes on offer (M3 menu), not a
                        searchable combobox whose stacked arrows read as a stepper. */}
                    <div className="flex items-center gap-2">
                        <span id="rows-per-page-label">Rows per page</span>
                        <Select value={String(size)} onValueChange={(value) => onSizeChange(Number(value) as PageSize)}>
                            <SelectTrigger size="sm" className="w-[76px]" aria-labelledby="rows-per-page-label">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent align="end">
                                {PAGE_SIZES.map((n) => (
                                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {range}
                    <span className="flex items-center gap-1" role="navigation" aria-label="Pagination">
                        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-full" disabled={page <= 0} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-full" disabled={page >= final} onClick={() => onPageChange(page + 1)} aria-label="Next page">
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </span>
                </div>
            </div>

            <div className="flex flex-col items-center gap-2 px-4 py-3 text-sm md:hidden">
                {range}
                {(more || page > 0) && (
                    <div className="flex w-full items-center gap-2">
                        {page > 0 && (
                            <Button type="button" variant="outline" className="h-11 flex-1" onClick={() => onPageChange(page - 1)}>
                                <ChevronLeft className="h-4 w-4" /> Previous
                            </Button>
                        )}
                        {more && (
                            more.size !== size ? (
                                <Button type="button" variant="outline" className="h-11 flex-1" disabled={pending} onClick={() => onSizeChange(more.size)}>
                                    Load more
                                </Button>
                            ) : (
                                <Button type="button" variant="outline" className="h-11 flex-1" onClick={() => onPageChange(more.page)}>
                                    Next <ChevronRight className="h-4 w-4" />
                                </Button>
                            )
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
