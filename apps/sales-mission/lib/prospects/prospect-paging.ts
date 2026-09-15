import { PAGE_SIZES, type PageSize } from "@/lib/missions/mission-paging"

/** Sort vocabulary of the prospect list; "due" is the default working order. */
export const PROSPECT_SORT_COLUMNS = ["company", "contact", "status", "owner", "last_contact", "next_contact", "created"] as const
export type ProspectSortColumn = (typeof PROSPECT_SORT_COLUMNS)[number]
export type ProspectSort = "due" | `${ProspectSortColumn}:${"asc" | "desc"}`

export const PROSPECT_SORTS: readonly ProspectSort[] = [
  "due",
  ...PROSPECT_SORT_COLUMNS.flatMap((column) => [`${column}:asc`, `${column}:desc`] as const),
]

export function parseProspectSort(raw: string | undefined): ProspectSort {
  return PROSPECT_SORTS.includes(raw as ProspectSort) ? (raw as ProspectSort) : "due"
}

export function prospectSortParts(sort: ProspectSort): { column: ProspectSortColumn | "due"; direction: "asc" | "desc" | "due" } {
  if (sort === "due") return { column: "due", direction: "due" }
  const [column, direction] = sort.split(":") as [ProspectSortColumn, "asc" | "desc"]
  return { column, direction }
}

/** Unsorted → ascending → descending → back to the default, as Material's data table cycles. */
export function nextProspectSort(column: ProspectSortColumn, current: ProspectSort): ProspectSort {
  const parts = prospectSortParts(current)
  if (parts.column !== column) return `${column}:asc`
  if (parts.direction === "asc") return `${column}:desc`
  return "due"
}

export function parseProspectPageParams(params: Record<string, string | string[] | undefined>): { page: number; size: PageSize; sort: ProspectSort } {
  const one = (key: string) => {
    const value = params[key]
    return (Array.isArray(value) ? value[0] : value) ?? ""
  }
  const page = Math.max(0, Number.parseInt(one("page"), 10) || 0)
  const sizeRaw = Number.parseInt(one("size"), 10)
  const size = PAGE_SIZES.includes(sizeRaw as PageSize) ? (sizeRaw as PageSize) : 25
  return { page, size, sort: parseProspectSort(one("sort")) }
}
