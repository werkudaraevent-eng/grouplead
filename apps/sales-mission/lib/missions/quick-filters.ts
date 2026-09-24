import { countActiveFacets, resolveSales, SALES_ME, serializeMissionQuery, type MissionFilter, type MissionQuery } from "./mission-filter"

export { resolveSales, SALES_ME }

/**
 * The everyday narrowings of the activity list, in its filter row.
 *
 * They used to be a row of chips of their own above the bar (Semua · Saya ·
 * Hari ini · Minggu ini · Mendatang · the answer lenses), and every one of
 * them was already a value of something in the bar: "Hari ini" is the
 * Tanggal facet's `date=today`, so choosing it showed the same state twice,
 * as a chip and as "Tanggal: Hari ini". Now each lives in one place:
 *
 *   - the dates are the Tanggal facet's values, and the facet is always in
 *     the bar;
 *   - "Saya" is `sales=me`, a toggle chip beside the facets (the Sales
 *     facet lists the other people, so "me" is never shown twice either);
 *   - "Butuh jawaban" and "Menunggu tim" are the `filter=mine|team` lens,
 *     toggle chips with their counts, while the unit asks for answers;
 *   - "Semua" is no filter at all, which "Bersihkan semua" already is.
 *
 * The parameters are the ones the chips wrote (`date`, `sales=me`,
 * `filter`), unchanged, so every old link, saved view and remembered view
 * opens the list it always opened: the map from the old chips to the new
 * row is the identity, read by `parseMissionQuery` and
 * `resolveMissionFilter` as before, and the tests pin it.
 */

export type AnswerLens = Exclude<MissionFilter, "all">

/** Short forms of the answer lenses, for the toggle chips. */
export const LENS_CHIP_LABELS: Record<AnswerLens, string> = {
  mine: "Butuh jawaban",
  team: "Menunggu tim",
}

export function hasMe(query: MissionQuery): boolean {
  return query.sales.includes(SALES_ME)
}

/** "Saya" on or off, without touching anyone else chosen in the Sales facet. */
export function toggleMe(query: MissionQuery): MissionQuery {
  const sales = hasMe(query) ? query.sales.filter((id) => id !== SALES_ME) : [...query.sales, SALES_ME]
  return { ...query, sales }
}

/** What the Sales facet shows: the people chosen, "me" aside (the Saya chip shows that). */
export function salesOthers(query: MissionQuery): string[] {
  return query.sales.filter((id) => id !== SALES_ME)
}

/** The Sales facet's new choice, keeping "Saya" as it was. */
export function withSalesOthers(query: MissionQuery, others: string[]): MissionQuery {
  const kept = others.filter((id) => id !== SALES_ME)
  return { ...query, sales: hasMe(query) ? [...kept, SALES_ME] : kept }
}

export function toggleLens(current: MissionFilter, lens: AnswerLens): MissionFilter {
  return current === lens ? "all" : lens
}

/** How many things narrow the list: the facets, the search, and the answer lens. */
export function countNarrowing(query: MissionQuery, lens: MissionFilter): number {
  return countActiveFacets(query) + (lens === "all" ? 0 : 1)
}

/**
 * The list's query string for a state: facets, the lens, and whatever of
 * the sort and the page size the list carries (a filter change keeps both
 * and starts again from the first page).
 */
export function activityListParams(query: MissionQuery, lens: MissionFilter, carry: { sort?: string | null; size?: string | null } = {}): URLSearchParams {
  const params = serializeMissionQuery(query)
  if (lens !== "all") params.set("filter", lens)
  if (carry.sort) params.set("sort", carry.sort)
  if (carry.size) params.set("size", carry.size)
  return params
}
