/**
 * A tab from the previous build, as rules that run without a DOM so they
 * can be tested.
 *
 * A deploy replaces the server while open tabs keep the code they loaded.
 * On the Hobby plan there is no Skew Protection to route those tabs to the
 * old deployment, so three things can happen to them:
 *
 * - A server action. The tab posts the action id it was built with; the
 *   new server does not know it and answers 404 with the header
 *   `x-nextjs-action-not-found: 1` (Next.js 16.3.6,
 *   `dist/server/app-render/action-handler.js`, `handleUnrecognizedFetchAction`,
 *   which also logs "Failed to find Server Action … This request might be
 *   from an older or newer deployment"). The browser side turns that header
 *   into an `UnrecognizedActionError` whose message is
 *   `Server Action "<id>" was not found on the server.`
 *   (`dist/client/components/router-reducer/reducers/server-action-reducer.js`,
 *   `fetchServerAction`, and `dist/client/components/unrecognized-action-error.js`).
 *   The `await` on the action rejects with it; inside `useActionState` or a
 *   transition React throws it to the nearest error boundary, which is how
 *   a Sales Activity rep lost a new activity five times in a row on
 *   2026-09-29. LeadEngine's lead form calls actions the same way.
 * - A chunk. Code split out of the old build is gone from the new one, so
 *   loading it fails with Turbopack's `ChunkLoadError` ("Failed to load
 *   chunk …").
 * - A navigation. Next.js already handles this one: an RSC response from
 *   another build, or any response that is not RSC (the 500 "router state
 *   header was sent but could not be parsed" is one), makes the router do
 *   a full page load instead (`fetch-server-response.js`, `doMpaNavigation`).
 *
 * The first two are what this file recognises. The generic "An unexpected
 * response was received from the server." is not on the list: a timeout or
 * a crash says the same, and telling a rep the app was updated when it was
 * not would send them reloading for nothing. The version check below catches
 * those tabs from the other side.
 *
 * Kept in step with `apps/sales-mission/lib/deploy/stale-client.ts`.
 */

/** What the browser throws when the server no longer has this tab's action. */
const UNRECOGNIZED_ACTION = /Server Action "[^"]*" was not found on the server/
/** The server's own wording, should anything pass it on as a message. */
const ACTION_NOT_FOUND = /Failed to find Server Action/
/** A lazily loaded file of the previous build that the new deploy no longer serves. */
const CHUNK_LOAD = /Failed to load chunk|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i

/**
 * "action": something the person sent did not arrive, so the notice says
 * their input is still there and to submit it again. "build": the code on
 * screen is older than the server, nothing was lost yet.
 */
export type StaleKind = "action" | "build"

function readError(error: unknown): { name: string; message: string } | null {
  if (typeof error === "string") return { name: "", message: error }
  if (!error || typeof error !== "object") return null
  const { name, message } = error as { name?: unknown; message?: unknown }
  return { name: typeof name === "string" ? name : "", message: typeof message === "string" ? message : "" }
}

/** Why this error means the tab is older than the server, or null when it does not. */
export function staleKind(error: unknown): StaleKind | null {
  const read = readError(error)
  if (!read) return null
  if (read.name === "UnrecognizedActionError") return "action"
  if (UNRECOGNIZED_ACTION.test(read.message) || ACTION_NOT_FOUND.test(read.message)) return "action"
  if (read.name === "ChunkLoadError" || CHUNK_LOAD.test(read.message)) return "build"
  return null
}

export function isStaleDeploymentError(error: unknown): boolean {
  return staleKind(error) !== null
}

/**
 * Whether an error is Next.js's redirect signal. A server action that ends
 * in `redirect()` rejects its `await` in the browser with it, so for a form
 * whose action redirects on success this is what success looks like.
 */
export function isRedirectSignal(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const digest = (error as { digest?: unknown }).digest
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT;")
}

// ─── The version check ───────────────────────────────────────────────

/** Where the running deployment says which build it is. Uncached, outside the session proxy. */
export const VERSION_PATH = "/api/version"
/** While the tab is in front. */
export const VERSION_CHECK_EVERY_MS = 5 * 60_000
/** Coming back to the tab asks again, but not more often than this. */
export const VERSION_CHECK_ON_FOCUS_AFTER_MS = 60_000
/** How often the component asks whether a check is due. */
export const VERSION_TICK_MS = 60_000

/** The build id in the endpoint's answer, or null for anything else (a login page, an error, junk). */
export function parseBuildId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null
  const id = (payload as { buildId?: unknown }).buildId
  if (typeof id !== "string") return null
  const trimmed = id.trim()
  return trimmed.length > 0 && trimmed.length <= 200 ? trimmed : null
}

/** Whether the server runs another build than the one this tab loaded. An unknown answer is never a new build. */
export function isNewBuild(current: string, served: string | null): boolean {
  return served !== null && current.length > 0 && served !== current
}

export interface DeployWatchDeps {
  now: () => number
  /** The build this tab's code came from. */
  currentBuildId: string
  /** The running deployment's build id, or null when it could not be read. */
  fetchBuildId: () => Promise<string | null>
  onNewBuild: (buildId: string) => void
}

export interface DeployWatch {
  /** The person came back to the tab. */
  focus: () => void
  /** The interval fired while the tab is in front. */
  tick: () => void
  dispose: () => void
}

/**
 * Checks on coming back to the tab (at most every minute) and every five
 * minutes while it is in front; the page has just loaded, so the first
 * check waits. Once a new build is seen the watch stops and hands over to
 * `onNewBuild`, once: the notice then stays until the person reloads.
 *
 * Shaped like `lib/devices/session-watch.ts`.
 */
export function createDeployWatch(deps: DeployWatchDeps): DeployWatch {
  let lastCheck = deps.now()
  let checking = false
  let stopped = false

  const check = () => {
    if (checking || stopped) return
    checking = true
    lastCheck = deps.now()
    deps.fetchBuildId().then(
      (served) => {
        checking = false
        if (stopped || !isNewBuild(deps.currentBuildId, served)) return
        stopped = true
        deps.onNewBuild(served as string)
      },
      () => {
        checking = false
      }
    )
  }

  return {
    focus() {
      if (stopped) return
      if (deps.now() - lastCheck >= VERSION_CHECK_ON_FOCUS_AFTER_MS) check()
    },
    tick() {
      if (stopped) return
      if (deps.now() - lastCheck >= VERSION_CHECK_EVERY_MS) check()
    },
    dispose() {
      stopped = true
    },
  }
}

// ─── What the person reads ───────────────────────────────────────────

export const STALE_COPY = {
  /** The version check saw a new build; nothing was lost. */
  newBuild: "A new version is available. Reload so your changes save.",
  /** Something was sent and did not arrive. */
  actionFailed: "LeadEngine was just updated. Your input is kept — reload and submit again.",
  reload: "Reload",
  /** The error screen, when the page itself could not go on. */
  screenTitle: "LeadEngine was just updated",
  screenBody: "This page is from the previous version. Reload to open the new one; unsaved input in the lead form and an activity's composer comes back with it.",
} as const
