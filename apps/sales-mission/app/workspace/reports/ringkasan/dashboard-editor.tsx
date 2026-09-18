"use client"

import { memo, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { Layout, LayoutItem } from "react-grid-layout"
import { publishDashboardDefault, resetDashboardLayout, saveDashboardLayout } from "@/app/actions/dashboard-actions"
import { Check, Download, Settings2 } from "@/components/icons"
import { PageChrome } from "@/components/page-chrome"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useCompact } from "@/hooks/use-compact"
import { BUILTIN_WIDGETS, GRID_COLS, minBoxFor, minSizeFor, type CubeWidget, type WidgetConfig, type WidgetMode, type WidgetSize } from "@/lib/reporting/cube"
import {
  applyPreset,
  boxOf,
  hideWidget,
  modeOf,
  presetOf,
  removeCustom,
  samePositions,
  setMode,
  setPositions,
  showWidget,
  upsertCustom,
  type DashboardLayout,
} from "@/lib/reporting/dashboard-layout"
import type { RingkasanQuery } from "@/lib/reporting/ringkasan-filter"
import type { WidgetView } from "@/lib/reporting/widget-view"
import { AddWidgetSheet } from "./add-widget-sheet"
import { DashboardGrid } from "./dashboard-grid"
import { RingkasanToolbar } from "./ringkasan-toolbar"
import { WidgetCard } from "./widget-card"
import { WidgetConfigurator } from "./widget-configurator"
import { WidgetShell } from "./widget-shell"

/**
 * The board. Holds the person's layout, saves every change without a
 * Save button (Notion, Linear), and asks the server for new data only
 * when a card that has none appears: a hidden card shown, a card
 * composed or changed. Moving, resizing, hiding and switching a card's
 * mode are all answered from what is already here.
 */

export interface CardData {
  id: string
  config: WidgetConfig
  views: Partial<Record<WidgetMode, WidgetView>>
  truncated: boolean
}

const SAVE_DELAY_MS = 400

/**
 * One card, memoised: while a card is dragged nothing here re-renders,
 * and when a place is committed only the cards whose props changed do.
 * The callbacks are stable (they read the latest layout through a ref).
 */
const Card = memo(function Card({
  card,
  mode,
  editing,
  range,
  sales,
  preset,
  minSize,
  filterChip,
  onMode,
  onPreset,
  onHide,
  onEdit,
  onRemove,
}: {
  card: CardData
  mode: WidgetMode
  editing: boolean
  range: { from: string; to: string }
  sales: string[]
  preset: WidgetSize | null
  minSize: WidgetSize
  filterChip?: string
  onMode: (id: string, mode: WidgetMode) => void
  onPreset: (id: string, size: WidgetSize) => void
  onHide: (id: string) => void
  onEdit: (id: string) => void
  onRemove: (id: string) => void
}) {
  const config = card.config
  const view = card.views[mode] ?? card.views.umum ?? { type: "empty" as const, text: "Data tidak tersedia." }
  const isCustom = config.kind === "custom"
  return (
    <WidgetShell
      title={config.title}
      editing={editing}
      preset={preset}
      minSize={minSize}
      modes={config.source === "cube" ? config.modes : undefined}
      mode={mode}
      onMode={(next) => onMode(card.id, next)}
      filterChip={filterChip}
      truncated={card.truncated}
      onPreset={(size) => onPreset(card.id, size)}
      onHide={() => onHide(card.id)}
      onEdit={isCustom ? () => onEdit(card.id) : undefined}
      onRemove={isCustom ? () => onRemove(card.id) : undefined}
    >
      <WidgetCard view={view} range={range} sales={sales} editing={editing} />
    </WidgetShell>
  )
})

