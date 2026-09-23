import { describe, expect, it } from "vitest"
import {
  collapseVisits,
  createUsageBeacon,
  USAGE_HEARTBEAT_MS,
  USAGE_MAX_PENDING,
  USAGE_MIN_INTERVAL_MS,
  type UsageVisit,
} from "./usage-beacon"
import { usageVisitsSchema } from "./usage-schema"

/** A beacon on a hand-driven clock with hand-driven timers. */
function harness() {
  let now = 0
  let visible = true
  const sent: UsageVisit[][] = []
  const timers: Array<{ at: number; run: () => void; cleared: boolean }> = []
  const beacon = createUsageBeacon({
    send: (visits) => sent.push(visits),
    now: () => now,
    isVisible: () => visible,
    setTimer: (run, ms) => {
      const timer = { at: now + ms, run, cleared: false }
      timers.push(timer)
      return timer
    },
    clearTimer: (handle) => {
      ;(handle as { cleared: boolean }).cleared = true
    },
  })
  const advance = (ms: number) => {
    now += ms
    for (const timer of timers) {
      if (!timer.cleared && timer.at <= now) {
        timer.cleared = true
        timer.run()
      }
    }
  }
  return {
    beacon,
    sent,
    advance,
    setVisible: (value: boolean) => {
      visible = value
    },
    pendingTimers: () => timers.filter((timer) => !timer.cleared).length,
  }
}

describe("collapseVisits", () => {
  it("counts each path once, in the order of its last open", () => {
    expect(collapseVisits(["/", "/leads", "/"])).toEqual([
      { path: "/leads", views: 1 },
      { path: "/", views: 2 },
    ])
  })
  it("is empty for nothing", () => {
    expect(collapseVisits([])).toEqual([])
  })
})

describe("createUsageBeacon", () => {
  it("sends the first page at once", () => {
    const h = harness()
    h.beacon.visit("/")
    expect(h.sent).toEqual([[{ path: "/", views: 1 }]])
  })

  it("calls the server at most once per 30 seconds and loses no page opened in between", () => {
    const h = harness()
    h.beacon.visit("/")
    h.advance(5_000)
    h.beacon.visit("/leads")
    h.advance(5_000)
    h.beacon.visit("/leads/:id")
    expect(h.sent).toHaveLength(1)
    expect(h.pendingTimers()).toBe(1)
    h.advance(USAGE_MIN_INTERVAL_MS - 10_000 - 1)
    expect(h.sent).toHaveLength(1)
    h.advance(1)
    expect(h.sent).toHaveLength(2)
    expect(h.sent[1]).toEqual([
      { path: "/leads", views: 1 },
      { path: "/leads/:id", views: 1 },
    ])
  })

  it("sends a page opened after the window has passed straight away", () => {
    const h = harness()
    h.beacon.visit("/")
    h.advance(USAGE_MIN_INTERVAL_MS)
    h.beacon.visit("/contacts")
    expect(h.sent).toHaveLength(2)
  })

  it("holds pages while the tab is hidden and sends them when it is back", () => {
    const h = harness()
    h.setVisible(false)
    h.beacon.visit("/")
    h.advance(60_000)
    expect(h.sent).toHaveLength(0)
    h.setVisible(true)
    h.beacon.tick()
    expect(h.sent).toEqual([[{ path: "/", views: 1 }]])
  })

  it("sends a heartbeat after five minutes on one page, only if the person did something", () => {
    const h = harness()
    h.beacon.visit("/leads")
    h.advance(USAGE_HEARTBEAT_MS)
    h.beacon.tick()
    // Nobody touched the page: a tab left open on an empty desk is not "seen".
    expect(h.sent).toHaveLength(1)
    h.beacon.interact()
    h.beacon.tick()
    expect(h.sent[1]).toEqual([{ path: "/leads", views: 0 }])
  })

  it("does not send a heartbeat before five minutes", () => {
    const h = harness()
    h.beacon.visit("/")
    h.advance(60_000)
    h.beacon.interact()
    h.advance(USAGE_HEARTBEAT_MS - 60_001)
    h.beacon.tick()
    expect(h.sent).toHaveLength(1)
  })

  it("sends nothing while hidden, heartbeat included", () => {
    const h = harness()
    h.beacon.visit("/")
    h.beacon.interact()
    h.advance(USAGE_HEARTBEAT_MS * 2)
    h.setVisible(false)
    h.beacon.tick()
    expect(h.sent).toHaveLength(1)
  })

  it("keeps a runaway burst bounded", () => {
    const h = harness()
    h.beacon.visit("/")
    for (let index = 0; index < USAGE_MAX_PENDING + 20; index += 1) h.beacon.visit("/leads")
    h.advance(USAGE_MIN_INTERVAL_MS)
    const views = h.sent[1].reduce((sum, visit) => sum + visit.views, 0)
    expect(views).toBe(USAGE_MAX_PENDING)
    expect(usageVisitsSchema.safeParse(h.sent[1]).success).toBe(true)
  })

  it("stops its timer when disposed", () => {
    const h = harness()
    h.beacon.visit("/")
    h.beacon.visit("/leads")
    expect(h.pendingTimers()).toBe(1)
    h.beacon.dispose()
    expect(h.pendingTimers()).toBe(0)
  })
})

describe("usageVisitsSchema", () => {
  it("accepts opens and a heartbeat inside the app", () => {
    expect(usageVisitsSchema.safeParse([{ path: "/", views: 1 }]).success).toBe(true)
    expect(usageVisitsSchema.safeParse([{ path: "/leads/:id", views: 0 }]).success).toBe(true)
  })
  it("refuses the API, the login screen, other sites, long paths, odd counts and empty batches", () => {
    expect(usageVisitsSchema.safeParse([{ path: "/login", views: 1 }]).success).toBe(false)
    expect(usageVisitsSchema.safeParse([{ path: "/api/v1/leads", views: 1 }]).success).toBe(false)
    expect(usageVisitsSchema.safeParse([{ path: "https://example.com/leads", views: 1 }]).success).toBe(false)
    expect(usageVisitsSchema.safeParse([{ path: `/${"a".repeat(200)}`, views: 1 }]).success).toBe(false)
    expect(usageVisitsSchema.safeParse([{ path: "/", views: -1 }]).success).toBe(false)
    expect(usageVisitsSchema.safeParse([{ path: "/", views: 1.5 }]).success).toBe(false)
    expect(usageVisitsSchema.safeParse([{ path: "/", views: USAGE_MAX_PENDING + 1 }]).success).toBe(false)
    expect(usageVisitsSchema.safeParse([]).success).toBe(false)
  })
})
