"use client"

import { useState } from "react"
import { SlidersHorizontal } from "@/components/icons"
import { AddFilter } from "@/components/add-filter"
import type { FacetSpec } from "@/components/facet-select"
import { Button } from "@/components/ui/button"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { useCompact } from "@/hooks/use-compact"
import { cn } from "@/lib/utils"
import { SavedViewsBar, SavedViewsSheetSection } from "@/components/list-view/saved-views-bar"
import { ViewTools } from "@/components/list-view/view-tools"
import { useListView } from "@/components/list-view/list-view-provider"

/**
 * The frame every filterable list shares: search, facets, a count, and a
 * way to clear everything.
 *
 * On a desk the bar is one row: the everyday facets always in view, then
 * every facet from `more` that is in use, then "+ Filter" for the rest
 * (Linear, Notion, Jira). A facet's button carries its value, so the bar
 * is its own summary and needs no chip row under it. On a phone every
 * facet moves behind one "Filter" button into a bottom sheet, and the
 * active ones are repeated as a sideways-scrolling chip row, because there
 * the facets themselves are out of sight.
 *
 * The list's everyday narrowings (`quick`: toggle chips such as "Saya",
 * and a facet promoted beside them such as Tanggal) are part of the bar on
 * a desk, right after the everyday facets, never a row of their own above
 * it: a row of chips that were values of the bar's own facets showed one
 * state twice ("Hari ini" and "Tanggal: Hari ini"). On a phone they stay
 * one tap away, in a sideways-scrolling row under the search, outside the
 * sheet: search is the first control of every list a person carries in a
 * pocket (Gmail, Google Maps, Linear), and these narrow what it found.
 *
 * Inside a `ListViewProvider` the frame also carries the list's view: the
 * saved views as a chip row above everything on a desk (only once one
 * exists) and at the top of the Filter sheet on a phone, and the view
 * tools ("Simpan tampilan", the columns menu) at the trailing edge of the
 * bar's first line, on a desk only. Search, facets and "Bersihkan semua"
 * flow in one group that wraps onto a second line when there is more than
 * fits, so an applied filter is always in sight.
 */
export function FilterBarFrame({
  activeCount,
  search,
  quick,
  facets,
  more = [],
  onClearAll,
  summary,
  chips,
}: {
  activeCount: number
  search: React.ReactNode
  /**
   * The list's everyday one-tap narrowings, when it has them: in the bar
   * after `facets` on a desk, in a row under the search on a phone (and so
   * not in the sheet).
   */
  quick?: React.ReactNode
  /** The facets always in view on a desk. */
  facets: React.ReactNode
  /** Facets shown on a desk only while in use, added from "+ Filter". */
  more?: FacetSpec[]
  onClearAll: () => void
  summary: React.ReactNode
  /**
   * The active-filter chips (already including "Bersihkan semua"), or null
   * when none; shown on a phone. What `quick` already shows is left out.
   */
  chips: React.ReactNode
}) {
  const compact = useCompact()
  const listView = useListView()
  const [open, setOpen] = useState(false)
  // A facet picked from "+ Filter" stays in the bar while empty until its list closes.
  const [revealed, setRevealed] = useState<string | null>(null)

  if (!compact) {
    const shown = more.filter((spec) => spec.active || spec.key === revealed)
    const hidden = more.filter((spec) => !spec.active && spec.key !== revealed)
    return (
      <>
      <SavedViewsBar />
      <div className="mb-4 flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {search}
          {facets}
          {quick}
          {shown.map((spec) => (
            <span key={spec.key} className="contents">
              {spec.render({
                initiallyOpen: spec.key === revealed,
                onOpenChange: (isOpen) => {
                  if (!isOpen && spec.key === revealed) setRevealed(null)
                },
              })}
            </span>
          ))}
          <AddFilter specs={hidden} onPick={setRevealed} />
          {activeCount > 0 && (
            <button type="button" onClick={onClearAll} className="text-xs font-semibold text-primary hover:underline">
              Bersihkan semua
            </button>
          )}
          {summary}
        </div>
        {listView && (
          <div className="-my-0.5 flex h-10 shrink-0 items-center gap-1">
            <ViewTools />
          </div>
        )}
      </div>
      </>
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
          {activeCount > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] font-bold tabular-nums text-primary-foreground">{activeCount}</span>}
        </Button>
      </div>
      {quick && (
        <div className="chip-scroll -mx-4 flex items-center overflow-x-auto px-4 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex shrink-0 items-center gap-2">{quick}</div>
        </div>
      )}
      {chips && (
        <div className="chip-scroll -mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
        <SavedViewsSheetSection onChosen={() => setOpen(false)} />
        <div className="flex flex-wrap items-center gap-2 px-2 pb-2">
          {facets}
          {more.map((spec) => (
            <span key={spec.key} className="contents">
              {spec.render({})}
            </span>
          ))}
        </div>
      </BottomSheet>
    </div>
  )
}
