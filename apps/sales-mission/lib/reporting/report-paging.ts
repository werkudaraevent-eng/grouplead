import { PAGE_SIZES, type PageSize } from "@/lib/missions/mission-paging"

/** Sort vocabulary of the report list; newest sent first is the default working order. */
export const REPORT_SORT_COLUMNS = ["submitted", "client", "sales", "outcome", "interest", "value", "follow_up", "actual"] as const
export type ReportSortColumn = (typeof REPORT_SORT_COLUMNS)[number]
export type SortDirection = "asc" | "desc"
export type ReportSort = `${ReportSortColumn}:${SortDirection}`

export const DEFAULT_REPORT_SORT: ReportSort = "submitted:desc"

export const REPORT_SORTS: readonly ReportSort[] = REPORT_SORT_COLUMNS.flatMap((column) => [`${column}:asc`, `${column}:desc`] as const)

export function parseReportSort(raw: string | undefined): ReportSort {
  return (REPORT_SORTS as readonly string[]).includes(raw ?? "") ? (raw as ReportSort) : DEFAULT_REPORT_SORT
}

export function reportSortParts(sort: ReportSort): { column: ReportSortColumn; direction: SortDirection } {
  const [column, direction] = sort.split(":") as [ReportSortColumn, SortDirection]
  return { column, direction }
}

/**
 * Unsorted → ascending → descending → back to the default, as Material's
 * data table cycles. The default is itself "submitted:desc", so the
 * submitted column flips between desc and asc.
 */
export function nextReportSort(column: ReportSortColumn, current: ReportSort): ReportSort {
  const parts = reportSortParts(current)
  if (parts.column !== column) return column === "submitted" ? "submitted:desc" : `${column}:asc`
  if (column === "submitted") return parts.direction === "desc" ? "submitted:asc" : "submitted:desc"
  if (parts.direction === "asc") return `${column}:desc`
  return DEFAULT_REPORT_SORT
}

export function parseReportPageParams(params: Record<string, string | string[] | undefined>): { page: number; size: PageSize; sort: ReportSort } {
  const one = (key: string) => {
    const value = params[key]
    return (Array.isArray(value) ? value[0] : value) ?? ""
  }
  const page = Math.max(0, Number.parseInt(one("page"), 10) || 0)
  const sizeRaw = Number.parseInt(one("size"), 10)
  const size = (PAGE_SIZES as readonly number[]).includes(sizeRaw) ? (sizeRaw as PageSize) : 25
  return { page, size, sort: parseReportSort(one("sort")) }
}
