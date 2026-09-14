/**
 * Paging and sort vocabulary for the mission list. Pure, so the client-side
 * footer and the server-side query read the same values without the client
 * bundle pulling in a Supabase server client.
 */

export const PAGE_SIZES = [25, 50, 100] as const
export type PageSize = (typeof PAGE_SIZES)[number]

/** The columns a reader can sort the table by. */
export const SORT_COLUMNS = ["schedule", "client", "location", "sales", "status"] as const
export type SortColumn = (typeof SORT_COLUMNS)[number]
export type SortDirection = "asc" | "desc"

/**
 * A sort is `column:direction`, plus "upcoming": the default order, what is
 * ahead first and nearest at the top, then the past most recent first.
 * "asc" and "desc" on their own are the older spelling of the schedule sort
 * and still parse, so a saved link keeps working.
 */
export type MissionSort = "upcoming" | `${SortColumn}:${SortDirection}`

export const SORTS: readonly MissionSort[] = [
  "upcoming",
  ...SORT_COLUMNS.flatMap((column) => [`${column}:asc`, `${column}:desc`] as const),
]

export function parseSort(raw: string | undefined): MissionSort {
  if (raw === "asc" || raw === "desc") return `schedule:${raw}`
  return SORTS.includes(raw as MissionSort) ? (raw as MissionSort) : "upcoming"
}

/** Which column and direction a sort value names; the default is the schedule, ascending by what is next. */
export function sortParts(sort: MissionSort): { column: SortColumn; direction: SortDirection | "upcoming" } {
  if (sort === "upcoming") return { column: "schedule", direction: "upcoming" }
  const [column, direction] = sort.split(":") as [SortColumn, SortDirection]
  return { column, direction }
}

/**
 * The next sort after clicking a column header, as Material's data table
 * cycles it: unsorted → ascending → descending → back to the default. The
 * schedule column's "unsorted" is the upcoming order, which is a sort of its
 * own, so its cycle is upcoming → ascending → descending → upcoming.
 */
export function nextSort(column: SortColumn, current: MissionSort): MissionSort {
  const parts = sortParts(current)
  if (parts.column !== column || parts.direction === "upcoming") return `${column}:asc`
  if (parts.direction === "asc") return `${column}:desc`
  return "upcoming"
}

export function parsePageParams(params: Record<string, string | string[] | undefined>): {
  page: number
  size: PageSize
  sort: MissionSort
} {
  const one = (key: string) => {
    const value = params[key]
    return (Array.isArray(value) ? value[0] : value) ?? ""
  }
  const page = Math.max(0, Number.parseInt(one("page"), 10) || 0)
  const sizeRaw = Number.parseInt(one("size"), 10)
  const size = PAGE_SIZES.includes(sizeRaw as PageSize) ? (sizeRaw as PageSize) : 25
  return { page, size, sort: parseSort(one("sort")) }
}
