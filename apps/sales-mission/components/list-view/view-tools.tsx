"use client"

import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from "react"
import { Bookmark, Columns, GripVertical, Lock, RotateCcw } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { moveColumn, shownCount, toggleColumn } from "@/lib/lists/list-columns"
import { cn } from "@/lib/utils"
import { useListView } from "./list-view-provider"
import { ViewNameDialog } from "./view-name-dialog"

/**
 * The view tools at the trailing edge of a list's filter bar, on a desk:
 * "Simpan tampilan" once the list differs from how it first opens, then
 * the columns menu. Both are 40dp icon buttons with their name as the
 * accessible label and the hover title (LeadEngine's `ToolbarIconButton`).
 * A phone shows cards, not columns, and saving a view is desk work.
 */
export function ViewTools() {
  const view = useListView()
  if (!view) return null
  return (
    <>
      {view.available && view.customised && <SaveViewButton />}
      <ColumnsMenu />
    </>
  )
}

const iconButton = "h-10 w-10 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"

function SaveViewButton() {
  const view = useListView()
  const [open, setOpen] = useState(false)
  if (!view) return null
  return (
    <>
      <Button type="button" variant="ghost" size="icon-lg" className={iconButton} aria-label="Simpan tampilan" title="Simpan tampilan" onClick={() => setOpen(true)}>
        <Bookmark className="h-5 w-5" />
      </Button>
      <ViewNameDialog
        open={open}
        onOpenChange={setOpen}
        title="Simpan tampilan"
        description="Pencarian, filter, urutan, jumlah baris, dan kolom yang tampil sekarang disimpan dengan satu nama, lalu bisa dibuka lagi dengan satu ketukan di atas daftar."
        onSubmit={view.saveAs}
      />
    </>
  )
}

/**
 * Which optional columns show, in which order: a checkbox per column and
 * a handle to drag it (M3 menu with checkboxes; Gmail, HubSpot, Airtable,
 * LeadEngine's `ColumnsMenu`). No badge on the button: an M3 badge marks
 * something new or waiting, not a setting, so "N dari M tampil" is said
 * inside. The name column is listed first, locked, because it is always
 * shown and frozen. The handle also moves a column with the arrow keys.
 */
function ColumnsMenu() {
  const view = useListView()
  const [dragging, setDragging] = useState<number | null>(null)
  const listRef = useRef<HTMLUListElement>(null)
  // A column moved with the keyboard keeps focus on its handle: React may
  // re-insert the moved row, which drops focus. Refocused without scrolling.
  const refocus = useRef<string | null>(null)
  const columnsKey = view?.columns.map((column) => column.id).join(",")
  useEffect(() => {
    const id = refocus.current
    if (!id) return
    refocus.current = null
    listRef.current?.querySelector<HTMLButtonElement>(`[data-column-handle="${id}"]`)?.focus({ preventScroll: true })
  }, [columnsKey])
  if (!view) return null
  const { specs, columns } = view
  const byId = new Map(specs.map((spec) => [spec.id, spec]))
  const locked = specs.filter((spec) => spec.locked)
  const count = shownCount(specs, columns)

  const drop = (event: DragEvent, index: number) => {
    event.preventDefault()
    const from = dragging ?? Number.parseInt(event.dataTransfer.getData("text/plain"), 10)
    setDragging(null)
    if (Number.isNaN(from)) return
    view.setColumns(moveColumn(columns, from, index))
  }

  const nudge = (event: KeyboardEvent, index: number, id: string) => {
    const to = event.key === "ArrowUp" ? index - 1 : event.key === "ArrowDown" ? index + 1 : null
    if (to === null) return
    event.preventDefault()
    refocus.current = id
    view.setColumns(moveColumn(columns, index, to))
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon-lg" className={iconButton} aria-label="Kolom" title="Kolom">
          <Columns className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      {/* M3 menu: it never runs past the window. Its height is capped at the
          room Radix measures below (or above) the trigger, the title and
          Susunan awal stay put, and only the list scrolls. */}
      <PopoverContent align="end" collisionPadding={16} className="flex w-72 flex-col p-0 max-h-[min(var(--radix-popover-content-available-height),32rem)]">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Kolom</p>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {count.shown} dari {count.total} tampil
            </p>
          </div>
          <button type="button" onClick={view.resetColumns} className="inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-primary hover:underline">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Susunan awal
          </button>
        </div>
        <p className="shrink-0 px-4 pb-1 pt-2 text-[11px] text-muted-foreground">Centang untuk menampilkan · seret untuk mengurutkan</p>
        <ul ref={listRef} className="custom-scrollbar flex min-h-0 flex-1 overscroll-contain flex-col gap-0.5 overflow-y-auto px-2 pb-2">
          {locked.map((spec) => (
            <li key={spec.id} className="flex items-center justify-between gap-2 rounded-md py-2 pl-2 pr-2">
              <span className="flex min-w-0 items-center gap-3">
                <Checkbox checked disabled aria-label={`${spec.label} selalu tampil`} />
                <span className="truncate text-[13px] font-medium text-foreground">{spec.label}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Selalu tampil
              </span>
            </li>
          ))}
          {columns.map((column, index) => {
            const spec = byId.get(column.id)
            if (!spec) return null
            return (
              <li
                key={column.id}
                draggable
                onDragStart={(event) => {
                  setDragging(index)
                  event.dataTransfer.setData("text/plain", String(index))
                  event.dataTransfer.effectAllowed = "move"
                }}
                onDragEnd={() => setDragging(null)}
                onDragOver={(event) => {
                  event.preventDefault()
                  event.dataTransfer.dropEffect = "move"
                }}
                onDrop={(event) => drop(event, index)}
                className={cn(
                  "group flex cursor-grab items-center justify-between gap-2 rounded-md py-1 pl-2 pr-1 hover:bg-muted active:cursor-grabbing",
                  dragging === index && "opacity-50",
                )}
              >
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-1">
                  <Checkbox checked={column.visible} onCheckedChange={(checked) => view.setColumns(toggleColumn(columns, column.id, checked === true))} aria-label={`Tampilkan ${spec.label}`} />
                  <span className={cn("truncate text-[13px]", column.visible ? "font-medium text-foreground" : "text-muted-foreground")}>{spec.label}</span>
                </label>
                <button
                  type="button"
                  data-column-handle={column.id}
                  onKeyDown={(event) => nudge(event, index, column.id)}
                  aria-label={`Geser ${spec.label} (panah atas atau bawah)`}
                  title="Seret, atau tekan panah atas/bawah"
                  className="grid h-8 w-8 shrink-0 cursor-grab place-items-center rounded-md text-muted-foreground/60 hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <GripVertical className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
