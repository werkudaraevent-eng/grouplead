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

/**
 * Every page, other than the lists, whose description only teaches (what the
 * page is for, how it works) and is closed for good once read. A page whose
 * line under the title states facts (a record's type, a count, "Updated 2m
 * ago") is not here: that line always shows. Named after the page's path, so
 * `/settings/ai/usage` is "settings-ai-usage"; a record's page is named after
 * what it is ("settings-goal-configuration" for every goal's), one key for
 * all its records. A hint inside a page that only teaches is here too, named
 * after what it teaches: "record-inline-edit", the line at the top of a
 * contact's or a company's About card ("Click a value to change it."), one
 * key for both pages.
 */
export const INTRO_PAGES = [
  "settings",
  "settings-ai",
  "settings-ai-usage",
  "settings-announcements",
  "settings-companies",
  "settings-goals",
  "settings-goal-configuration",
  "settings-history",
  "settings-master-options",
  "settings-pipeline",
  "settings-profile",
  "settings-recycle-bin",
  "settings-registry",
  "settings-segments",
  "settings-usage",
  "settings-users",
  "changelog",
  "record-inline-edit",
] as const

export type IntroPage = (typeof INTRO_PAGES)[number]

/** The prefix every page description's seen mark starts with. */
export const PAGE_INTRO_PREFIX = "page-intro-"

/**
 * The seen mark of a page's description ("page-intro-settings-ai"), the same
 * shape as Sales Activity's `page-intro-<page>`, beside the lists'
 * `list-intro-<list>`.
 */
export function pageIntroKey(page: IntroPage): string {
  return `${PAGE_INTRO_PREFIX}${page}`
}

/** The seen marks of page descriptions among all of a person's marks. */
export function pageIntroKeys(seen: readonly string[]): string[] {
  return seen.filter((key) => key.startsWith(PAGE_INTRO_PREFIX))
}
