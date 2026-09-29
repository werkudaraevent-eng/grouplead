/**
 * The open tab's two jobs for Active devices, as rules that run without a
 * DOM so they can be tested.
 *
 * - Touch: tell the server this device is in use (the app, the browser,
 *   the city), on load and then on coming back to the tab, at most every
 *   five minutes. The server throttles too; this saves the request.
 * - Check: ask Supabase Auth whether this session still exists, on coming
 *   back to the tab (at most every 30 seconds) and every five minutes while
 *   the tab is in front. A tab nobody navigates never passes the proxy, so
 *   a device signed out elsewhere would otherwise keep showing the app
 *   until its access token ran out, up to an hour later.
 *
 * Once a check answers "signed out", the watch stops for good and hands
 * over to `onSignedOut`, once.
 *
 * Kept in step with `apps/sales-mission/lib/devices/session-watch.ts`.
 */

export const TOUCH_EVERY_MS = 5 * 60_000
export const CHECK_EVERY_MS = 5 * 60_000
export const CHECK_ON_FOCUS_AFTER_MS = 30_000
/** How often the component asks whether a check is due. */
export const WATCH_TICK_MS = 60_000

/** "unknown" is a failure that says nothing about the session (offline, a timeout). */
export type SessionCheck = "ok" | "signed-out" | "unknown"

export interface SessionWatchDeps {
  now: () => number
  touch: () => void
  check: () => Promise<SessionCheck>
  onSignedOut: () => void
}

export interface SessionWatch {
  /** The app has loaded with a session: touch now; the proxy has just checked it. */
  start: () => void
  /** The person came back to the tab. */
  focus: () => void
  /** The interval fired while the tab is in front. */
  tick: () => void
  dispose: () => void
}

export function createSessionWatch(deps: SessionWatchDeps): SessionWatch {
  let lastTouch = Number.NEGATIVE_INFINITY
  let lastCheck = Number.NEGATIVE_INFINITY
  let checking = false
  let stopped = false

  const touch = () => {
    lastTouch = deps.now()
    deps.touch()
  }

  const check = () => {
    if (checking || stopped) return
    checking = true
    lastCheck = deps.now()
    deps.check().then(
      (result) => {
        checking = false
        if (stopped || result !== "signed-out") return
        stopped = true
        deps.onSignedOut()
      },
      () => {
        checking = false
      }
    )
  }

  return {
    start() {
      if (stopped) return
      touch()
      lastCheck = deps.now()
    },
    focus() {
      if (stopped) return
      const at = deps.now()
      if (at - lastTouch >= TOUCH_EVERY_MS) touch()
      if (at - lastCheck >= CHECK_ON_FOCUS_AFTER_MS) check()
    },
    tick() {
      if (stopped) return
      if (deps.now() - lastCheck >= CHECK_EVERY_MS) check()
    },
    dispose() {
      stopped = true
    },
  }
}
