"use client"

import { useTransition, type ComponentProps } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight, Loader2 } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { useCompact } from "@/hooks/use-compact"
import { SortHeader as GenericSortHeader } from "@/components/sort-header"
import { ListCount } from "@/components/list-view/list-count"
import { nextSort, PAGE_SIZES, sortParts, type MissionSort, type SortColumn } from "@/lib/missions/mission-paging"

/**
 * The table's footer, as Material's data table lays it out: rows per page,
 * the range and total, previous and next, all at the trailing edge. State
 * lives in the URL beside the filters, so page 3 of a filtered view is a
 * link that can be sent and returned to.
 *
 * On a desk the leading end holds the list's count while a filter narrows
 * it ("12 dari 170 aktivitas", "Menyaring…" while it loads; `ListCount`),
 * level with the paging in the one 48px row, cut with an ellipsis before
 * the paging ever wraps; unfiltered it is empty, because the range already
 * says the total. A phone keeps its count above the cards.
 */
export function MissionPagination({ page, size, total }: { page: number; size: number; total: number }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, start] = useTransition()

  const set = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") params.delete(key)
      else params.set(key, value)
    }
    const qs = params.toString()
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }))
  }

  const first = total === 0 ? 0 : page * size + 1
  const last = Math.min(total, (page + 1) * size)
  const lastPage = Math.max(0, Math.ceil(total / size) - 1)
  const compact = useCompact()

  // A phone list grows rather than turns pages (Material's guidance for
  // long lists on compact windows): "Muat lagi" widens the page up to the
  // largest size, and only past that does it step to the next page.
  if (compact) {
    const nextSize = PAGE_SIZES.find((option) => option > size)
    const more = total > last
    return (
      <div className="flex flex-col items-center gap-2 border-t bg-card px-4 py-3 text-sm text-muted-foreground">
        <span className="tabular-nums" aria-live="polite">
          {pending ? <Loader2 className="inline h-4 w-4 animate-spin" /> : `${first}–${last} dari ${total}`}
        </span>
        {(more || page > 0) && (
          <div className="flex w-full items-center gap-2">
            {page > 0 && (
              <Button variant="outline" className="h-11 flex-1" disabled={pending} onClick={() => set({ page: page - 1 <= 0 ? null : String(page - 1) })}>
                <ChevronLeft className="h-4 w-4" /> Sebelumnya
              </Button>
            )}
            {more && (
              nextSize && page === 0 ? (
                <Button variant="outline" className="h-11 flex-1" disabled={pending} onClick={() => set({ size: String(nextSize), page: null })}>
                  Muat lagi
                </Button>
              ) : (
                <Button variant="outline" className="h-11 flex-1" disabled={pending} onClick={() => set({ page: String(page + 1) })}>
                  Berikutnya <ChevronRight className="h-4 w-4" />
                </Button>
              )
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex min-h-12 flex-wrap items-center justify-end gap-x-6 gap-y-1 border-t bg-card px-4 py-1 text-sm text-muted-foreground">
      <ListCount place="footer" className="min-w-0 flex-1 truncate tabular-nums" />
      <label className="flex items-center gap-2">
        <span>Baris per halaman</span>
        <select
          value={size}
          onChange={(event) => set({ size: event.target.value === "25" ? null : event.target.value, page: null })}
          className="h-11 rounded-md border border-input bg-field px-2 text-sm md:h-8 text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          aria-label="Baris per halaman"
        >
          {PAGE_SIZES.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
      <span className="tabular-nums" aria-live="polite">
        {pending ? <Loader2 className="inline h-3.5 w-3.5 animate-spin" /> : `${first}–${last} dari ${total}`}
      </span>
      <span className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-11 w-11 md:h-8 md:w-8" disabled={page <= 0 || pending} onClick={() => set({ page: page - 1 <= 0 ? null : String(page - 1) })} aria-label="Halaman sebelumnya">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-11 w-11 md:h-8 md:w-8" disabled={page >= lastPage || pending} onClick={() => set({ page: String(page + 1) })} aria-label="Halaman berikutnya">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </span>
    </div>
  )
}

/**
 * The mission list's binding of the shared sortable header. Jadwal holds
 * the default order, nearest first, and says so in its tooltip; a click
 * cycles it to oldest first, newest first, then back.
 */
export function SortHeader({
  column,
  label,
  sort,
  align = "left",
  head,
}: {
  column: SortColumn
  label: string
  sort: MissionSort
  align?: "left" | "right"
  head?: ComponentProps<typeof GenericSortHeader>["head"]
}) {
  return (
    <GenericSortHeader
      column={column}
      label={label}
      sort={sort}
      parts={sortParts}
      next={nextSort}
      defaultSort="upcoming"
      defaultHint={{ column: "schedule", text: "terdekat dulu" }}
      align={align}
      head={head}
    />
  )
}
