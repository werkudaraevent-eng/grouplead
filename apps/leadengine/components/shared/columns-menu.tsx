"use client"

import * as React from "react"
import { Columns, Eye, EyeOff, GripVertical, RotateCcw } from "@/components/icons"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { ToolbarIconButton } from "./list-toolbar"

export interface ColumnLike {
  id: string
  label: string
  visible: boolean
}

/**
 * The columns popover shared by the list pages: drag to reorder, eye to
 * toggle, Reset to the page's default. The trigger is a toolbar icon
 * button carrying "shown/total" as a small badge. Persistence is the
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
        <ToolbarIconButton label={`Columns (${shown} of ${columns.length} shown)`} badge={`${shown}/${columns.length}`}>
          <Columns className="h-5 w-5" />
        </ToolbarIconButton>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Columns</p>
          <button type="button" onClick={onReset} className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80">
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        </div>
        <p className="px-4 pb-1 pt-2 text-[11px] text-muted-foreground">Drag to reorder · click the eye to show or hide</p>
        <div className="custom-scrollbar flex max-h-[360px] flex-col gap-0.5 overflow-y-auto px-2 pb-2">
          {columns.map((column, index) => (
            <div
              key={column.id}
              className="group flex cursor-grab items-center justify-between rounded-md py-2 pl-1 pr-1 hover:bg-muted active:cursor-grabbing"
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
              <div className="flex min-w-0 items-center gap-2">
                <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                <span className={cn("truncate text-[13px]", column.visible ? "font-medium text-foreground" : "text-muted-foreground line-through")}>{column.label}</span>
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  toggle(column.id, !column.visible)
                }}
                aria-label={column.visible ? `Hide ${column.label}` : `Show ${column.label}`}
                aria-pressed={column.visible}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors hover:bg-background"
              >
                {column.visible ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground/60" />}
              </button>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
