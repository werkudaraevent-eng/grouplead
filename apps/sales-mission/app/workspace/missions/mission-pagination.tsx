"use client"

import { useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Loader2 } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { nextSort, PAGE_SIZES, sortParts, type MissionSort, type SortColumn } from "@/lib/missions/mission-paging"

/**
 * The table's footer, as Material's data table lays it out: rows per page,
 * the range and total, previous and next, all at the trailing edge. State
 * lives in the URL beside the filters, so page 3 of a filtered view is a
 * link that can be sent and returned to.
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

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-2 border-t bg-card px-4 py-2 text-sm text-muted-foreground">
      <label className="flex items-center gap-2">
        <span>Baris per halaman</span>
        <select
          value={size}
          onChange={(event) => set({ size: event.target.value === "25" ? null : event.target.value, page: null })}
          className="h-9 rounded-md border border-input bg-field px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          aria-label="Baris per halaman"
        >
          {PAGE_SIZES.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
      <span className="tabular-nums" aria-live="polite">
        {pending ? <Loader2 className="inline h-3.5 w-3.5 animate-spin" /> : `${first}–${last} dari ${total}`}
      </span>
      <span className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-9 w-9" disabled={page <= 0 || pending} onClick={() => set({ page: page - 1 <= 0 ? null : String(page - 1) })} aria-label="Halaman sebelumnya">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-9 w-9" disabled={page >= lastPage || pending} onClick={() => set({ page: String(page + 1) })} aria-label="Halaman berikutnya">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </span>
    </div>
  )
}

/** The Jadwal column header: click to cycle nearest-first, oldest-first, newest-first. */
/**
 * A sortable column header, as Material's data table draws one: the label is
 * the control, an arrow shows the direction, and a column that is not the
 * current sort reveals its arrow only on hover. One column sorts at a time;
 * clicking cycles unsorted → ascending → descending → default.
 */
export function SortHeader({
  column,
  label,
  sort,
  align = "left",
}: {
  column: SortColumn
  label: string
  sort: MissionSort
  align?: "left" | "right"
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const parts = sortParts(sort)
  const active = parts.column === column && parts.direction !== "upcoming"
  const isDefault = column === "schedule" && parts.direction === "upcoming"
  const next = nextSort(column, sort)
  const describe = (value: MissionSort) => {
    const p = sortParts(value)
    if (p.direction === "upcoming") return "terdekat dulu"
    return p.direction === "asc" ? "A ke Z, terlama dulu" : "Z ke A, terbaru dulu"
  }
  const go = () => {
    const params = new URLSearchParams(searchParams.toString())
    if (next === "upcoming") params.delete("sort")
    else params.set("sort", next)
    params.delete("page")
    const qs = params.toString()
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }))
  }
  const Arrow = active && parts.direction === "desc" ? ArrowDown : ArrowUp
  return (
    <button
      type="button"
      onClick={go}
      aria-sort={active ? (parts.direction === "asc" ? "ascending" : "descending") : isDefault ? "other" : "none"}
      title={`Urut ${label.toLowerCase()}: ${describe(next)}`}
      className={cn(
        "group/sort inline-flex h-8 items-center gap-1 rounded-md px-1 -mx-1 transition-colors hover:bg-muted hover:text-foreground",
        align === "right" && "flex-row-reverse",
        active && "text-foreground"
      )}
    >
      {label}
      {isDefault && <span className="text-[10px] font-normal normal-case tracking-normal text-muted-foreground">terdekat dulu</span>}
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
      ) : (
        <Arrow
          className={cn(
            "h-3.5 w-3.5 transition-opacity",
            active ? "opacity-100 text-primary" : "opacity-0 group-hover/sort:opacity-60"
          )}
        />
      )}
    </button>
  )
}
