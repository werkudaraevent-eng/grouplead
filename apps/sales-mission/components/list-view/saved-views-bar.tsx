"use client"

import { useState } from "react"
import { Check, MoreHorizontal, Pencil, Save, Star, StarOff, Trash2 } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { ResponsiveMenu } from "@/components/responsive-menu"
import { freeViewName, type SavedListView } from "@/lib/lists/list-views"
import { cn } from "@/lib/utils"
import { useListView, type ListViewState } from "./list-view-provider"
import { ViewNameDialog } from "./view-name-dialog"

/**
 * The person's saved views of a list, as M3 choice chips: one row above the
 * filter bar on a desk, shown only once a view exists (the first is saved
 * from the bar's "Simpan tampilan"). A chip is tonal with a check only
 * while its view is exactly what the screen shows; the default view
 * carries a star. Beside the chips: "Simpan perubahan" while the view last
 * chosen has been changed, and ⋮ for the view in hand (save as new,
 * rename, default, delete). LeadEngine's `SavedViewsBar`, in the
 * product's words.
 */
export function SavedViewsBar() {
  const view = useListView()
  if (!view || view.views.length === 0) return null
  return (
    <div role="group" aria-label="Tampilan tersimpan" className="mb-3 flex flex-wrap items-center gap-2">
      {view.views.map((saved) => (
        <ViewChip key={saved.id} saved={saved} active={view.marked?.id === saved.id} onSelect={() => view.selectView(saved)} />
      ))}
      <ViewActions view={view} />
    </div>
  )
}

/**
 * On a phone the views are chosen inside the Filter sheet, above the
 * facets, so the list still opens on its search and records; saving and
 * arranging are desk work (LeadEngine: "save view and columns are desk
 * tools").
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

function ViewActions({ view }: { view: ListViewState }) {
  // The dialog's content outlives its opening, so the title does not change while it closes.
  const [dialog, setDialog] = useState<null | { kind: "copy" | "rename"; saved: SavedListView }>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const target = view.target
  if (!target) return null
  const openDialog = (next: { kind: "copy" | "rename"; saved: SavedListView }) => {
    setDialog(next)
    setDialogOpen(true)
  }

  return (
    <span className="flex items-center gap-1">
      {view.dirty && (
        <Button variant="ghost" size="sm" onClick={() => void view.saveChanges()} disabled={view.busy} className="text-primary hover:text-primary">
          <Save className="h-4 w-4" /> Simpan perubahan
        </Button>
      )}
      <ResponsiveMenu
        title={target.name}
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label={`Kelola tampilan “${target.name}”`} title="Kelola tampilan">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        }
        items={[
          view.dirty && { label: "Simpan sebagai tampilan baru", icon: Save, onSelect: () => openDialog({ kind: "copy", saved: target }) },
          { label: "Ubah nama", icon: Pencil, onSelect: () => openDialog({ kind: "rename", saved: target }) },
          target.isDefault
            ? { label: "Bukan bawaan lagi", icon: StarOff, onSelect: () => void view.toggleDefault(target) }
            : { label: "Jadikan bawaan", icon: Star, onSelect: () => void view.toggleDefault(target) },
          { kind: "divider" as const },
          { label: "Hapus", icon: Trash2, danger: true, onSelect: () => void view.remove(target) },
        ]}
      />
      <ViewNameDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={dialog?.kind === "rename" ? "Ubah nama tampilan" : "Simpan sebagai tampilan baru"}
        description={
          dialog?.kind === "rename"
            ? "Nama baru untuk tampilan ini. Isinya tidak berubah."
            : "Daftar seperti yang tampil sekarang disimpan dengan nama baru; tampilan asalnya tidak berubah."
        }
        initialName={dialog ? (dialog.kind === "rename" ? dialog.saved.name : freeViewName(dialog.saved.name, view.views)) : ""}
        action={dialog?.kind === "rename" ? "Ubah nama" : "Simpan"}
        onSubmit={(name) => (dialog?.kind === "rename" ? view.rename(dialog.saved, name) : view.saveAs(name))}
      />
    </span>
  )
}
