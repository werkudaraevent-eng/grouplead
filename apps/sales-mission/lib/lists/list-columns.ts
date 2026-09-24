/**
 * Which columns a list table shows, and in which order.
 *
 * A list has one locked column (the record's name, frozen at the leading
 * edge with the selection box) and a set of optional ones the person picks
 * and orders from the columns menu (M3 menu with checkboxes; Gmail,
 * HubSpot, Airtable, LeadEngine's `ColumnsMenu`). The choice is kept per
 * list in the browser and travels inside a saved view.
 *
 * What is stored is only the optional columns as `{ id, visible }` in
 * order. Reading it back is forgiving: an id the list no longer has is
 * dropped, a duplicate keeps its first place, and a column added since is
 * appended with its default visibility, so a stored order never hides a
 * new column's existence or breaks the table.
 */

export interface ColumnSpec {
  id: string
  /** The header, in the product's words. */
  label: string
  /** Width in px; the locked column's is its minimum, since it takes what is left. */
  width: number
  /** The name column: always shown, first, frozen, not in the menu's order. */
  locked?: boolean
  /** Shown until the person hides it. */
  defaultVisible?: boolean
  /** The list's sort column this header sets, when the column has an order. */
  sort?: string
}

export interface ColumnState {
  id: string
  visible: boolean
}

export function lockedColumn(specs: readonly ColumnSpec[]): ColumnSpec {
  const locked = specs.find((spec) => spec.locked)
  if (!locked) throw new Error("A list needs one locked column")
  return locked
}

export function optionalSpecs(specs: readonly ColumnSpec[]): ColumnSpec[] {
  return specs.filter((spec) => !spec.locked)
}

/** The list's own arrangement: its optional columns in spec order, each at its default visibility. */
export function defaultColumnState(specs: readonly ColumnSpec[]): ColumnState[] {
  return optionalSpecs(specs).map((spec) => ({ id: spec.id, visible: spec.defaultVisible === true }))
}

/** Stored or saved columns, cleaned against the list's specs (see the module note). */
export function mergeColumnState(specs: readonly ColumnSpec[], stored: unknown): ColumnState[] {
  const optional = optionalSpecs(specs)
  if (!Array.isArray(stored)) return defaultColumnState(specs)
  const known = new Map(optional.map((spec) => [spec.id, spec]))
  const seen = new Set<string>()
  const kept: ColumnState[] = []
  for (const entry of stored) {
    if (!entry || typeof entry !== "object") continue
    const id = (entry as { id?: unknown }).id
    if (typeof id !== "string" || !known.has(id) || seen.has(id)) continue
    seen.add(id)
    kept.push({ id, visible: (entry as { visible?: unknown }).visible !== false })
  }
  const added = optional.filter((spec) => !seen.has(spec.id)).map((spec) => ({ id: spec.id, visible: spec.defaultVisible === true }))
  return [...kept, ...added]
}

/** The columns a table draws: the locked one, then the visible optional ones in their order. */
export function visibleColumns(specs: readonly ColumnSpec[], state: readonly ColumnState[]): ColumnSpec[] {
  const byId = new Map(specs.map((spec) => [spec.id, spec]))
  const shown = state.filter((column) => column.visible).map((column) => byId.get(column.id)).filter((spec): spec is ColumnSpec => Boolean(spec && !spec.locked))
  return [lockedColumn(specs), ...shown]
}

/** A comparable form: `id` for a shown column, `id-` for a hidden one, in order. */
export function columnStateKey(state: readonly ColumnState[]): string {
  return state.map((column) => `${column.id}${column.visible ? "" : "-"}`).join(",")
}

export function sameColumnState(a: readonly ColumnState[], b: readonly ColumnState[]): boolean {
  return columnStateKey(a) === columnStateKey(b)
}

export function toggleColumn(state: readonly ColumnState[], id: string, visible: boolean): ColumnState[] {
  return state.map((column) => (column.id === id ? { ...column, visible } : column))
}

/** Move the column at `from` to `to` (indices into the optional columns); out-of-range moves change nothing. */
export function moveColumn(state: readonly ColumnState[], from: number, to: number): ColumnState[] {
  if (from === to || from < 0 || to < 0 || from >= state.length || to >= state.length) return [...state]
  const next = [...state]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

/** "N dari M tampil": the locked column counts, it is always shown. */
export function shownCount(specs: readonly ColumnSpec[], state: readonly ColumnState[]): { shown: number; total: number } {
  const lockedCount = specs.filter((spec) => spec.locked).length
  return { shown: lockedCount + state.filter((column) => column.visible).length, total: specs.length }
}

/**
 * The width the table needs before it scrolls sideways: every fixed column
 * plus the name column's minimum. Below it the table scrolls inside its
 * card, with the leading columns frozen; above it the name column takes
 * the rest.
 */
export function tableMinWidth(columns: readonly ColumnSpec[], extra = 0): number {
  return columns.reduce((sum, column) => sum + column.width, extra)
}
