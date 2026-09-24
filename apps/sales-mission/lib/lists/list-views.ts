import { z } from "zod"
import { PAGE_SIZES, type PageSize } from "@/lib/missions/mission-paging"
import { paths } from "@/lib/paths"
import { sanitizeViewString } from "@/lib/view-cookies"
import { columnStateKey, defaultColumnState, mergeColumnState, sameColumnState, type ColumnSpec, type ColumnState } from "./list-columns"
import { ACTIVITY_COLUMNS, PROSPECT_COLUMNS, REPORT_COLUMNS } from "./list-column-specs"

/**
 * Saved views: named URLs.
 *
 * A list's view already lives in its URL (search, facets, the answer lens,
 * the sort, the page size) and reopens as it was left through a cookie per
 * list. A saved view is that URL with a name, plus the columns: choosing
 * one writes its query and size into the URL and its columns into the
 * columns menu; "Simpan tampilan" saves what the screen shows. Nothing here
 * decides what a list shows; it only stores, compares and rebuilds what the
 * URL already says (LeadEngine's `useListViews`, `viewConfigKey`).
 *
 * The query is kept in the list's own sanitised form (the remembered
 * view's), so a stale or hand-edited view can never carry anything the
 * URL could not, and a parser that changes later cleans old views the way
 * it cleans old links.
 */

export const SAVED_LISTS = ["activities", "prospects", "reports"] as const
export type SavedListKey = (typeof SAVED_LISTS)[number]

export const LIST_COLUMN_SPECS: Record<SavedListKey, ColumnSpec[]> = {
  activities: ACTIVITY_COLUMNS,
  prospects: PROSPECT_COLUMNS,
  reports: REPORT_COLUMNS,
}

export const DEFAULT_PAGE_SIZE: PageSize = 25
export const VIEW_NAME_MAX = 60

export interface ListViewConfig {
  /** The list's sanitised query string, without page or size. */
  query: string
  size: PageSize
  /** The optional columns in order (see list-columns.ts). */
  columns: ColumnState[]
}

export interface SavedListView {
  id: string
  name: string
  isDefault: boolean
  config: ListViewConfig
}

export const listKeySchema = z.enum(SAVED_LISTS)

export const viewNameSchema = z
  .string()
  .trim()
  .min(1, "Beri nama tampilannya.")
  .max(VIEW_NAME_MAX, `Nama tampilan paling panjang ${VIEW_NAME_MAX} huruf.`)

export const viewConfigSchema = z.object({
  query: z.string().max(2000, "Tampilan ini terlalu panjang untuk disimpan."),
  size: z.number().int().refine((value) => (PAGE_SIZES as readonly number[]).includes(value), "Ukuran halaman tidak dikenal."),
  columns: z.array(z.object({ id: z.string().min(1).max(40), visible: z.boolean() })).max(40),
})

export function parsePageSize(raw: unknown): PageSize {
  const value = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10)
  return (PAGE_SIZES as readonly number[]).includes(value) ? (value as PageSize) : DEFAULT_PAGE_SIZE
}

/** A config from the database or an old client, cleaned through the list's own rules. */
export function normalizeViewConfig(list: SavedListKey, raw: unknown): ListViewConfig {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  return {
    query: sanitizeViewString(list, typeof source.query === "string" ? source.query : ""),
    size: parsePageSize(source.size),
    columns: mergeColumnState(LIST_COLUMN_SPECS[list], source.columns),
  }
}

/** The view the screen shows: the URL's query (page dropped), its size, and the columns in use. */
export function currentViewConfig(list: SavedListKey, search: string, columns: readonly ColumnState[]): ListViewConfig {
  const params = new URLSearchParams(search)
  return {
    query: sanitizeViewString(list, search),
    size: parsePageSize(params.get("size")),
    columns: mergeColumnState(LIST_COLUMN_SPECS[list], columns),
  }
}

