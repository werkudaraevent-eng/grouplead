"use client"

import { useRef, useState, type CSSProperties } from "react"
import { SlidersHorizontal } from "@/components/icons"
import { AddFilter } from "@/components/add-filter"
import type { FacetSpec } from "@/components/facet-select"
import { Button } from "@/components/ui/button"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { useCompact } from "@/hooks/use-compact"
import { useQuickReturn } from "@/hooks/use-quick-return"
import { cn } from "@/lib/utils"
import { SavedViewsSheetSection } from "@/components/list-view/saved-views-sheet"
import { ViewTools } from "@/components/list-view/view-tools"
import { ListCount } from "@/components/list-view/list-count"
import { useListView } from "@/components/list-view/list-view-provider"

/**
 * The frame every filterable list shares: search, facets, and a way to
 * clear everything.
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
 * Inside a `ListViewProvider` the frame also carries the list's view. On a
 * desk the view tools (the "Tampilan" menu, which chooses and manages the
 * saved views, and the columns menu) sit at the trailing edge of the bar's
 * first line, and nothing is drawn above the bar, so saving a view never
 * moves the table. On a phone the saved views are at the top of the Filter
 * sheet. Search, facets and "Bersihkan semua" flow in one group that wraps
 * onto a second line when there is more than fits, so an applied filter is
 * always in sight.
 *
 * The count ("X dari Y", "Menyaring…") is not part of the bar on a desk:
 * it sits at the leading end of the table's footer, level with the paging
 * (`MissionPagination`), and the bar holds controls only. On a phone it
 * stays under the search and chips, above the cards (`ListCount`).
 *
 * On a phone the search and both chip rows are one block that scrolls
 * away as the reader reads down the cards and returns, pinned under the
 * top app bar, the moment they scroll up (M3 top app bar "enter always";
 * Gmail, Google Contacts), so the records get the screen and the controls
 * are never more than a flick away (`useQuickReturn`). The count is not in
 * the block: it scrolls away with the cards and stays where it was.
 * Search row, chip rows, count and first card sit 12px apart.
 */
export function FilterBarFrame({
  activeCount,
  search,
  quick,
  facets,
  more = [],
  onClearAll,
  chips,
  pinBelow = "0px",
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
  /**
   * The active-filter chips (already including "Bersihkan semua"), or null
   * when none; shown on a phone. What `quick` already shows is left out.
   */
  chips: React.ReactNode
  /**
   * On a phone, the height of a row already pinned at the top of the
   * page's scroller (Laporan's tabs, `REPORT_TABS_HEIGHT`), so the search
   * and chips pin under it rather than behind it. A CSS length.
   */
  pinBelow?: string
}) {
  const compact = useCompact()
  const listView = useListView()
  const [open, setOpen] = useState(false)
  const block = useRef<HTMLDivElement>(null)
  const count = useRef<HTMLDivElement>(null)
  // The Filter sheet opened from the block keeps it in view while open.
  const { hidden, stuck } = useQuickReturn({ block, after: count, enabled: compact, held: open })
  // A facet picked from "+ Filter" stays in the bar while empty until its list closes.
  const [revealed, setRevealed] = useState<string | null>(null)

  if (!compact) {
    const shown = more.filter((spec) => spec.active || spec.key === revealed)
    const hidden = more.filter((spec) => !spec.active && spec.key !== revealed)
    return (
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
        </div>
        {listView && (
          <div className="-my-0.5 flex h-10 shrink-0 items-center gap-1">
            <ViewTools />
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {/* Sticky in `#page-scroll` (the fragment's parent), whose 12px top
          padding on a phone a sticky box pins inside of: `top` takes it
          back so the block pins flush under the app bar (or under
          `pinBelow`), and `-mt-3 pt-3` keeps it where it was at rest while
          giving it the same 12px above the search once pinned. Edge to
          edge, opaque, over the cards (z-10) and under the Laporan tabs
          (z-20), the FAB, the navigation bar and every sheet and menu. */}
      <div
        ref={block}
        inert={hidden}
        data-quick-return={hidden ? "hidden" : stuck ? "pinned" : "rest"}
        style={{ "--list-bar-top": pinBelow } as CSSProperties}
        className={cn(
          "sticky top-[calc(var(--list-bar-top)_-_0.75rem)] z-10 -mx-4 -mt-3 flex flex-col gap-3 border-b bg-background px-4 pt-3 pb-[11px] sm:-mx-6 sm:px-6",
          "motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out",
          stuck ? "border-border" : "border-transparent",
          hidden && "pointer-events-none -translate-y-[calc(100%_+_var(--list-bar-top))]"
        )}
      >
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
        {/* The rows' own padding is room for focus rings and the chips'
            remove targets inside their sideways scroller; the matching
            negative margin keeps it out of the 12px rhythm. */}
        {quick && (
          <div className="chip-scroll -mx-4 -my-0.5 flex items-center overflow-x-auto px-4 py-0.5 sm:-mx-6 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex shrink-0 items-center gap-2">{quick}</div>
          </div>
        )}
        {chips && (
          <div className="chip-scroll -mx-4 -mb-1 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex shrink-0 items-center gap-1.5">{chips}</div>
          </div>
        )}
      </div>
      <div ref={count} className="mb-3 text-xs text-muted-foreground">
        <ListCount place="phone" className="ml-auto flex items-center gap-2 text-xs text-muted-foreground" />
      </div>
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
    </>
  )
}
