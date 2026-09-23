/**
 * Which page a usage row is about, and what it is called on screen.
 *
 * A path is recorded the way a product analytics tool records a screen: its
 * route, not its address. Ids become `:id` and the query string is dropped,
 * so `/leads/4812?tab=notes` is counted as `/leads/:id`: one row per kind
 * of page, and no record id ever lands in a usage table (Salesforce's
 * Lightning Usage App counts pages the same way, by page type). Sales
 * Activity keeps the same rules for its own paths in its own
 * `lib/usage/usage-path.ts`.
 */

/** The longest path a usage row accepts, in the database check as well. */
export const USAGE_PATH_MAX = 200

/**
 * Prefixes a usage row refuses, as the database check does (`NOT LIKE
 * '/api%'`, `NOT LIKE '/login%'`): an API call is not a page, and the login
 * screen is not the app. Plain prefixes on purpose, so the browser, the
 * server action and the table all draw the line in the same place.
 */
export const USAGE_REFUSED_PREFIXES = ["/api", "/login"] as const

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NUMERIC = /^\d+$/
/** An opaque token (a long run of letters and digits): an id by another name. */
const OPAQUE = /^(?=.*\d)[A-Za-z0-9_-]{16,}$/

function isIdSegment(segment: string): boolean {
  return UUID.test(segment) || NUMERIC.test(segment) || OPAQUE.test(segment)
}

/**
 * Routes whose next segment is always one record, whatever it looks like.
 * Most records are opened by a uuid or a number, which the shape rules
 * above catch; a company unit and a goal are opened by their slug
 * (`/settings/companies/werkudara-event`, `/settings/goals/q3-revenue`),
 * which reads like a route word, so these routes name the slot instead.
 * `keep` lists the route words that sit in the same slot
 * (`/settings/companies/new`).
 */
const RECORD_ROUTES: ReadonlyArray<{ parent: readonly string[]; keep?: readonly string[] }> = [
  { parent: ["leads"] },
  { parent: ["companies"] },
  { parent: ["contacts"] },
  { parent: ["settings", "companies"], keep: ["new"] },
  { parent: ["settings", "goals"] },
  { parent: ["settings", "pipeline"] },
]

/**
 * The route a URL path belongs to: query and fragment dropped, empty and
 * trailing segments removed, ids and record slugs replaced by `:id`.
 * Idempotent, so the server can run it again on what the browser already
 * normalised. A path longer than the column loses whole segments from its
 * end, never half of one, so a cut can never turn a word into an id.
 */
export function normalizeUsagePath(raw: string): string {
  const bare = raw.split(/[?#]/, 1)[0] ?? ""
  const segments = bare
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => (isIdSegment(segment) ? ":id" : segment))
  for (const route of RECORD_ROUTES) {
    const slot = route.parent.length
    if (segments.length <= slot) continue
    if (!route.parent.every((word, index) => segments[index] === word)) continue
    if (route.keep?.includes(segments[slot])) continue
    segments[slot] = ":id"
  }
  while (segments.length > 0 && `/${segments.join("/")}`.length > USAGE_PATH_MAX) segments.pop()
  return `/${segments.join("/")}`
}

/** A path the usage tables accept: rooted, short enough, not an API call or the login screen. */
export function isUsagePath(path: string): boolean {
  if (!path.startsWith("/") || path.length > USAGE_PATH_MAX) return false
  return !USAGE_REFUSED_PREFIXES.some((prefix) => path.startsWith(prefix))
}

/** The main places, named as the navigation drawer and the pages name them. */
const PAGE_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/leads": "Pipeline",
  "/leads/:id": "Lead details",
  "/leads/:id/print": "Lead details · Print",
  "/companies": "Companies",
  "/companies/:id": "Company details",
  "/contacts": "Contacts",
  "/contacts/:id": "Contact details",
  "/history": "History",
  "/goals": "Goals",
  "/changelog": "Changelog",
  "/settings": "Settings",
}

/** Settings' pages by what follows /settings/, named as their rows on the Settings page are. */
const SETTINGS_LABELS: Record<string, string> = {
  ai: "AI",
  "ai/usage": "AI usage",
  announcements: "Announcements",
  companies: "Companies",
  "companies/new": "New company",
  "companies/:id": "Company",
  "companies/:id/members": "Company members",
  goals: "Goals",
  "goals/:id": "Goal configuration",
  "master-options": "Lead attributes & segments",
  permissions: "Roles & permissions",
  pipeline: "Pipeline & stages",
  "pipeline/:id": "Pipeline",
  profile: "My profile",
  "recycle-bin": "Recycle bin",
  registry: "Lead field registry",
  segments: "Segments & dimensions",
  usage: "Usage",
  users: "Users",
}

/**
 * The product's own name for a recorded path ("Lead details", "Pipeline",
 * "Settings · Users"). A path the app does not know yet (a page added
 * later) is shown as itself rather than guessed at.
 */
export function usagePageLabel(path: string): string {
  const known = PAGE_LABELS[path]
  if (known) return known
  const settingsPrefix = "/settings/"
  if (path.startsWith(settingsPrefix)) {
    const setting = SETTINGS_LABELS[path.slice(settingsPrefix.length)]
    if (setting) return `Settings · ${setting}`
  }
  return path
}
