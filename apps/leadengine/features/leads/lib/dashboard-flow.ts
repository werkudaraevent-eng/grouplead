/**
 * The dashboard on a phone: the saved grid, reflowed into one column.
 *
 * On a desk the dashboard is a twelve-column react-grid-layout board the
 * person arranges. Below `lg` there is no room for that board, so its cards
 * are laid out again as a stream (M3's reflow of a canonical layout; the
 * Google Analytics and HubSpot apps do the same): the number cards two to a
 * row, every chart or list on a row of its own, in the order the person gave
 * them on the desk (top to bottom, then left to right). A number card is as
 * tall as its content; a list (rows, a funnel, a donut with its legend) is as
 * tall as its content up to the height the person gave it on the desk, and
 * scrolls inside itself past that; a chart, which has no height of its own,
 * takes that desk height; both within what a phone can hold.
 *
 * Pure so it can be tested; `DashboardGrid` renders what it returns.
 */

import { GRID_MARGIN, GRID_ROW_HEIGHT } from "./dashboard-layout"

/** The smallest and largest height, in px, a full-width card takes on a phone. */
export const FLOW_MIN_HEIGHT = 300
export const FLOW_MAX_HEIGHT = 460

/** Rows a card without a saved height is given (a chart's usual 6). */
const FALLBACK_ROWS = 6

/**
 * How a card sizes itself on a phone.
 * - `number`: a KPI card, half the width, as tall as its content.
 * - `list`: full width, as tall as its content up to its phone height, then
 *   it scrolls inside the card (never the page).
 * - `chart`: full width at its phone height, because a chart fills the box it
 *   is given and has no height of its own.
 */
export type FlowKind = "number" | "list" | "chart"

/**
 * Built-in widgets whose body is rows or a fixed-size figure rather than a
 * chart that fills its box: they read best at their content's height.
 */
export const CONTENT_SIZED_WIDGETS: ReadonlySet<string> = new Set([
    "pipeline",
    "sales-perf",
    "top-revenue",
    "lead-source",
    "classification",
    "stream",
    "contact-analytics",
])

/** The kind of a card, from its id and, for a custom widget, its type. */
export function flowKind(id: string, customType?: string | null): FlowKind {
    if (id.startsWith("kpi-") || customType === "kpi") return "number"
    if (CONTENT_SIZED_WIDGETS.has(id)) return "list"
    return "chart"
}

export interface FlowCell {
    i: string
    x: number
    y: number
    h: number
}

export interface FlowItem {
    id: string
    /** `half`: a number card, two to a row. `full`: a chart or a list. */
    span: "half" | "full"
    /** Fixed height in px (a chart); null lets the card size to its content. */
    height: number | null
    /** The most a content-sized list may grow to, in px; null for the others. */
    maxHeight: number | null
}

/** The height in px of a grid cell `h` rows tall on the desk. */
export function gridRowsToPx(h: number): number {
    const rows = Math.max(1, Math.round(h))
    return rows * GRID_ROW_HEIGHT + (rows - 1) * GRID_MARGIN
}

/** A full-width card's height on a phone: its desk height, kept between the two bounds. */
export function flowHeight(h: number | undefined): number {
    const px = gridRowsToPx(h ?? FALLBACK_ROWS)
    return Math.min(FLOW_MAX_HEIGHT, Math.max(FLOW_MIN_HEIGHT, px))
}

/**
 * Which cards show on a phone, in which order, and how wide and tall.
 *
 * - `ids`: every widget the grid can draw, in the order its children come.
 * - `layout`: the saved positions. A card the person placed higher (smaller
 *   `y`), then further left (smaller `x`), comes first; a card with no
 *   position keeps its place after the placed ones.
 * - `hidden`: cards the person removed from the view.
 * - `kind`: how each card sizes itself (`flowKind`).
 *
 * A custom widget (`custom-…`) shows only once it has a position, as on the
 * desk, where it is part of a view only after it was added to it.
 */
export function flowItems({
    ids,
    layout,
    hidden,
    kind,
}: {
    ids: readonly string[]
    layout: readonly FlowCell[]
    hidden: ReadonlySet<string>
    kind: (id: string) => FlowKind
}): FlowItem[] {
    const cellById = new Map(layout.map((cell) => [cell.i, cell]))
    const order = new Map(ids.map((id, index) => [id, index]))

    return ids
        .filter((id) => !hidden.has(id))
        .filter((id) => !id.startsWith("custom-") || cellById.has(id))
        .sort((a, b) => {
            const ca = cellById.get(a)
            const cb = cellById.get(b)
            if (ca && cb) return ca.y - cb.y || ca.x - cb.x || order.get(a)! - order.get(b)!
            if (ca) return -1
            if (cb) return 1
            return order.get(a)! - order.get(b)!
        })
        .map((id): FlowItem => {
            const k = kind(id)
            if (k === "number") return { id, span: "half", height: null, maxHeight: null }
            const px = flowHeight(cellById.get(id)?.h)
            return k === "list"
                ? { id, span: "full", height: null, maxHeight: px }
                : { id, span: "full", height: px, maxHeight: null }
        })
}
