"use client"

import { Plus, Sparkles } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useCompact } from "@/hooks/use-compact"
import { MAX_CUSTOM_WIDGETS } from "@/lib/reporting/dashboard-layout"
import type { WidgetConfig } from "@/lib/reporting/cube"

/**
 * What is not on the board: the built-ins the person hid, each with one
 * line on what it answers and a "Tampilkan"; then "Widget baru" for a
 * card they compose themselves.
 */
export function AddWidgetSheet({
  open,
  onOpenChange,
  hidden,
  descriptions,
  customCount,
  onShow,
  onNew,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  hidden: WidgetConfig[]
  descriptions: Record<string, string>
  customCount: number
  onShow: (id: string) => void
  onNew: () => void
}) {
  const compact = useCompact()
  const body = (
    <div className="space-y-4">
      {hidden.length > 0 ? (
        <ul className="divide-y rounded-xl border">
          {hidden.map((widget) => (
            <li key={widget.id} className="flex items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">{widget.title}</span>
                <span className="block text-xs text-muted-foreground">{descriptions[widget.id] ?? "Widget buatan Anda."}</span>
              </span>
              <Button type="button" variant="outline" size="sm" onClick={() => onShow(widget.id)}>
                Tampilkan
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Semua widget bawaan sudah tampil.</p>
      )}
      <div className="rounded-xl border border-dashed p-4">
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" /> Widget baru
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Susun kartu sendiri dari ukuran, pengelompokan, dan bentuk grafik yang ada. Sampai {MAX_CUSTOM_WIDGETS} kartu per orang; sekarang {customCount}.
        </p>
        <Button type="button" size="sm" className="mt-3" onClick={onNew} disabled={customCount >= MAX_CUSTOM_WIDGETS}>
          <Plus className="h-4 w-4" /> Buat widget
        </Button>
      </div>
    </div>
  )

  if (compact) {
    return (
      <BottomSheet open={open} onOpenChange={onOpenChange} title="Tambah widget" description="Tampilkan kartu yang tersembunyi, atau buat kartu sendiri.">
        {body}
      </BottomSheet>
    )
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Tambah widget</SheetTitle>
          <SheetDescription>Tampilkan kartu yang tersembunyi, atau buat kartu sendiri.</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">{body}</div>
      </SheetContent>
    </Sheet>
  )
}
