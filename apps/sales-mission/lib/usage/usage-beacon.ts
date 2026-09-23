/**
 * When the browser tells the server "this person is here", as rules that
 * run without a DOM so they can be tested.
 *
 * - Every page opened is counted, but the server is called at most once
 *   per 30 seconds: pages opened inside that window wait and go together
 *   in the next call, so a quick list → detail → report is three opens in
 *   one request, not three requests or one lost page.
 * - Nothing is sent while the tab is hidden; what waited goes when the
 *   person comes back to it.
 * - Still on the same page five minutes after the last call, and having
 *   touched it since (a tap, a key, a scroll), the beacon sends a
 *   heartbeat: "seen", no page opened. A rep who works Hari ini all
 *   morning is seen at 12:00, not only at 08:00; a tab left open on an
 *   empty desk is not.
 */

/** The fewest milliseconds between two calls to the server. */
export const USAGE_MIN_INTERVAL_MS = 30_000
/** How long on one page before a heartbeat, if the person has been active. */
export const USAGE_HEARTBEAT_MS = 5 * 60_000
/** How often the component asks whether a heartbeat is due. */
export const USAGE_TICK_MS = 60_000
/** Opens held for one call at most; a burst beyond this is not a person reading. */
export const USAGE_MAX_PENDING = 50

/** One path and how many times it was opened; 0 is a heartbeat. */
export interface UsageVisit {
  path: string
  views: number
}

/**
 * Opens as one entry per path with its count, ordered by each path's last
 * open, so the page the person is on now is the last entry and the server
 * records it as their last page.
 */
export function collapseVisits(paths: string[]): UsageVisit[] {
  const counts = new Map<string, number>()
  for (const path of paths) {
    // Delete then set moves the path to the end: the order is last-open order.
    const count = (counts.get(path) ?? 0) + 1
    counts.delete(path)
    counts.set(path, count)
  }
  return [...counts].map(([path, views]) => ({ path, views }))
}

export interface UsageBeaconDeps {
  send: (visits: UsageVisit[]) => void
  now: () => number
  isVisible: () => boolean
  setTimer: (run: () => void, ms: number) => unknown
  clearTimer: (handle: unknown) => void
}

export interface UsageBeacon {
  /** A page was opened (already normalised). */
  visit: (path: string) => void
  /** The person touched the page: tapped, typed, scrolled, came back to the tab. */
  interact: () => void
  /** Periodic check, and on becoming visible: send what waited, or a heartbeat when due. */
  tick: () => void
  dispose: () => void
}

export function createUsageBeacon(deps: UsageBeaconDeps): UsageBeacon {
  let pending: string[] = []
  let current: string | null = null
  let lastSentAt: number | null = null
  let lastInteractionAt: number | null = null
  let timer: unknown = null

  const schedule = (ms: number) => {
    if (timer !== null) return
    timer = deps.setTimer(() => {
      timer = null
      flush()
    }, ms)
  }

  const flush = () => {
    if (pending.length === 0 || !deps.isVisible()) return
    const wait = lastSentAt === null ? 0 : lastSentAt + USAGE_MIN_INTERVAL_MS - deps.now()
    if (wait > 0) {
      schedule(wait)
      return
    }
    const visits = collapseVisits(pending)
    pending = []
    lastSentAt = deps.now()
    deps.send(visits)
  }

  return {
    visit(path) {
      current = path
      pending.push(path)
      if (pending.length > USAGE_MAX_PENDING) pending = pending.slice(-USAGE_MAX_PENDING)
      flush()
    },
    interact() {
      lastInteractionAt = deps.now()
    },
    tick() {
      if (!deps.isVisible()) return
      if (pending.length > 0) {
        flush()
        return
      }
      if (current === null || lastSentAt === null) return
      const now = deps.now()
      const active = lastInteractionAt !== null && lastInteractionAt > lastSentAt
      if (active && now - lastSentAt >= USAGE_HEARTBEAT_MS) {
        lastSentAt = now
        deps.send([{ path: current, views: 0 }])
      }
    },
    dispose() {
      if (timer !== null) deps.clearTimer(timer)
      timer = null
    },
  }
}
