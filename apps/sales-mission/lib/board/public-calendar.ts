import type { MissionListItem } from "@/lib/missions/mission-schema"
import { filterCalendarMissions, parseCalendarGroup, parseCalendarValues, writeCalendarView, type CalendarGroup } from "@/lib/missions/calendar-filter"
import { maskClientName } from "./board-snapshot"

/**
 * The public calendar's rules.
 *
 * Management opens a month calendar without signing in, so everything the
 * signed-in calendar derives from a viewer has to go: there is no "Saya", no
 * remembered view, no join state, and no link into a record. What is left is
 * the same four things the internal day panel shows — time, client, location,
 * sales — filtered to the people the link's holder asked for.
 */

const ID = /^[0-9a-f-]{36}$/i

/**
 * The `sales` parameter as a clean list of user ids.
 *
 * Deliberately not `parseCalendarSales`: that one accepts the "me" sentinel,
 * which resolves against the viewer. On a page with no viewer "me" is not a
 * filter, it is a silently empty one, so it is dropped here instead.
 */
export function parsePublicSales(raw: string | string[] | undefined): string[] {
  const text = Array.isArray(raw) ? raw.join(",") : (raw ?? "")
  const seen = new Set<string>()
  for (const part of text.split(",")) {
    const value = part.trim()
    if (ID.test(value)) seen.add(value)
  }
  return [...seen]
}

export interface PublicCalendarView {
  sales: string[]
  location: string[]
  type: string[]
  group: CalendarGroup
}

/** The whole view out of the query: whose, where, what kind, and how the day is grouped. */
export function parsePublicView(query: { sales?: string | string[]; location?: string | string[]; type?: string | string[]; group?: string | string[] }): PublicCalendarView {
  return {
    sales: parsePublicSales(query.sales),
    location: parseCalendarValues(query.location),
    type: parseCalendarValues(query.type),
    group: parseCalendarGroup(query.group),
  }
}

/** The public calendar URL for a token, a month, a day, and a view; nothing empty is written. */
export function publicCalendarHref(
  token: string,
  { month, day, ...view }: { month: string; day?: string | null } & Partial<PublicCalendarView> & { sales: string[] }
): string {
  const params = new URLSearchParams()
  params.set("month", month)
  if (day) params.set("day", day)
  writeCalendarView(params, view)
  return `/jadwal/${encodeURIComponent(token)}?${params.toString()}`
}

/**
 * What the public calendar may draw.
 *
 * The same rule as the internal calendar — a cancelled or refused visit is not
 * on a calendar — plus the link's own privacy decision: when the link was made
 * without client names, the name is masked here, once, so nothing downstream
 * can render the real one.
 */
export function publicCalendarMissions(
  missions: MissionListItem[],
  { sales, location = [], type = [], masked }: { sales: string[]; location?: string[]; type?: string[]; masked: boolean }
): MissionListItem[] {
  return filterCalendarMissions(missions, { chosen: new Set(sales), location, type }).map((mission) =>
    masked ? { ...mission, clientCompanyName: maskClientName(mission.clientCompanyName) } : mission
  )
}
