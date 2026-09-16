"use client"

import { useState } from "react"
import { SlidersHorizontal } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { useCompact } from "@/hooks/use-compact"
import { cn } from "@/lib/utils"

/**
 * The frame every filterable list shares: search, facets, a count, and
 * the active filters as removable chips.
 *
 * On a desk the facets sit in one wrapping row beside the search field,
 * as before. On a phone seven facet buttons cost four rows of chrome
 * before the first card, so they move behind one "Filter" button that
 * carries the active count and opens a bottom sheet (Material's filter
 * pattern for compact windows); the active chips stay visible in one row
 * that scrolls sideways rather than stacking.
 */
export function FilterBarFrame({
  activeCount,
  search,
  facets,
  summary,
  chips,
}: {
  activeCount: number
  search: React.ReactNode
  facets: React.ReactNode
  summary: React.ReactNode
  /** The active-filter chips (already including "Bersihkan semua"), or null when none. */
  chips: React.ReactNode
}) {
  const compact = useCompact()
  const [open, setOpen] = useState(false)

  if (!compact) {
    return (
      <div className="mb-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {search}
          {facets}
          {summary}
        </div>
        {chips && <div className="flex flex-wrap items-center gap-1.5">{chips}</div>}
      </div>
    )
  }

  return (
    <div className="mb-4 space-y-2">
      <div className="flex items-center gap-2">
        {search}
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={cn("h-11 shrink-0 gap-2", activeCount > 0 && "border-primary/50 bg-primary/5")}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filter
          {activeCount > 0 && (
            <span className="rounded-full bg-primary px-1.5 text-[11px] font-bold tabular-nums text-primary-foreground">{activeCount}</span>
          )}
        </Button>
      </div>
      {chips && (
        <div className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex shrink-0 items-center gap-1.5">{chips}</div>
        </div>
      )}
      <div className="text-xs text-muted-foreground">{summary}</div>
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title="Filter"
        description="Pilih satu atau beberapa; daftar menyaring langsung."
        footer={
          <Button type="button" className="h-12 w-full" onClick={() => setOpen(false)}>
            Selesai
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-2 px-2 pb-2">{facets}</div>
      </BottomSheet>
    </div>
  )
}