export function DashboardEditor({
  query,
  range,
  sales,
  people,
  initialLayout,
  cards,
  hidden,
  canSeeProspects,
  canPublish,
  hasCompanyDefault,
  exportQuery,
}: {
  query: RingkasanQuery
  range: { from: string; to: string }
  sales: string[]
  people: Array<{ id: string; name: string; avatarUrl: string | null }>
  initialLayout: DashboardLayout
  cards: CardData[]
  hidden: WidgetConfig[]
  canSeeProspects: boolean
  /** Pengaturan → ubah: may make this board the unit's default. */
  canPublish: boolean
  hasCompanyDefault: boolean
  /** The period as query string, for the export links in the phone's overflow menu. */
  exportQuery: string
}) {
  const router = useRouter()
  const compact = useCompact()
  const [layout, setLayout] = useState(initialLayout)
  const [editing, setEditing] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [configuring, setConfiguring] = useState<{ open: boolean; widget: CubeWidget | null }>({ open: false, widget: null })
  const [publishing, setPublishing] = useState(false)
  const [saving, startSaving] = useTransition()

  // The latest layout for handlers that must stay stable across renders.
  const layoutRef = useRef(layout)
  layoutRef.current = layout

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

  const persist = useCallback((next: DashboardLayout, after?: () => void) => {
    settled.current = JSON.stringify(next)
    startSaving(async () => {
      const result = await saveDashboardLayout(next)
      if (!result.success) toast.error(result.error ?? "Susunan widget tidak bisa disimpan.")
      after?.()
    })
  }, [])

  /** A change answered from what is here: save soon, no refetch. */
  const change = useCallback(
    (next: DashboardLayout) => {
      layoutRef.current = next
      setLayout(next)
      if (timer.current) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => persist(next), SAVE_DELAY_MS)
    },
    [persist]
  )
  /** A change that needs data the page does not have: save now, then refresh. */
  const changeAndRefresh = useCallback(
    (next: DashboardLayout) => {
      layoutRef.current = next
      setLayout(next)
      if (timer.current) window.clearTimeout(timer.current)
      persist(next, () => router.refresh())
    },
    [persist, router]
  )
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current) }, [])

  const cardById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards])
  const visibleIds = layout.order.filter((id) => cardById.has(id))

  const gridLayout: LayoutItem[] = useMemo(
    () =>
      layout.order
        .filter((id) => cardById.has(id))
        .map((id) => {
          const config = cardById.get(id)!.config
          const box = boxOf(layout, config)
          const min = minBoxFor(config)
          const saved = layout.positions[id]
          return {
            i: id,
            x: saved ? Math.min(saved.x, GRID_COLS - box.w) : 0,
            // A card without a place goes to the bottom; the grid compacts it up.
            y: saved ? saved.y : Number.MAX_SAFE_INTEGER,
            w: box.w,
            h: box.h,
            minW: min.w,
            minH: min.h,
          }
        }),
    [layout, cardById]
  )

  const commit = useCallback(
    (next: Layout) => {
      const current = layoutRef.current
      const applied = setPositions(current, next)
      if (samePositions(current.positions, applied.positions)) return
      change(applied)
    },
    [change]
  )

  const onMode = useCallback((id: string, mode: WidgetMode) => change(setMode(layoutRef.current, id, mode)), [change])
  const onPreset = useCallback((id: string, size: WidgetSize) => change(applyPreset(layoutRef.current, id, size)), [change])
  const onHide = useCallback((id: string) => change(hideWidget(layoutRef.current, id)), [change])
  const onRemove = useCallback((id: string) => change(removeCustom(layoutRef.current, id)), [change])
  const onEdit = useCallback((id: string) => {
    const widget = layoutRef.current.custom.find((item) => item.id === id) ?? null
    if (widget) setConfiguring({ open: true, widget })
  }, [])

  const descriptions = Object.fromEntries(BUILTIN_WIDGETS.map((widget) => [widget.id, widget.description]))
  const hiddenNow = hidden.filter((widget) => layout.hidden.includes(widget.id))

  const renderCard = (id: string) => {
    const card = cardById.get(id)!
    const config = card.config
    const filterChip =
      config.source === "cube" && config.filters?.sales?.length
        ? config.filters.sales.map((item) => people.find((person) => person.id === item)?.name ?? "?").join(", ")
        : undefined
    return (
      <Card
        card={card}
        mode={modeOf(layout, config)}
        editing={editing}
        range={range}
        sales={sales}
        preset={presetOf(boxOf(layout, config))}
        minSize={minSizeFor(config)}
        filterChip={filterChip}
        onMode={onMode}
        onPreset={onPreset}
        onHide={onHide}
        onEdit={onEdit}
        onRemove={onRemove}
      />
    )
  }

  return (
    <>
      {/* The phone's top app bar overflow: the exports (desk buttons in the
          header) and the door into arranging, which the toolbar shows only
          from md up. */}
      <PageChrome
        menu={[
          { label: "Ekspor Excel", icon: Download, href: `/workspace/reports/export?${exportQuery}&format=xlsx` },
          { label: "Ekspor CSV", icon: Download, href: `/workspace/reports/export?${exportQuery}` },
          editing
            ? { label: "Selesai mengatur", icon: Check, onSelect: () => setEditing(false) }
            : { label: "Atur widget", icon: Settings2, onSelect: () => setEditing(true) },
        ]}
      />
      <RingkasanToolbar
        query={query}
        range={range}
        people={people}
        editing={editing}
        saving={saving}
        onEditingChange={setEditing}
        onAddWidget={() => setSheetOpen(true)}
        resetLabel={hasCompanyDefault ? "Kembali ke susunan awal unit bisnis" : "Kembali ke susunan awal"}
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
        onPublish={canPublish ? () => setPublishing(true) : undefined}
      />

      <Dialog open={publishing} onOpenChange={(open) => { if (!saving) setPublishing(open) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Jadikan susunan ini bawaan semua akun?</DialogTitle>
            <DialogDescription>
              Susunan, ukuran, dan widget buatan Anda di papan ini menjadi tampilan awal Ringkasan untuk setiap akun di unit bisnis ini. Orang yang sudah menyusun sendiri tetap dengan susunannya sampai memilih Kembali ke susunan awal. Kartu yang tidak boleh dilihat suatu peran tidak ikut tampil untuk peran itu.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPublishing(false)} disabled={saving}>Batal</Button>
            <Button
              type="button"
              disabled={saving}
              onClick={() => {
                if (timer.current) window.clearTimeout(timer.current)
                startSaving(async () => {
                  // Whatever is on screen is what gets published: save it first.
                  const own = await saveDashboardLayout(layoutRef.current)
                  if (!own.success) {
                    toast.error(own.error ?? "Susunan widget tidak bisa disimpan.")
                    return
                  }
                  const result = await publishDashboardDefault()
                  if (!result.success) toast.error(result.error ?? "Susunan bawaan tidak bisa disimpan.")
                  else {
                    toast.success("Susunan ini kini bawaan untuk semua akun.")
                    setPublishing(false)
                    router.refresh()
                  }
                })
              }}
            >
              Jadikan bawaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {visibleIds.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card/50 px-6 py-10 text-center text-sm text-muted-foreground">
          Tidak ada widget yang tampil. Buka Atur widget lalu Tambah widget.
        </p>
      ) : compact ? (
        // A phone stacks the cards at one height; arranging is a desk job.
        <div className="space-y-4">
          {visibleIds.map((id) => (
            <div key={id} className="h-80 overflow-hidden rounded-xl border bg-card">
              {renderCard(id)}
            </div>
          ))}
        </div>
      ) : (
        <DashboardGrid layout={gridLayout} editing={editing} onCommit={commit}>
          {visibleIds.map((id) => (
            <div key={id} className="overflow-hidden rounded-xl border bg-card">
              {renderCard(id)}
            </div>
          ))}
        </DashboardGrid>
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
