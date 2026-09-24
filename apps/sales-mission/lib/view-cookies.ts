import { parseMissionQuery, resolveMissionFilter, serializeMissionQuery } from "@/lib/missions/mission-filter"
import { parsePageParams } from "@/lib/missions/mission-paging"
import { parseProspectQuery, serializeProspectQuery } from "@/lib/prospects/prospect-filter"
import { parseProspectPageParams } from "@/lib/prospects/prospect-paging"
import { parseReportQuery, serializeReportQuery } from "@/lib/reporting/report-filter"
import { parseReportPageParams } from "@/lib/reporting/report-paging"
import { parseCalendarView, writeCalendarView } from "@/lib/missions/calendar-filter"
import { parseRingkasanQuery, serializeRingkasanQuery } from "@/lib/reporting/ringkasan-filter"

/**
 * A list remembers how you last looked at it.
 *
 * Gmail, Linear and Jira reopen a list with the filters you left on it;
 * without that, a rep who tapped "Hari ini" on the activity list taps it
 * again every time they come back from a detail page or another tab. The
 * memory is one cookie per list holding the list's own query string (no
 * page or size), written by the browser whenever the view changes and read
 * by the server when the list is opened with no query at all, which then
 * redirects to the remembered one. The URL stays honest and shareable; a
 * stale or hand-edited cookie is parsed through the list's own parser, so
 * it can never carry anything the URL could not.
 */

export type ListKey = "activities" | "prospects" | "reports" | "calendar" | "ringkasan"

export const VIEW_COOKIES: Record<ListKey, string> = {
  activities: "sa-view-activities",
  prospects: "sa-view-prospects",
  reports: "sa-view-reports",
  calendar: "sa-view-calendar",
  ringkasan: "sa-view-ringkasan",
}

type Params = Record<string, string | string[] | undefined>

/** A query string a list's own parser accepts, with page and size dropped; "" when nothing is set. */
export function sanitizeView(list: ListKey, params: Params): string {
  switch (list) {
    case "activities": {
      const out = serializeMissionQuery(parseMissionQuery(params))
      const lens = resolveMissionFilter(Array.isArray(params.filter) ? params.filter[0] : params.filter)
      if (lens !== "all") out.set("filter", lens)
      const { sort } = parsePageParams(params)
      if (sort !== parsePageParams({}).sort) out.set("sort", sort)
      return out.toString()
    }
    case "prospects": {
      const out = serializeProspectQuery(parseProspectQuery(params))
      const { sort } = parseProspectPageParams(params)
      if (sort !== parseProspectPageParams({}).sort) out.set("sort", sort)
      return out.toString()
    }
    case "reports": {
      const out = serializeReportQuery(parseReportQuery(params))
      const { sort } = parseReportPageParams(params)
      if (sort !== parseReportPageParams({}).sort) out.set("sort", sort)
      return out.toString()
    }
    case "calendar": {
      // Whose, where, what kind, and how the day is grouped; the month and
      // the day are a place, not a view, and are never restored.
      const out = new URLSearchParams()
      writeCalendarView(out, parseCalendarView(params))
      return out.toString()
    }
    case "ringkasan":
      // The period and whose visits; the daily card's day is a place.
      return serializeRingkasanQuery({ ...parseRingkasanQuery(params), day: null }).toString()
  }
}

/** The same, from a query string (the cookie's value or `location.search`). */
export function sanitizeViewString(list: ListKey, raw: string): string {
  return sanitizeView(list, Object.fromEntries(new URLSearchParams(raw)))
}

/** Whether a request carries any query at all (a bare open of the list). */
export function isBareRequest(params: Params): boolean {
  return Object.values(params).every((value) => value === undefined || value === "" || (Array.isArray(value) && value.length === 0))
}

/**
 * What a request for a list should do with its memory: go to the
 * remembered query (a bare open with something remembered), or render.
 * `fresh` is a bare open with no memory at all, the list's first open in
 * this browser: the one moment a saved default view may choose the view
 * (LeadEngine's `resolveRememberedView`). An empty cookie is a memory too,
 * of the plain list, written by "Bersihkan semua" or by the list's first
 * visit, so it is never fresh.
 */
export function resolveRememberedView(list: ListKey, params: Params, cookie: string | undefined): { query: string | null; fresh: boolean } {
  if (!isBareRequest(params)) return { query: null, fresh: false }
  if (cookie === undefined) return { query: null, fresh: true }
  let decoded = cookie
  try {
    decoded = decodeURIComponent(cookie)
  } catch {
    // Left as is; the parser drops what it cannot read.
  }
  const qs = sanitizeViewString(list, decoded)
  return { query: qs || null, fresh: false }
}
