/**
 * A seen mark's key in public.user_hints: a short slug chosen in code. The
 * table's CHECK agrees (migration 20260923110000_leadengine_announcements.sql),
 * so a key the app writes is never refused by the database.
 */
export const HINT_KEY = /^[a-z0-9][a-z0-9_-]{0,59}$/

/** The lists whose description only teaches, and is closed for good once read. */
export type IntroList = "contacts" | "companies"

/**
 * The seen mark of a list page's description ("list-intro-contacts"), the
 * same shape as Sales Activity's keys for its lists, so one person's closed
 * descriptions read alike in public.user_hints and sales_mission.user_hints.
 */
export function listIntroKey(list: IntroList): string {
  return `list-intro-${list}`
}
