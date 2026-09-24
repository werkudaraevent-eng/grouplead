"use client"

import { useState, type ReactNode } from "react"
import { DropdownMenu as MenuPrimitive } from "radix-ui"
import { Bookmark, Check, ChevronDown, Pencil, Save, Star, StarOff, Trash2 } from "@/components/icons"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PLAIN_VIEW_ID, freeViewName, viewMenuModel, type SavedListView } from "@/lib/lists/list-views"
import { useListView } from "./list-view-provider"
import { ViewNameDialog } from "./view-name-dialog"

type NameDialog = { kind: "save"; saved: null } | { kind: "copy" | "rename"; saved: SavedListView }

const DIALOG_COPY: Record<NameDialog["kind"], { title: string; description: string; action: string }> = {
  save: {
    title: "Simpan tampilan",
    description: "Pencarian, filter, urutan, jumlah baris, dan kolom yang tampil sekarang disimpan dengan satu nama, lalu bisa dibuka lagi dari tombol Tampilan.",
    action: "Simpan",
  },
  copy: {
    title: "Simpan sebagai tampilan baru",
    description: "Daftar seperti yang tampil sekarang disimpan dengan nama baru; tampilan asalnya tidak berubah.",
    action: "Simpan",
  },
  rename: {
    title: "Ubah nama tampilan",
    description: "Nama baru untuk tampilan ini. Isinya tidak berubah.",
    action: "Ubah nama",
  },
}

/**
 * The person's saved views of a list, on a desk: one "Tampilan" menu
 * button at the trailing edge of the filter bar's first line, before the
 * columns menu (M3 menu; Linear's and Notion's view switcher). An outlined
 * button with 8dp corners, as tall as the facets beside it; its label names
 * the view the screen shows exactly, else "Tampilan", cut at 12rem.
 *
 * The menu lists "Tampilan awal" (the list as it first opens, with no view
 * chosen) and each view, a check on the one shown and a star on the
 * default; choosing one opens it. Under a divider come the actions, each
 * only when it applies (`viewMenuModel`): "Simpan tampilan" while the list
 * differs from how it first opens and no view is in hand, then, headed by
 * the name of the view in hand, "Simpan perubahan" and "Simpan sebagai
 * tampilan baru" while that view has been changed, "Ubah nama", "Jadikan
 * bawaan" / "Bukan bawaan lagi", and "Hapus", which asks nothing because
 * the snackbar's "Batalkan" brings the view back.
 *
 * A chip row of views above the toolbar was the earlier way and was
 * dropped: it cost a 48dp row for one or two chips and moved the table down
 * the moment the first view was saved. The button is always drawn once
 * views exist as a feature (`available`), so saving never moves anything.
 */
export function ViewMenu() {
  const view = useListView()
  // The dialog's content outlives its opening, so the title does not change while it closes.
  const [dialog, setDialog] = useState<NameDialog>({ kind: "save", saved: null })
  const [dialogOpen, setDialogOpen] = useState(false)
  if (!view || !view.available) return null

  const model = viewMenuModel(view)
  const manage = model.manage
  const openDialog = (next: NameDialog) => {
    setDialog(next)
    setDialogOpen(true)
  }
  const label = view.marked?.name ?? "Tampilan"
  const copy = DIALOG_COPY[dialog.kind]

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 max-w-48 gap-1.5 md:h-9"
            aria-label={view.marked ? `Tampilan: ${view.marked.name}` : undefined}
            title={view.marked ? view.marked.name : undefined}
          >
            <span className="truncate">{label}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        {/* M3 menu: it never runs past the window; past its cap only the menu scrolls. */}
        <DropdownMenuContent align="end" collisionPadding={16} className="w-64 max-h-[min(var(--radix-dropdown-menu-content-available-height),32rem)]">
          <DropdownMenuRadioGroup value={model.shown ?? ""} aria-label="Tampilan">
            <ViewItem
              value={PLAIN_VIEW_ID}
              onSelect={() => {
                if (model.shown !== PLAIN_VIEW_ID) view.selectPlain()
              }}
            >
              <span className="min-w-0 flex-1 truncate">Tampilan awal</span>
            </ViewItem>
            {view.views.map((saved) => (
              <ViewItem key={saved.id} value={saved.id} onSelect={() => view.selectView(saved)}>
                <span className="min-w-0 flex-1 truncate" title={saved.name}>
                  {saved.name}
                </span>
                {saved.isDefault && (
                  <>
                    <Star className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="sr-only"> (bawaan)</span>
                  </>
                )}
              </ViewItem>
            ))}
          </DropdownMenuRadioGroup>

          {(model.save || manage || view.views.length === 0) && <DropdownMenuSeparator />}
          {model.save && (
            <DropdownMenuItem onSelect={() => openDialog({ kind: "save", saved: null })}>
              <Bookmark className="h-4 w-4" /> Simpan tampilan
            </DropdownMenuItem>
          )}
          {manage && (
            <>
              <DropdownMenuLabel className="truncate pb-1 pt-2 text-xs text-muted-foreground" title={manage.name}>
                {manage.name}
              </DropdownMenuLabel>
              {model.saveChanges && (
                <>
                  <DropdownMenuItem onSelect={() => void view.saveChanges()} disabled={view.busy}>
                    <Save className="h-4 w-4" /> Simpan perubahan
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => openDialog({ kind: "copy", saved: manage })}>
                    <Bookmark className="h-4 w-4" /> Simpan sebagai tampilan baru
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem onSelect={() => openDialog({ kind: "rename", saved: manage })}>
                <Pencil className="h-4 w-4" /> Ubah nama
              </DropdownMenuItem>
              {manage.isDefault ? (
                <DropdownMenuItem onSelect={() => void view.toggleDefault(manage)}>
                  <StarOff className="h-4 w-4" /> Bukan bawaan lagi
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => void view.toggleDefault(manage)}>
                  <Star className="h-4 w-4" /> Jadikan bawaan
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => void view.remove(manage)}
                className="text-[var(--danger-foreground)] focus:text-[var(--danger-foreground)]"
              >
                <Trash2 className="h-4 w-4" /> Hapus
              </DropdownMenuItem>
            </>
          )}
          {!model.save && !manage && view.views.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">Atur daftarnya dulu (cari, filter, urutan, atau kolom), lalu simpan di sini sebagai tampilan.</p>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ViewNameDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={copy.title}
        description={copy.description}
        initialName={dialog.kind === "rename" ? dialog.saved.name : dialog.kind === "copy" ? freeViewName(dialog.saved.name, view.views) : ""}
        action={copy.action}
        onSubmit={(name) => (dialog.kind === "rename" ? view.rename(dialog.saved, name) : view.saveAs(name))}
      />
    </>
  )
}

/**
 * A view to choose: a menu radio item whose indicator is a leading check
 * (M3 menu, selected item), in the slot where the actions carry their icon.
 */
function ViewItem({ value, onSelect, children }: { value: string; onSelect: () => void; children: ReactNode }) {
  return (
    <MenuPrimitive.RadioItem
      value={value}
      onSelect={onSelect}
      className="relative flex min-h-11 cursor-pointer select-none items-center gap-2 rounded-sm py-1.5 pl-8 pr-2 text-sm outline-hidden focus:bg-muted focus:text-foreground data-[state=checked]:font-medium md:min-h-8"
    >
      <span className="pointer-events-none absolute left-2 flex size-4 items-center justify-center">
        <MenuPrimitive.ItemIndicator>
          <Check className="size-4" aria-hidden="true" />
        </MenuPrimitive.ItemIndicator>
      </span>
      {children}
    </MenuPrimitive.RadioItem>
  )
}