/**
 * The query in a form that compares: facet values sorted inside each facet
 * and the parameters sorted by name, so the order things were picked in
 * never makes a view read as changed. The search text is left as typed.
 */
export function canonicalQuery(list: SavedListKey, query: string): string {
  const params = new URLSearchParams(sanitizeViewString(list, query))
  const entries = [...params.entries()].map(([key, value]) => [key, key === "q" ? value : value.split(",").sort().join(",")] as const)
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return new URLSearchParams(entries.map(([key, value]) => [key, value])).toString()
}

/** One string per distinct screen: query, size, and which columns show in which order. */
export function viewConfigKey(list: SavedListKey, config: Partial<ListViewConfig>): string {
  const columns = mergeColumnState(LIST_COLUMN_SPECS[list], config.columns)
  return `${canonicalQuery(list, config.query ?? "")}|${parsePageSize(config.size)}|${columnStateKey(columns)}`
}

/** Whether the screen is the list as it first opens: nothing narrowing, default order and size, default columns. */
export function isPlainView(list: SavedListKey, config: ListViewConfig): boolean {
  return (
    canonicalQuery(list, config.query) === "" &&
    config.size === DEFAULT_PAGE_SIZE &&
    sameColumnState(mergeColumnState(LIST_COLUMN_SPECS[list], config.columns), defaultColumnState(LIST_COLUMN_SPECS[list]))
  )
}

/** The query string a view opens with: its query, and its size when it is not the default. */
export function viewSearch(list: SavedListKey, config: Pick<ListViewConfig, "query" | "size">): string {
  const params = new URLSearchParams(sanitizeViewString(list, config.query))
  if (config.size !== DEFAULT_PAGE_SIZE) params.set("size", String(config.size))
  return params.toString()
}

export function viewHref(list: SavedListKey, config: Pick<ListViewConfig, "query" | "size">): string {
  const search = viewSearch(list, config)
  switch (list) {
    case "activities":
      return paths.activities(search)
    case "prospects":
      return paths.prospectList(search)
    case "reports":
      return paths.reportList(search)
  }
}

/**
 * The chip to mark as chosen: only a view that is exactly what the screen
 * shows, preferring the one the person chose last, then the one this
 * browser remembers, then the first that matches. Never a near miss.
 */
export function markedView(
  list: SavedListKey,
  views: readonly SavedListView[],
  current: ListViewConfig,
  prefer: readonly (string | null | undefined)[] = [],
): SavedListView | null {
  const key = viewConfigKey(list, current)
  const matching = views.filter((view) => viewConfigKey(list, view.config) === key)
  for (const id of prefer) {
    const hit = id ? matching.find((view) => view.id === id) : undefined
    if (hit) return hit
  }
  return matching[0] ?? null
}

/**
 * The default view applies only on a list's first open in this browser: a
 * bare address with nothing remembered (`fresh`). A link, a remembered
 * view, or a screen that already is the default are left as they are.
 */
export function defaultViewToApply(list: SavedListKey, views: readonly SavedListView[], fresh: boolean, current: ListViewConfig): SavedListView | null {
  if (!fresh) return null
  const chosen = views.find((view) => view.isDefault)
  if (!chosen) return null
  return viewConfigKey(list, chosen.config) === viewConfigKey(list, current) ? null : chosen
}

/** A name not yet taken on this list, for "Simpan sebagai tampilan baru" ("Minggu ini (2)"). */
export function freeViewName(base: string, views: readonly Pick<SavedListView, "name">[]): string {
  const taken = new Set(views.map((view) => view.name.trim().toLowerCase()))
  const trimmed = base.trim().slice(0, VIEW_NAME_MAX)
  if (!taken.has(trimmed.toLowerCase())) return trimmed
  for (let n = 2; n < 100; n += 1) {
    const suffix = ` (${n})`
    const candidate = `${trimmed.slice(0, VIEW_NAME_MAX - suffix.length)}${suffix}`
    if (!taken.has(candidate.toLowerCase())) return candidate
  }
  return trimmed
}
