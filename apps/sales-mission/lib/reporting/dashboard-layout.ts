import { z } from "zod"
import {
  BUILTIN_WIDGETS,
  CHARTS,
  DIMENSIONS,
  MEASURES,
  PROSPECT_MEASURES,
  WIDGET_MODES,
  WIDGET_SIZES,
  GRID_COLS,
  SIZE_BOX,
  builtinWidget,
  clampBox,
  minBoxFor,
  validateWidget,
  type Box,
  type CubeWidget,
  type WidgetConfig,
  type WidgetMode,
  type WidgetSize,
} from "./cube"

/**
 * How a person arranged their Ringkasan: which cards show and in what
 * order, which are hidden, a size or a mode they changed, and the cards
 * they composed. Stored as one JSON per person; read through
 * `mergeLayout`, which turns whatever is saved (or nothing, or garbage)
 * into a layout that is always valid against today's built-ins.
 */

export const LAYOUT_VERSION = 1
export const MAX_CUSTOM_WIDGETS = 12
export const CUSTOM_ID = /^c_[a-z0-9]{6,16}$/
const UUID = /^[0-9a-f-]{36}$/i

/** Where a card sits and how big it is, in grid units (twelve columns, rows of 40px). */
export interface Position extends Box {
  x: number
  y: number
}

export interface DashboardLayout {
  version: typeof LAYOUT_VERSION
  /** Visible ids, in order; the place a card without a position is appended. */
  order: string[]
  hidden: string[]
  positions: Record<string, Position>
  modes: Record<string, WidgetMode>
  custom: CubeWidget[]
}

const measureSchema = z.enum(MEASURES)

export const customWidgetSchema = z
  .object({
    id: z.string().regex(CUSTOM_ID),
    kind: z.literal("custom"),
    source: z.literal("cube"),
    title: z.string().trim().min(1).max(60),
    measures: z.union([z.tuple([measureSchema]), z.tuple([measureSchema, measureSchema])]),
    group: z.enum(DIMENSIONS),
    series: z.enum(DIMENSIONS).optional(),
    chart: z.enum(CHARTS),
    size: z.enum(WIDGET_SIZES),
    filters: z.object({ sales: z.array(z.string().regex(UUID)).max(20).optional() }).optional(),
  })
  .superRefine((widget, ctx) => {
    const reason = validateWidget(widget)
    if (reason) ctx.addIssue({ code: "custom", message: reason })
  })

const idList = z.array(z.string().max(40)).max(60)
const positionSchema = z.object({
  x: z.number().int().min(0).max(GRID_COLS - 1),
  y: z.number().int().min(0).max(10000),
  w: z.number().int().min(1).max(GRID_COLS),
  h: z.number().int().min(1).max(200),
})

export const layoutSchema = z.object({
  version: z.literal(LAYOUT_VERSION).optional(),
  order: idList.optional(),
  hidden: idList.optional(),
  positions: z.record(z.string(), positionSchema).optional(),
  modes: z.record(z.string(), z.enum(WIDGET_MODES)).optional(),
  custom: z.array(customWidgetSchema).max(MAX_CUSTOM_WIDGETS).optional(),
})

export function defaultLayout(): DashboardLayout {
  return {
    version: LAYOUT_VERSION,
    order: BUILTIN_WIDGETS.filter((widget) => !widget.defaultHidden).map((widget) => widget.id),
    hidden: BUILTIN_WIDGETS.filter((widget) => widget.defaultHidden).map((widget) => widget.id),
    positions: {},
    modes: {},
    custom: [],
  }
}

function usesProspects(widget: CubeWidget): boolean {
  return widget.measures.some((measure) => PROSPECT_MEASURES.includes(measure))
}

/**
 * Saved JSON + today's built-ins → a valid layout.
 * Unparseable → defaults. Unknown ids are dropped; an id in both lists is
 * visible; built-ins in neither are appended (visible or hidden per their
 * default); custom cards in neither are appended visible. Cards that need
 * prospects vanish for a viewer without that right.
 */
export function mergeLayout(saved: unknown, options: { canSeeProspects: boolean }): DashboardLayout {
  const parsed = layoutSchema.safeParse(saved ?? {})
  const input = parsed.success ? parsed.data : {}

  const custom = (input.custom ?? []).filter((widget) => options.canSeeProspects || !usesProspects(widget))
  const seenCustom = new Set<string>()
  const uniqueCustom = custom.filter((widget) => (seenCustom.has(widget.id) ? false : (seenCustom.add(widget.id), true)))

  const known = new Map<string, WidgetConfig>()
  for (const widget of BUILTIN_WIDGETS) {
    if (widget.needsProspects && !options.canSeeProspects) continue
    known.set(widget.id, widget)
  }
  for (const widget of uniqueCustom) known.set(widget.id, widget)

  const order: string[] = []
  for (const id of input.order ?? []) if (known.has(id) && !order.includes(id)) order.push(id)
  const hidden: string[] = []
  for (const id of input.hidden ?? []) if (known.has(id) && !order.includes(id) && !hidden.includes(id)) hidden.push(id)

  for (const widget of BUILTIN_WIDGETS) {
    if (!known.has(widget.id) || order.includes(widget.id) || hidden.includes(widget.id)) continue
    if (widget.defaultHidden) hidden.push(widget.id)
    else order.push(widget.id)
  }
  for (const widget of uniqueCustom) {
    if (!order.includes(widget.id) && !hidden.includes(widget.id)) order.push(widget.id)
  }

  const positions: Record<string, Position> = {}
  for (const [id, position] of Object.entries(input.positions ?? {})) {
    const widget = known.get(id)
    if (!widget) continue
    const box = clampBox(position, minBoxFor(widget))
    positions[id] = { ...box, x: Math.min(position.x, GRID_COLS - box.w), y: position.y }
  }
  const modes: Record<string, WidgetMode> = {}
  for (const [id, mode] of Object.entries(input.modes ?? {})) {
    const widget = known.get(id)
    if (widget && widget.source === "cube" && widget.modes?.includes(mode)) modes[id] = mode
  }

  return { version: LAYOUT_VERSION, order, hidden, positions, modes, custom: uniqueCustom }
}

