import type { MissionListItem } from "@/lib/missions/mission-schema"
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

/** The public calendar URL for a token, a month, a day, and a filter. */
export function publicCalendarHref(
  token: string,
  { month, day, sales }: { month: string; day?: string | null; sales: string[] }
): string {
  const params = new URLSearchParams()
  params.set("month", month)
  if (day) params.set("day", day)
  if (sales.length) params.set("sales", sales.join(","))
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
  { sales, masked }: { sales: string[]; masked: boolean }
): MissionListItem[] {
  const chosen = new Set(sales)
  return missions
    .filter(
      (mission) =>
        mission.status !== "CANCELLED" &&
        mission.status !== "REJECTED" &&
        (chosen.size === 0 || mission.assigneeIds.some((id) => chosen.has(id)))
    )
    .map((mission) => (masked ? { ...mission, clientCompanyName: maskClientName(mission.clientCompanyName) } : mission))
}
