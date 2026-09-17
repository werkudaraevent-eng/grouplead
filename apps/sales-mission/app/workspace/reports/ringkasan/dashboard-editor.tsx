"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { DraggableWidgetGrid, type WidgetItem } from "@/components/ui/draggable-widget-grid"
import { resetDashboardLayout, saveDashboardLayout } from "@/app/actions/dashboard-actions"
import { BUILTIN_WIDGETS, type CubeWidget, type WidgetConfig, type WidgetMode, type WidgetSize } from "@/lib/reporting/cube"
import {
  hideWidget,
  modeOf,
  removeCustom,
  reorder,
  setMode,
  setSize,
  showWidget,
  sizeOf,
  upsertCustom,
  type DashboardLayout,
} from "@/lib/reporting/dashboard-layout"
import type { RingkasanQuery } from "@/lib/reporting/ringkasan-filter"
import type { WidgetView } from "@/lib/reporting/widget-view"
import { AddWidgetSheet } from "./add-widget-sheet"
import { RingkasanToolbar } from "./ringkasan-toolbar"
import { WidgetCard } from "./widget-card"
import { WidgetConfigurator } from "./widget-configurator"
import { WidgetShell } from "./widget-shell"

/**
 * The board. Holds the person's layout, saves every change without a
 * Save button (Notion, Linear), and asks the server for new data only
 * when a card that has none appears: a hidden card shown, a card
 * composed or changed. Reordering, resizing, hiding and switching a
 * card's mode are all answered from what is already here.
 */

export interface CardData {
  id: string
  config: WidgetConfig
  views: Partial<Record<WidgetMode, WidgetView>>
  truncated: boolean
}

const SAVE_DELAY_MS = 400

export function DashboardEditor({
  query,
  range,
  sales,
  people,
  initialLayout,
  cards,
  hidden,
  canSeeProspects,
}: {
  query: RingkasanQuery
  range: { from: string; to: string }
  sales: string[]
  people: Array<{ id: string; name: string; avatarUrl: string | null }>
  initialLayout: DashboardLayout
  cards: CardData[]
  hidden: WidgetConfig[]
  canSeeProspects: boolean
}) {
  const router = useRouter()
  const [layout, setLayout] = useState(initialLayout)
  const [editing, setEditing] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [configuring, setConfiguring] = useState<{ open: boolean; widget: CubeWidget | null }>({ open: false, widget: null })
  const [saving, startSaving] = useTransition()

  // What the server last agreed to; a fresh render that says the same
  // thing is not a reason to drop an edit still on its way.
  const settled = useRef(JSON.stringify(initialLayout))
  const timer = useRef<number | null>(null)
  useEffect(() => {
    const incoming = JSON.stringify(initialLayout)
    if (incoming !== settled.current) {
      settled.current = incoming
      setLayout(initialLayout)
    }
  }, [initialLayout])

  const persist = useCallback(
    (next: DashboardLayout, after?: () => void) => {
      settled.current = JSON.stringify(next)
      startSaving(async () => {
        const result = await saveDashboardLayout(next)
        if (!result.success) toast.error(result.error ?? "Susunan widget tidak bisa disimpan.")
        after?.()
      })
    },
    []
  )

  /** A change answered from what is here: save soon, no refetch. */
  const change = (next: DashboardLayout) => {
    setLayout(next)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => persist(next), SAVE_DELAY_MS)
  }
  /** A change that needs data the page does not have: save now, then refresh. */
  const changeAndRefresh = (next: DashboardLayout) => {
    setLayout(next)
    if (timer.current) window.clearTimeout(timer.current)
    persist(next, () => router.refresh())
  }
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current) }, [])

  const cardById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards])
  const items: WidgetItem[] = layout.order
    .filter((id) => cardById.has(id))
    .map((id) => ({ id, size: sizeOf(layout, cardById.get(id)!.config), label: cardById.get(id)!.config.title }))
  // The grid keeps its own order after mount; it is remounted only when
  // the set of cards or a size changes from outside it.
  const gridKey = [...items].sort((a, b) => a.id.localeCompare(b.id)).map((item) => `${item.id}:${item.size}`).join("|")

  const descriptions = Object.fromEntries(BUILTIN_WIDGETS.map((widget) => [widget.id, widget.description]))
  const hiddenNow = hidden.filter((widget) => layout.hidden.includes(widget.id))

  const renderItem = (item: WidgetItem) => {
    const card = cardById.get(item.id)
    if (!card) return null
    const config = card.config
    const mode = modeOf(layout, config)
    const view = card.views[mode] ?? card.views.umum ?? { type: "empty" as const, text: "Data tidak tersedia." }
    const isCustom = config.kind === "custom"
    const filterChip =
      config.source === "cube" && config.filters?.sales?.length
        ? config.filters.sales.map((id) => people.find((person) => person.id === id)?.name ?? "?").join(", ")
        : undefined
    return (
      <WidgetShell
        title={config.title}
        editing={editing}
        size={item.size}
        modes={config.source === "cube" ? config.modes : undefined}
        mode={mode}
        onMode={(next) => change(setMode(layout, item.id, next))}
        filterChip={filterChip}
        truncated={card.truncated}
        onSize={(size: WidgetSize) => change(setSize(layout, item.id, size))}
        onHide={() => change(hideWidget(layout, item.id))}
        onEdit={isCustom && config.source === "cube" ? () => setConfiguring({ open: true, widget: config }) : undefined}
        onRemove={isCustom ? () => change(removeCustom(layout, item.id)) : undefined}
      >
        <WidgetCard view={view} range={range} sales={sales} editing={editing} />
      </WidgetShell>
    )
  }

  return (
    <>
      <RingkasanToolbar
        query={query}
        range={range}
        people={people}
        editing={editing}
        saving={saving}
        onEditingChange={setEditing}
        onAddWidget={() => setSheetOpen(true)}
        onReset={() => {
          startSaving(async () => {
            const result = await resetDashboardLayout()
            if (!result.success) toast.error(result.error ?? "Susunan widget tidak bisa dikembalikan.")
            else {
              toast.success("Susunan awal dikembalikan.")
              router.refresh()
            }
          })
        }}
      />

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card/50 px-6 py-10 text-center text-sm text-muted-foreground">
          Tidak ada widget yang tampil. Buka Atur widget lalu Tambah widget.
        </p>
      ) : (
        <DraggableWidgetGrid
          key={gridKey}
          items={items}
          editable={editing}
          maxColumns={4}
          cellSize={230}
          gap={16}
          radius={12}
          renderItem={renderItem}
          onChange={(next) => change(reorder(layout, next.map((item) => item.id)))}
        />
      )}

      <AddWidgetSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        hidden={hiddenNow}
        descriptions={descriptions}
        customCount={layout.custom.length}
        onShow={(id) => {
          setSheetOpen(false)
          changeAndRefresh(showWidget(layout, id))
        }}
        onNew={() => {
          setSheetOpen(false)
          setConfiguring({ open: true, widget: null })
        }}
      />

      <WidgetConfigurator
        open={configuring.open}
        widget={configuring.widget}
        people={people}
        canSeeProspects={canSeeProspects}
        saving={saving}
        onOpenChange={(open) => setConfiguring((current) => ({ ...current, open }))}
        onSave={(widget) => {
          setConfiguring({ open: false, widget: null })
          changeAndRefresh(upsertCustom(layout, widget))
        }}
      />
    </>
  )
}