function configOf(layout: DashboardLayout, id: string): WidgetConfig | undefined {
  return layout.custom.find((widget) => widget.id === id) ?? builtinWidget(id)
}

/** The card's box: its saved one, else its preset, never below its minimum. */
export function boxOf(layout: DashboardLayout, widget: WidgetConfig): Box {
  const saved = layout.positions[widget.id]
  return clampBox(saved ? { w: saved.w, h: saved.h } : SIZE_BOX[widget.size], minBoxFor(widget))
}

/** The preset whose box this is, if any (for the size menu's current mark). */
export function presetOf(box: Box): WidgetSize | null {
  return (Object.keys(SIZE_BOX) as WidgetSize[]).find((size) => SIZE_BOX[size].w === box.w && SIZE_BOX[size].h === box.h) ?? null
}

export function modeOf(layout: DashboardLayout, widget: WidgetConfig): WidgetMode {
  if (widget.source !== "cube" || !widget.modes?.length) return "umum"
  return layout.modes[widget.id] ?? widget.modes[0]
}

/** The cards to draw and the cards on offer. */
export function resolveWidgets(layout: DashboardLayout): { visible: WidgetConfig[]; hidden: WidgetConfig[] } {
  const visible = layout.order.map((id) => configOf(layout, id)).filter((widget): widget is WidgetConfig => Boolean(widget))
  const hidden = layout.hidden.map((id) => configOf(layout, id)).filter((widget): widget is WidgetConfig => Boolean(widget))
  return { visible, hidden }
}

export function newCustomId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789"
  let id = "c_"
  for (let index = 0; index < 10; index += 1) id += alphabet[Math.floor(Math.random() * alphabet.length)]
  return id
}

/* Pure edits, for the editor and its tests. Each returns a new layout. */

export function reorder(layout: DashboardLayout, order: string[]): DashboardLayout {
  const kept = order.filter((id, index) => layout.order.includes(id) && order.indexOf(id) === index)
  const missing = layout.order.filter((id) => !kept.includes(id))
  return { ...layout, order: [...kept, ...missing] }
}

export function hideWidget(layout: DashboardLayout, id: string): DashboardLayout {
  if (!layout.order.includes(id)) return layout
  return { ...layout, order: layout.order.filter((item) => item !== id), hidden: [...layout.hidden.filter((item) => item !== id), id] }
}

export function showWidget(layout: DashboardLayout, id: string, position?: number): DashboardLayout {
  if (layout.order.includes(id)) return layout
  const order = [...layout.order]
  order.splice(position === undefined ? order.length : Math.max(0, Math.min(position, order.length)), 0, id)
  return { ...layout, order, hidden: layout.hidden.filter((item) => item !== id) }
}

/** Every card's place after a drag or a resize, as the grid reports it. Unknown ids are ignored. */
export function setPositions(layout: DashboardLayout, next: ReadonlyArray<Position & { i: string }>): DashboardLayout {
  const positions = { ...layout.positions }
  for (const item of next) {
    if (!layout.order.includes(item.i)) continue
    positions[item.i] = { x: item.x, y: item.y, w: item.w, h: item.h }
  }
  return { ...layout, positions }
}

/** One of the four presets, keeping the card where it is. */
export function applyPreset(layout: DashboardLayout, id: string, size: WidgetSize): DashboardLayout {
  const current = layout.positions[id]
  const box = SIZE_BOX[size]
  return { ...layout, positions: { ...layout.positions, [id]: { x: Math.min(current?.x ?? 0, GRID_COLS - box.w), y: current?.y ?? 0, ...box } } }
}

/** Whether two arrangements place every card the same. */
export function samePositions(a: Record<string, Position>, b: Record<string, Position>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const key of keys) {
    const p = a[key]
    const q = b[key]
    if (!p || !q || p.x !== q.x || p.y !== q.y || p.w !== q.w || p.h !== q.h) return false
  }
  return true
}

export function setMode(layout: DashboardLayout, id: string, mode: WidgetMode): DashboardLayout {
  return { ...layout, modes: { ...layout.modes, [id]: mode } }
}

/** Adds or replaces a custom card; a new one becomes visible at the end. */
export function upsertCustom(layout: DashboardLayout, widget: CubeWidget): DashboardLayout {
  const exists = layout.custom.some((item) => item.id === widget.id)
  const custom = exists ? layout.custom.map((item) => (item.id === widget.id ? widget : item)) : [...layout.custom, widget]
  const order = exists || layout.hidden.includes(widget.id) ? layout.order : [...layout.order, widget.id]
  return { ...layout, custom, order }
}

export function removeCustom(layout: DashboardLayout, id: string): DashboardLayout {
  const { [id]: _position, ...positions } = layout.positions
  const { [id]: _mode, ...modes } = layout.modes
  return {
    ...layout,
    custom: layout.custom.filter((item) => item.id !== id),
    order: layout.order.filter((item) => item !== id),
    hidden: layout.hidden.filter((item) => item !== id),
    positions,
    modes,
  }
}
