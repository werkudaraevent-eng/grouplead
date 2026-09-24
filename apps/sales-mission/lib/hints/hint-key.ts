/** Hint keys are short slugs chosen in code; the table's CHECK agrees. */
export const HINT_KEY = /^[a-z0-9][a-z0-9_-]{0,59}$/

/** The lists whose description only teaches, and is closed for good once read. */
export type IntroList = "activities" | "prospects" | "reports"

/**
 * The seen mark of a list page's description ("list-intro-activities"),
 * written to sales_mission.user_hints when the person closes it. LeadEngine
 * keys its lists' descriptions the same way in public.user_hints.
 */
export function listIntroKey(list: IntroList): string {
  return `list-intro-${list}`
}

/** Every other page whose description only teaches: one slug per page. */
export const INTRO_PAGES = [
  "board",
  "calendar",
  "guide",
  "install",
  "my-calendar",
  "new-activity",
  "new-prospect",
  "edit-prospect",
  "notifications",
  "report-insight",
  "report-summary",
  "settings",
  "settings-activities",
  "settings-ai",
  "settings-ai-usage",
  "settings-announcements",
  "settings-board",
  "settings-data",
  "settings-follow-up",
  "settings-form",
  "settings-history",
  "settings-prospect-form",
  "settings-prospect-statuses",
  "settings-recycle-bin",
  "settings-report-form",
  "settings-usage",
  "whats-new",
] as const
export type IntroPage = (typeof INTRO_PAGES)[number]

/**
 * The seen mark of any other page's teaching description
 * ("page-intro-calendar"). A description that states facts (Hari ini's
 * date, a record's contact) has no key: it always shows.
 */
export function pageIntroKey(page: IntroPage): string {
  return `page-intro-${page}`
}
