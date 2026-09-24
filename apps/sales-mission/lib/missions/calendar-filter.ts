import type { MissionListItem } from "./mission-schema"
import { resolveSales, SALES_ME } from "./mission-filter"

export { resolveSales, SALES_ME }

/**
 * How the calendar is looked at.
 *
 * Whose visits to draw is the first filter: the team by default (the page
 * exists to see the team before assigning), "Saya" for the rep's own month,
 * the Sales facet for "what is Sri carrying this week". Where and what kind
 * are the other two, because a day with twenty-six visits is read by city
 * before it is read by name. And the day pane can be grouped by location or
 * by person, the way Hari ini groups by day. All of it is the URL, so a
 * public link carries the same view; the month and the day are a place, not
 * a view, and are never remembered.
 */

const ID = /^[0-9a-f-]{36}$/i

export const CALENDAR_GROUPS = ["none", "location", "sales"] as const
export type CalendarGroup = (typeof CALENDAR_GROUPS)[number]
export const CALENDAR_GROUP_LABELS: Record<CalendarGroup, string> = { none: "Tidak dikelompokkan", location: "Lokasi", sales: "Sales" }

export interface CalendarView {
  sales: string[]
  location: string[]
  type: string[]
  group: CalendarGroup
}

export const EMPTY_CALENDAR_VIEW: CalendarView = { sales: [], location: [], type: [], group: "none" }

type Raw = string | string[] | undefined

/** The `sales` parameter as a clean list: user ids and "me", once each, nothing else. */
export function parseCalendarSales(raw: Raw): string[] {
  const text = Array.isArray(raw) ? raw.join(",") : (raw ?? "")
  const seen = new Set<string>()
  for (const part of text.split(",")) {
    const value = part.trim()
    if (value === SALES_ME || ID.test(value)) seen.add(value)
  }
  return [...seen]
}

/**
 * A free-text facet (a location, a type) as a clean list. One value per
 * parameter, because a location may contain a comma; trimmed, capped in
 * length and count so a hand-edited URL cannot be a payload.
 */
export function parseCalendarValues(raw: Raw): string[] {
  const list = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw]
  const seen = new Set<string>()
  for (const item of list) {
    const value = item.trim().slice(0, 120)
    if (value) seen.add(value)
    if (seen.size >= 20) break
  }
  return [...seen]
}

export function parseCalendarGroup(raw: Raw): CalendarGroup {
  const value = Array.isArray(raw) ? raw[0] : raw
  return (CALENDAR_GROUPS as readonly string[]).includes(value ?? "") ? (value as CalendarGroup) : "none"
}

export function parseCalendarView(params: { sales?: Raw; location?: Raw; type?: Raw; group?: Raw }): CalendarView {
  return {
    sales: parseCalendarSales(params.sales),
    location: parseCalendarValues(params.location),
    type: parseCalendarValues(params.type),
    group: parseCalendarGroup(params.group),
  }
}

/** Whether the request says anything about the view at all. */
export function hasCalendarView(params: { sales?: Raw; location?: Raw; type?: Raw; group?: Raw }): boolean {
  return params.sales !== undefined || params.location !== undefined || params.type !== undefined || params.group !== undefined
}

/** The view as query parameters; nothing empty is written. */
export function writeCalendarView(params: URLSearchParams, view: Partial<CalendarView>): void {
  if (view.sales?.length) params.set("sales", view.sales.join(","))
  for (const value of view.location ?? []) params.append("location", value)
  for (const value of view.type ?? []) params.append("type", value)
  if (view.group && view.group !== "none") params.set("group", view.group)
}

/** The calendar URL for a month, a day, and a view; nothing empty is written. */
export function calendarHref({ month, day, ...view }: { month: string; day?: string | null } & Partial<CalendarView> & { sales: string[] }): string {
  const params = new URLSearchParams()
  params.set("month", month)
  if (day) params.set("day", day)
  writeCalendarView(params, view)
  return `/workspace/calendar?${params.toString()}`
}

export function toggleMe(sales: string[]): string[] {
  return sales.includes(SALES_ME) ? sales.filter((id) => id !== SALES_ME) : [SALES_ME, ...sales]
}

/**
 * What a calendar draws. A cancelled or refused visit is not on it (Google
 * Calendar hides declined events); then whose, where and what kind, each
 * facet OR within itself and AND with the others, like the activity list.
 */
export function filterCalendarMissions<T extends MissionListItem>(
  missions: T[],
  { chosen, location, type }: { chosen: ReadonlySet<string>; location: string[]; type: string[] }
): T[] {
  const locations = new Set(location)
  const types = new Set(type)
  return missions.filter(
    (mission) =>
      mission.status !== "CANCELLED" &&
      mission.status !== "REJECTED" &&
      (chosen.size === 0 || mission.assigneeIds.some((id) => chosen.has(id))) &&
      (locations.size === 0 || (mission.location !== null && locations.has(mission.location))) &&
      (types.size === 0 || types.has(mission.missionType))
  )
}

/** The locations and types the month actually has, for the facets; a value the filter names but the month lacks is kept so it can be cleared. */
export function calendarFacetValues(missions: MissionListItem[], view: Pick<CalendarView, "location" | "type">): { locations: string[]; types: string[] } {
  const locations = new Set(view.location)
  const types = new Set(view.type)
  for (const mission of missions) {
    if (mission.status === "CANCELLED" || mission.status === "REJECTED") continue
    if (mission.location) locations.add(mission.location)
    if (mission.missionType) types.add(mission.missionType)
  }
  const sort = (set: Set<string>) => [...set].sort((a, b) => a.localeCompare(b, "id"))
  return { locations: sort(locations), types: sort(types) }
}

export interface DaySection<T> {
  key: string
  /** Null for the one ungrouped section. */
  label: string | null
  missions: T[]
}

/** A day's visits in sections: one when ungrouped, else one per location or per primary sales, each in the day's order; the unnamed last. */
export function groupDayMissions<T extends MissionListItem>(missions: T[], group: CalendarGroup): Array<DaySection<T>> {
  if (group === "none") return [{ key: "all", label: null, missions }]
  const sections = new Map<string, DaySection<T>>()
  const unnamed = group === "location" ? "Tanpa lokasi" : "Belum ditugaskan"
  for (const mission of missions) {
    const label = (group === "location" ? mission.location : mission.primarySalesName) || unnamed
    const section = sections.get(label) ?? { key: label, label, missions: [] }
    section.missions.push(mission)
    sections.set(label, section)
  }
  return [...sections.values()].sort((a, b) => {
    if (a.label === unnamed) return 1
    if (b.label === unnamed) return -1
    return a.label!.localeCompare(b.label!, "id")
  })
}
