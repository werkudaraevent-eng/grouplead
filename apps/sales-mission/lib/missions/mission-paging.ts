/**
 * Paging and sort vocabulary for the mission list. Pure, so the client-side
 * footer and the server-side query read the same values without the client
 * bundle pulling in a Supabase server client.
 */

export const PAGE_SIZES = [25, 50, 100] as const
export type PageSize = (typeof PAGE_SIZES)[number]

export const SORTS = ["upcoming", "asc", "desc"] as const
export type MissionSort = (typeof SORTS)[number]

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
  const sortRaw = one("sort")
  const sort = SORTS.includes(sortRaw as MissionSort) ? (sortRaw as MissionSort) : "upcoming"
  return { page, size, sort }
}
