"use client"

import { Check, Star } from "@/components/icons"
import type { SavedListView } from "@/lib/lists/list-views"
import { cn } from "@/lib/utils"
import { useListView } from "./list-view-provider"

/**
 * On a phone the views are chosen inside the Filter sheet, above the
 * facets, so the list still opens on its search and records; saving and
 * arranging are desk work (LeadEngine: "save view and columns are desk
 * tools"). On a desk the same views are chosen from the "Tampilan" menu
 * (`ViewMenu`).
 */
export function SavedViewsSheetSection({ onChosen }: { onChosen?: () => void }) {
  const view = useListView()
  if (!view || view.views.length === 0) return null
  return (
    <div className="px-2 pb-3">
      <p className="mb-2 text-xs font-semibold text-muted-foreground">Tampilan tersimpan</p>
      <div role="group" aria-label="Tampilan tersimpan" className="flex flex-wrap gap-x-2 gap-y-4 py-2">
        {view.views.map((saved) => (
          <ViewChip
            key={saved.id}
            saved={saved}
            active={view.marked?.id === saved.id}
            onSelect={() => {
              view.selectView(saved)
              onChosen?.()
            }}
          />
        ))}
      </div>
      <div className="mt-3 border-t" />
    </div>
  )
}

/**
 * A saved view as an M3 choice chip: 32dp, 8dp corners, outlined at rest,
 * tonal with a leading check while its view is exactly what the screen
 * shows; the default view carries a star.
 */
function ViewChip({ saved, active, onSelect }: { saved: SavedListView; active: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        // M3 choice chip: 32dp, 8dp corners, outlined at rest, tonal with a
        // leading check when chosen; the 48dp target from the pseudo-element.
        "relative inline-flex h-8 max-w-64 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors after:absolute after:inset-x-0 after:-inset-y-2 after:content-['']",
        active ? "border-transparent bg-[var(--tonal)] font-medium text-[var(--tonal-foreground)]" : "border-input bg-transparent text-foreground hover:bg-muted",
      )}
    >
      {active && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
      {saved.isDefault && !active && <Star className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
      <span className="truncate">{saved.name}</span>
      {saved.isDefault && <span className="sr-only"> (bawaan)</span>}
    </button>
  )
}
