import { resolveSales, SALES_ME, serializeMissionQuery, type DatePreset, type MissionFilter, type MissionQuery } from "./mission-filter"
import type { MissionSort } from "./mission-paging"

export { resolveSales, SALES_ME }

/**
 * The chips above the activity list: the handful of narrowings a person
 * reaches for every day, one tap each, outside the Filter sheet.
 *
 * They are not new query state. "Hari ini" is `date=today`, "Saya" is
 * `sales=me`, "Butuh jawaban" is the `filter=mine` lens. What the chips
 * add is a link for each that keeps everything else in the query, so
 * tapping Hari ini while searching for a client keeps the search.
 */

/** The date presets offered as chips; the rest stay in the sheet. */
export const QUICK_DATES = ["today", "week", "upcoming"] as const satisfies readonly DatePreset[]
export type QuickDate = (typeof QUICK_DATES)[number]

export interface QuickView {
  query: MissionQuery
  lens: MissionFilter
  sort: MissionSort
}

export function isQuickDate(preset: DatePreset | null): preset is QuickDate {
  return preset !== null && (QUICK_DATES as readonly string[]).includes(preset)
}

export function hasMe(query: MissionQuery): boolean {
  return query.sales.includes(SALES_ME)
}

/** Whether no chip is on: the "Semua" state. */
export function isPlainView(view: QuickView): boolean {
  return view.query.date === null && !hasMe(view.query) && view.lens === "all"
}

export function toggleDate(view: QuickView, preset: QuickDate): QuickView {
  const next = view.query.date === preset ? null : preset
  return { ...view, query: { ...view.query, date: next, from: null, to: null } }
}

export function toggleMe(view: QuickView): QuickView {
  const sales = hasMe(view.query) ? view.query.sales.filter((id) => id !== SALES_ME) : [...view.query.sales, SALES_ME]
  return { ...view, query: { ...view.query, sales } }
}

export function toggleLens(view: QuickView, lens: Exclude<MissionFilter, "all">): QuickView {
  return { ...view, lens: view.lens === lens ? "all" : lens }
}

/** Everything off, but the search and the sheet's facets kept. */
export function plainView(view: QuickView): QuickView {
  return {
    ...view,
    lens: "all",
    query: { ...view.query, date: null, from: null, to: null, sales: view.query.sales.filter((id) => id !== SALES_ME) },
  }
}

/** The list query for a view: facets, the lens, and a non-default sort. */
export function viewParams(view: QuickView, defaultSort: MissionSort): URLSearchParams {
  const params = serializeMissionQuery(view.query)
  if (view.lens !== "all") params.set("filter", view.lens)
  if (view.sort !== defaultSort) params.set("sort", view.sort)
  return params
}
