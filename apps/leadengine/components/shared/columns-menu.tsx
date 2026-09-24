"use client"

import * as React from "react"
import { Columns, GripVertical, RotateCcw } from "@/components/icons"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { ToolbarIconButton } from "./list-toolbar"

export interface ColumnLike {
  id: string
  label: string
  visible: boolean
}

/**
 * The columns popover shared by the list pages: drag to reorder, a
 * checkbox per column to show or hide it, Reset to the page's default.
 *
 * The trigger is a plain icon button with a tooltip. It used to carry a
 * "5/13" badge, but an M3 badge marks something new or needing attention
 * (unread mail, a notification count), not a setting; a count that never
 * changes unless the person changes it reads as an alert. How many columns
 * are shown is said inside the menu instead, and show/hide is a checkbox
 * list (M3 menu with checkboxes; Gmail, HubSpot and Airtable column
 * pickers), not an eye icon with struck-through text. Persistence is the
 * caller's (`onChange` receives the next list; pass `storageKey` to have
 * it written to localStorage as before).
 */
export function ColumnsMenu<T extends ColumnLike>({
  columns,
  onChange,
  onReset,
  storageKey,
}: {
  columns: T[]
  onChange: (next: T[]) => void
  onReset: () => void
  storageKey?: string
}) {
  const shown = columns.filter((column) => column.visible).length
  const commit = (next: T[]) => {
    onChange(next)
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        // Storage may be unavailable; the order still applies for the session.
      }
    }
  }
  const toggle = (id: string, visible: boolean) => commit(columns.map((column) => (column.id === id ? { ...column, visible } : column)))

  return (
    <Popover>
      <PopoverTrigger asChild>
        <ToolbarIconButton label="Columns">
          <Columns className="h-5 w-5" />
        </ToolbarIconButton>
      </PopoverTrigger>
      {/* M3 menu: it never runs past the window. Its height is capped at the
          room Radix measures around the trigger, the title and Reset stay
          put, and only the list scrolls. */}
      <PopoverContent align="end" collisionPadding={16} className="flex w-72 flex-col p-0 max-h-[min(var(--radix-popover-content-available-height),32rem)]">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Columns</p>
            <p className="text-xs text-muted-foreground">{shown} of {columns.length} shown</p>
          </div>
          <button type="button" onClick={onReset} className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80">
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        </div>
        <p className="shrink-0 px-4 pb-1 pt-2 text-[11px] text-muted-foreground">Tick to show · drag to reorder</p>
        <div className="custom-scrollbar flex min-h-0 flex-1 overscroll-contain flex-col gap-0.5 overflow-y-auto px-2 pb-2">
          {columns.map((column, index) => (
            <div
              key={column.id}
              className="group flex cursor-grab items-center justify-between gap-2 rounded-md py-2 pl-2 pr-1 hover:bg-muted active:cursor-grabbing"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData("colIdx", String(index))
                event.dataTransfer.effectAllowed = "move"
              }}
              onDragOver={(event) => {
                event.preventDefault()
                event.dataTransfer.dropEffect = "move"
              }}
              onDrop={(event) => {
                event.preventDefault()
                const from = Number.parseInt(event.dataTransfer.getData("colIdx"), 10)
                if (Number.isNaN(from) || from === index) return
                const next = [...columns]
                const [moved] = next.splice(from, 1)
                next.splice(index, 0, moved)
                commit(next)
              }}
            >
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-0.5">
                <Checkbox
                  checked={column.visible}
                  onCheckedChange={(checked) => toggle(column.id, checked === true)}
                  aria-label={`Show ${column.label}`}
                />
                <span className={cn("truncate text-[13px]", column.visible ? "font-medium text-foreground" : "text-muted-foreground")}>{column.label}</span>
              </label>
              <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden="true" />
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
