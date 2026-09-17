"use client"

import type { ReactNode } from "react"
import { AlertTriangle, GripVertical, MoreVertical } from "@/components/icons"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Segmented } from "@/components/segmented"
import { MODE_LABELS, SIZE_LABELS, WIDGET_SIZES, sizeFits, type WidgetMode, type WidgetSize } from "@/lib/reporting/cube"
import { cn } from "@/lib/utils"

/**
 * The card around a widget: a title in label weight, what the card offers
 * on the right (the Umum / Per sales switch, a filter chip), and in edit
 * mode a grip (the whole header is the drag handle) and a menu with four
 * preset sizes; free resizing is the grid's corner handle. A container,
 * so the body can adapt to the cell's size rather than the screen's.
 */
export function WidgetShell({
  title,
  editing,
  preset,
  minSize,
  modes,
  mode,
  onMode,
  filterChip,
  truncated,
  onPreset,
  onHide,
  onEdit,
  onRemove,
  children,
}: {
  title: string
  editing: boolean
  /** The preset the card's box matches, if any. */
  preset: WidgetSize | null
  minSize: WidgetSize
  modes?: readonly WidgetMode[]
  mode: WidgetMode
  onMode: (mode: WidgetMode) => void
  filterChip?: string
  truncated?: boolean
  onPreset: (size: WidgetSize) => void
  onHide: () => void
  onEdit?: () => void
  onRemove?: () => void
  children: ReactNode
}) {
  // The controls on the right are not a drag handle.
  const stop = (event: React.SyntheticEvent) => event.stopPropagation()
  return (
    <section className="@container relative flex h-full w-full flex-col" aria-label={title}>
      <header className={cn("flex shrink-0 items-center gap-2 px-4 pb-1 pt-3", editing && "widget-drag-handle cursor-grab select-none active:cursor-grabbing")}>
        {editing && <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
        <h3 className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{title}</h3>
        <div className="flex shrink-0 items-center gap-1" onPointerDown={stop} onMouseDown={stop} onTouchStart={stop}>
          {filterChip && <span className="hidden max-w-[8rem] truncate rounded-md bg-[var(--tonal)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--tonal-foreground)] @[300px]:inline">{filterChip}</span>}
          {truncated && (
            <span className="text-[var(--warning-foreground)]" title="Data dipotong: terlalu banyak baris untuk ditampilkan semua">
              <AlertTriangle className="h-3.5 w-3.5" aria-label="Data dipotong" />
            </span>
          )}
          {modes && modes.length > 1 && !editing && (
            <Segmented
              label="Tampilan"
              size="sm"
              value={mode}
              options={modes.map((item) => ({ value: item, label: MODE_LABELS[item] }))}
              onChange={onMode}
              className="hidden @[300px]:inline-flex"
            />
          )}
          {editing && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground" aria-label={`Menu ${title}`}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Ukuran cepat</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={preset ?? ""} onValueChange={(value) => onPreset(value as WidgetSize)}>
                  {WIDGET_SIZES.map((item) => (
                    <DropdownMenuRadioItem key={item} value={item} disabled={!sizeFits(item, minSize)}>
                      {SIZE_LABELS[item]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                {modes && modes.length > 1 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Tampilan</DropdownMenuLabel>
                    <DropdownMenuRadioGroup value={mode} onValueChange={(value) => onMode(value as WidgetMode)}>
                      {modes.map((item) => (
                        <DropdownMenuRadioItem key={item} value={item}>
                          {MODE_LABELS[item]}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </>
                )}
                <DropdownMenuSeparator />
                {onEdit && <DropdownMenuItem onSelect={onEdit}>Ubah widget</DropdownMenuItem>}
                <DropdownMenuItem onSelect={onHide}>Sembunyikan</DropdownMenuItem>
                {onRemove && (
                  <DropdownMenuItem onSelect={onRemove} className="text-destructive focus:text-destructive">
                    Hapus widget
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>
      <div className={cn("min-h-0 flex-1 px-4 pb-4 pt-1", editing && "pointer-events-none select-none")}>{children}</div>
    </section>
  )
}
