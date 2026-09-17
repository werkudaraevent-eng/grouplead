"use client"

import { useRef, useState, type ReactNode } from "react"
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
import { MODE_LABELS, SIZE_CELLS, SIZE_LABELS, WIDGET_SIZES, sizeFits, sizeFromCells, type WidgetMode, type WidgetSize } from "@/lib/reporting/cube"
import { cn } from "@/lib/utils"

/**
 * The card around a widget: a title in label weight, what the card offers
 * on the right (the Umum / Per sales switch, a filter chip), and in edit
 * mode a grip, a menu and a corner handle that resizes by whole cells,
 * never below the card's minimum (Android home-screen widgets). A
 * container, so the body can adapt to the cell's size rather than the
 * screen's.
 */

/** Gap between cells in the grid, so a drag across one gap counts as one cell. */
const GRID_GAP = 16

function ResizeHandle({
  card,
  size,
  minSize,
  onSize,
}: {
  card: React.RefObject<HTMLElement | null>
  size: WidgetSize
  minSize: WidgetSize
  onSize: (size: WidgetSize) => void
}) {
  const [preview, setPreview] = useState<WidgetSize | null>(null)
  const drag = useRef<{ pointerId: number; x: number; y: number; width: number; height: number; unit: number } | null>(null)

  const targetFor = (dx: number, dy: number): WidgetSize => {
    const state = drag.current
    if (!state) return size
    const [minCols, minRows] = SIZE_CELLS[minSize]
    const step = state.unit + GRID_GAP
    const cols = Math.min(2, Math.max(minCols, Math.round((state.width + dx + GRID_GAP) / step)))
    const rows = Math.min(2, Math.max(minRows, Math.round((state.height + dy + GRID_GAP) / step)))
    return sizeFromCells(cols, rows)
  }

  return (
    <>
      {preview && (
        <span className="pointer-events-none absolute bottom-8 right-2 rounded-md bg-foreground px-2 py-1 text-[11px] font-medium text-background" aria-live="polite">
          {SIZE_LABELS[preview]} · {SIZE_CELLS[preview][0]}×{SIZE_CELLS[preview][1]}
        </span>
      )}
      <button
        type="button"
        aria-label={`Ubah ukuran, sekarang ${SIZE_LABELS[size]}`}
        title="Tarik untuk mengubah ukuran"
        className="absolute bottom-0 right-0 grid h-7 w-7 cursor-nwse-resize touch-none place-items-end p-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        onPointerDown={(event) => {
          event.stopPropagation()
          event.preventDefault()
          const element = card.current
          if (!element || event.button !== 0) return
          const rect = element.getBoundingClientRect()
          const [cols] = SIZE_CELLS[size]
          const unit = (rect.width - GRID_GAP * (cols - 1)) / cols
          drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, width: rect.width, height: rect.height, unit }
          event.currentTarget.setPointerCapture(event.pointerId)
          setPreview(size)
        }}
        onPointerMove={(event) => {
          const state = drag.current
          if (!state || state.pointerId !== event.pointerId) return
          const target = targetFor(event.clientX - state.x, event.clientY - state.y)
          setPreview(target)
          // Applied as the pointer crosses a cell, so the board reflows
          // under the hand (Android's widget resize), not on release.
          if (target !== size) onSize(target)
        }}
        onPointerUp={(event) => {
          const state = drag.current
          if (!state || state.pointerId !== event.pointerId) return
          drag.current = null
          setPreview(null)
        }}
        onPointerCancel={() => {
          drag.current = null
          setPreview(null)
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" className="fill-current">
          <path d="M9 1v8H1z" opacity="0.35" />
          <path d="M9 5v4H5z" />
        </svg>
      </button>
    </>
  )
}
export function WidgetShell({
  title,
  editing,
  size,
  minSize,
  modes,
  mode,
  onMode,
  filterChip,
  truncated,
  onSize,
  onHide,
  onEdit,
  onRemove,
  children,
}: {
  title: string
  editing: boolean
  size: WidgetSize
  minSize: WidgetSize
  modes?: readonly WidgetMode[]
  mode: WidgetMode
  onMode: (mode: WidgetMode) => void
  filterChip?: string
  truncated?: boolean
  onSize: (size: WidgetSize) => void
  onHide: () => void
  onEdit?: () => void
  onRemove?: () => void
  children: ReactNode
}) {
  const stop = (event: React.PointerEvent) => event.stopPropagation()
  const card = useRef<HTMLElement | null>(null)
  return (
    <section ref={card} className="@container relative flex h-full w-full flex-col" aria-label={title}>
      <header className="flex shrink-0 items-center gap-2 px-4 pb-1 pt-3">
        {editing && <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
        <h3 className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{title}</h3>
        <div className="flex shrink-0 items-center gap-1" onPointerDown={stop}>
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
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Ukuran</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={size} onValueChange={(value) => onSize(value as WidgetSize)}>
                  {WIDGET_SIZES.map((item) => (
                    <DropdownMenuRadioItem key={item} value={item} disabled={!sizeFits(item, minSize)}>
                      {SIZE_LABELS[item]} · {SIZE_CELLS[item][0]}×{SIZE_CELLS[item][1]}
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
      {editing && <ResizeHandle card={card} size={size} minSize={minSize} onSize={onSize} />}
    </section>
  )
}
