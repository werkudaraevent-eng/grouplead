/**
 * Every URL inside the app, in one place.
 *
 * The route segments are the product's public vocabulary ("activities",
 * not the code's "missions"), so they are spelled here and nowhere else:
 * a rename of the product is a rename of this file, not of a hundred
 * template literals. Old URLs are redirected in next.config.ts.
 */

const ACTIVITIES = "/workspace/activities"

type Query = Record<string, string | number | boolean | null | undefined> | URLSearchParams | string | undefined

function withQuery(base: string, query: Query): string {
  if (query === undefined || query === null) return base
  let qs: string
  if (typeof query === "string") qs = query
  else if (query instanceof URLSearchParams) qs = query.toString()
  else {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue
      params.set(key, String(value))
    }
    qs = params.toString()
  }
  return qs ? `${base}?${qs}` : base
}

export const paths = {
  workspace: "/workspace",
  notifications: "/workspace/notifications",
  calendar: "/workspace/calendar",
  board: "/workspace/board",
  prospects: "/workspace/prospects",
  reports: "/workspace/reports",

  /** The activity list, optionally with its filter/sort/page query. */
  activities: (query?: Query) => withQuery(ACTIVITIES, query),
  /** One activity. `fokus` scrolls the detail to a section; `hash` is a fragment. */
  activity: (id: string, options?: { fokus?: string; hash?: string }) =>
    `${ACTIVITIES}/${id}${options?.fokus ? `?fokus=${encodeURIComponent(options.fokus)}` : ""}${options?.hash ? `#${options.hash}` : ""}`,
  activityEdit: (id: string) => `${ACTIVITIES}/${id}/edit`,
  activityReport: (id: string, options?: { edit?: boolean }) => `${ACTIVITIES}/${id}/report${options?.edit ? "?edit=1" : ""}`,
  newActivity: (options?: { date?: string; from?: string; prospect?: string }) => withQuery(`${ACTIVITIES}/new`, options),
  activitiesExport: (query?: Query) => withQuery(`${ACTIVITIES}/export`, query),
  activitiesTemplate: `${ACTIVITIES}/template`,

  settings: {
    index: "/workspace/settings",
    activities: "/workspace/settings/activities",
    history: "/workspace/settings/history",
  },
} as const
