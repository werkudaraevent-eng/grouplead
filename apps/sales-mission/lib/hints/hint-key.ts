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
