import { parseMissionQuery, resolveMissionFilter, serializeMissionQuery } from "@/lib/missions/mission-filter"
import { parsePageParams } from "@/lib/missions/mission-paging"
import { parseProspectQuery, serializeProspectQuery } from "@/lib/prospects/prospect-filter"
import { parseProspectPageParams } from "@/lib/prospects/prospect-paging"
import { parseReportQuery, serializeReportQuery } from "@/lib/reporting/report-filter"
import { parseReportPageParams } from "@/lib/reporting/report-paging"
import { parseCalendarSales } from "@/lib/missions/calendar-filter"

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

export type ListKey = "activities" | "prospects" | "reports" | "calendar"

export const VIEW_COOKIES: Record<ListKey, string> = {
  activities: "sa-view-activities",
  prospects: "sa-view-prospects",
  reports: "sa-view-reports",
  calendar: "sa-view-calendar",
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
      // Only whose visits are drawn; the month and the day are a place,
      // not a view, and are never restored.
      const sales = parseCalendarSales(params.sales)
      const out = new URLSearchParams()
      if (sales.length) out.set("sales", sales.join(","))
      return out.toString()
    }
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
