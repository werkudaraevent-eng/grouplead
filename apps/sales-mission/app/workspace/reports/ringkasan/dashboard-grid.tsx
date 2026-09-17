"use client"

import { useRef, type ReactNode } from "react"
import { GridLayout, useContainerWidth, type Layout, type LayoutItem } from "react-grid-layout"
import "react-grid-layout/css/styles.css"
import "react-resizable/css/styles.css"
import { GRID_COLS, GRID_MARGIN, GRID_ROW_HEIGHT } from "@/lib/reporting/cube"

/**
 * The board, on react-grid-layout, used the way it stays smooth: the
 * grid owns the pointer, the page hears about places only when the
 * pointer is released (`onDragStop`, `onResizeStop`), and the one other
 * time the layout changes on its own, compaction after a card is hidden
 * or shown. Nothing above this re-renders while a card is moving.
 */
export function DashboardGrid({
  layout,
  editing,
  onCommit,
  children,
}: {
  layout: LayoutItem[]
  editing: boolean
  onCommit: (layout: Layout) => void
  children: ReactNode
}) {
  const { width, containerRef, mounted } = useContainerWidth()
  const interacting = useRef(false)

  return (
    <div ref={containerRef} className="w-full">
      {mounted && width > 0 && (
        <GridLayout
          className={editing ? "dashboard-grid editing" : "dashboard-grid"}
          width={width}
          layout={layout}
          gridConfig={{ cols: GRID_COLS, rowHeight: GRID_ROW_HEIGHT, margin: [GRID_MARGIN, GRID_MARGIN], containerPadding: [0, 0] }}
          dragConfig={{ enabled: editing, handle: ".widget-drag-handle", bounded: false, threshold: 3 }}
          resizeConfig={{ enabled: editing, handles: ["se"] }}
          onDragStart={() => {
            interacting.current = true
          }}
          onDragStop={(next) => {
            interacting.current = false
            onCommit(next)
          }}
          onResizeStart={() => {
            interacting.current = true
          }}
          onResizeStop={(next) => {
            interacting.current = false
            onCommit(next)
          }}
          onLayoutChange={(next) => {
            if (!interacting.current) onCommit(next)
          }}
        >
          {children}
        </GridLayout>
      )}
    </div>
  )
}
