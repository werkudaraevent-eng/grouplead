import { z } from "zod"
import {
  BUILTIN_WIDGETS,
  CHARTS,
  DIMENSIONS,
  MEASURES,
  PROSPECT_MEASURES,
  WIDGET_MODES,
  WIDGET_SIZES,
  SIZE_CELLS,
  builtinWidget,
  minSizeFor,
  sizeFromCells,
  validateWidget,
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

export interface DashboardLayout {
  version: typeof LAYOUT_VERSION
  /** Visible ids, in order. */
  order: string[]
  hidden: string[]
  sizes: Record<string, WidgetSize>
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

export const layoutSchema = z.object({
  version: z.literal(LAYOUT_VERSION).optional(),
  order: idList.optional(),
  hidden: idList.optional(),
  sizes: z.record(z.string(), z.enum(WIDGET_SIZES)).optional(),
  modes: z.record(z.string(), z.enum(WIDGET_MODES)).optional(),
  custom: z.array(customWidgetSchema).max(MAX_CUSTOM_WIDGETS).optional(),
})

export function defaultLayout(): DashboardLayout {
  return {
    version: LAYOUT_VERSION,
    order: BUILTIN_WIDGETS.filter((widget) => !widget.defaultHidden).map((widget) => widget.id),
    hidden: BUILTIN_WIDGETS.filter((widget) => widget.defaultHidden).map((widget) => widget.id),
    sizes: {},
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

  const sizes: Record<string, WidgetSize> = {}
  for (const [id, size] of Object.entries(input.sizes ?? {})) if (known.has(id)) sizes[id] = size
  const modes: Record<string, WidgetMode> = {}
  for (const [id, mode] of Object.entries(input.modes ?? {})) {
    const widget = known.get(id)
    if (widget && widget.source === "cube" && widget.modes?.includes(mode)) modes[id] = mode
  }

  return { version: LAYOUT_VERSION, order, hidden, sizes, modes, custom: uniqueCustom }
}

function configOf(layout: DashboardLayout, id: string): WidgetConfig | undefined {
  return layout.custom.find((widget) => widget.id === id) ?? builtinWidget(id)
}

/** The chosen size, lifted in either direction to the card's minimum. */
export function sizeOf(layout: DashboardLayout, widget: WidgetConfig): WidgetSize {
  const chosen = layout.sizes[widget.id] ?? widget.size
  const min = minSizeFor(widget)
  return sizeFromCells(Math.max(SIZE_CELLS[chosen][0], SIZE_CELLS[min][0]), Math.max(SIZE_CELLS[chosen][1], SIZE_CELLS[min][1]))
}

export function modeOf(layout: DashboardLayout, widget: WidgetConfig): WidgetMode {
  if (widget.source !== "cube" || !widget.modes?.length) return "umum"
  return layout.modes[widget.id] ?? widget.modes[0]
}

/** The cards to draw and the cards on offer, with the person's size applied. */
export function resolveWidgets(layout: DashboardLayout): { visible: WidgetConfig[]; hidden: WidgetConfig[] } {
  const withSize = (widget: WidgetConfig): WidgetConfig => ({ ...widget, size: sizeOf(layout, widget) })
  const visible = layout.order.map((id) => configOf(layout, id)).filter((widget): widget is WidgetConfig => Boolean(widget)).map(withSize)
  const hidden = layout.hidden.map((id) => configOf(layout, id)).filter((widget): widget is WidgetConfig => Boolean(widget)).map(withSize)
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

export function setSize(layout: DashboardLayout, id: string, size: WidgetSize): DashboardLayout {
  return { ...layout, sizes: { ...layout.sizes, [id]: size } }
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
  const { [id]: _size, ...sizes } = layout.sizes
  const { [id]: _mode, ...modes } = layout.modes
  return {
    ...layout,
    custom: layout.custom.filter((item) => item.id !== id),
    order: layout.order.filter((item) => item !== id),
    hidden: layout.hidden.filter((item) => item !== id),
    sizes,
    modes,
  }
}
