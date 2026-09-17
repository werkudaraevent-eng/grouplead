import { resolveSales, SALES_ME } from "./mission-filter"

export { resolveSales, SALES_ME }

/**
 * The calendar's one filter: whose visits to draw.
 *
 * The team is the default (the page exists to see the team before
 * assigning), "Saya" is the rep's own month, and the Sales facet is the
 * manager's "what is Sri carrying this week". It is the same `sales`
 * parameter the activity list uses, with the same "me" placeholder, so a
 * link can say "mine" without naming the viewer, and it is the only thing
 * the calendar remembers between visits: the month and the day are where
 * you are, not how you look.
 */

const ID = /^[0-9a-f-]{36}$/i

/** The `sales` parameter as a clean list: user ids and "me", once each, nothing else. */
export function parseCalendarSales(raw: string | string[] | undefined): string[] {
  const text = Array.isArray(raw) ? raw.join(",") : (raw ?? "")
  const seen = new Set<string>()
  for (const part of text.split(",")) {
    const value = part.trim()
    if (value === SALES_ME || ID.test(value)) seen.add(value)
  }
  return [...seen]
}

/** The calendar URL for a month, a day, and a filter; nothing empty is written. */
export function calendarHref({ month, day, sales }: { month: string; day?: string | null; sales: string[] }): string {
  const params = new URLSearchParams()
  params.set("month", month)
  if (day) params.set("day", day)
  if (sales.length) params.set("sales", sales.join(","))
  return `/workspace/calendar?${params.toString()}`
}

export function toggleMe(sales: string[]): string[] {
  return sales.includes(SALES_ME) ? sales.filter((id) => id !== SALES_ME) : [SALES_ME, ...sales]
}
