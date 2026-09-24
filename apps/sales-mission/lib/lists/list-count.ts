import type { SavedListKey } from "./list-views"

/**
 * How many records a list holds, said in one place per window class.
 *
 * On a phone the count sits under the search, above the cards, and always
 * says something: the total, or "X dari Y" while a filter narrows the list.
 * On a desk it sits at the leading end of the table's footer, level with
 * the paging, and speaks only while a filter narrows the list: unfiltered,
 * the footer's range ("1–25 dari 170") already says the total, and the
 * toolbar holds controls only. Both read "Menyaring…" while the list's
 * next query loads.
 *
 * X is every match across all pages, Y the same list with no facets (on
 * Aktivitas, the same answer lens), so the pair means one thing on every
 * list.
 */

/** Each list's word for its records, as the count reads it ("12 dari 40 prospek"). */
export const LIST_NOUNS: Record<SavedListKey, string> = {
  activities: "aktivitas",
  prospects: "prospek",
  reports: "laporan",
}

export interface ListCountFacts {
  /** Every match of the current query, across all pages. */
  shown: number
  /** The same list with no facets. */
  total: number
  /** Whether anything narrows the list (the filter bar's active count is above zero). */
  narrowed: boolean
}

export type ListCountPlace = "phone" | "footer"

/** The count's words for one place, or "" when that place says nothing. */
export function listCountText(list: SavedListKey, facts: ListCountFacts, filtering: boolean, place: ListCountPlace): string {
  if (filtering) return "Menyaring…"
  const noun = LIST_NOUNS[list]
  if (facts.narrowed) return `${facts.shown} dari ${facts.total} ${noun}`
  return place === "phone" ? `${facts.total} ${noun}` : ""
}
