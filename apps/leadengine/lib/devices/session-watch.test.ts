import { describe, expect, it } from "vitest"
import { CHECK_EVERY_MS, CHECK_ON_FOCUS_AFTER_MS, createSessionWatch, TOUCH_EVERY_MS, type SessionCheck } from "./session-watch"

/** A watch on a hand-driven clock whose checks resolve when told to. */
function harness() {
  let now = 1_000_000
  const touches: number[] = []
  const checks: Array<(result: SessionCheck) => void> = []
  let signedOut = 0
  const watch = createSessionWatch({
    now: () => now,
    touch: () => touches.push(now),
    check: () => new Promise<SessionCheck>((resolve) => checks.push(resolve)),
    onSignedOut: () => {
      signedOut += 1
    },
  })
  return {
    watch,
    touches,
    checks,
    advance: (ms: number) => {
      now += ms
    },
    signedOut: () => signedOut,
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe("createSessionWatch", () => {
  it("touches on load and does not check, the proxy just did", () => {
    const h = harness()
    h.watch.start()
    expect(h.touches).toHaveLength(1)
    expect(h.checks).toHaveLength(0)
  })

  it("touches again on focus only after five minutes", () => {
    const h = harness()
    h.watch.start()
    h.advance(TOUCH_EVERY_MS - 1)
    h.watch.focus()
    expect(h.touches).toHaveLength(1)
    h.advance(1)
    h.watch.focus()
    expect(h.touches).toHaveLength(2)
  })

  it("checks on focus, at most every 30 seconds, one at a time", async () => {
    const h = harness()
    h.watch.start()
    h.advance(CHECK_ON_FOCUS_AFTER_MS - 1)
    h.watch.focus()
    expect(h.checks).toHaveLength(0)
    h.advance(1)
    h.watch.focus()
    expect(h.checks).toHaveLength(1)
    // Still waiting on the first answer: no second request.
    h.advance(CHECK_ON_FOCUS_AFTER_MS)
    h.watch.focus()
    expect(h.checks).toHaveLength(1)
    h.checks[0]("ok")
    await flush()
    h.watch.focus()
    expect(h.checks).toHaveLength(2)
  })

  it("checks every five minutes on the interval", () => {
    const h = harness()
    h.watch.start()
    h.advance(CHECK_EVERY_MS - 1)
    h.watch.tick()
    expect(h.checks).toHaveLength(0)
    h.advance(1)
    h.watch.tick()
    expect(h.checks).toHaveLength(1)
  })

  it("hands over once when the session is gone, then stops", async () => {
    const h = harness()
    h.watch.start()
    h.advance(CHECK_EVERY_MS)
    h.watch.tick()
    h.checks[0]("signed-out")
    await flush()
    expect(h.signedOut()).toBe(1)
    h.advance(CHECK_EVERY_MS * 2)
    h.watch.tick()
    h.watch.focus()
    expect(h.checks).toHaveLength(1)
    expect(h.touches).toHaveLength(1)
    expect(h.signedOut()).toBe(1)
  })

  it("keeps going after an answer that says nothing, or a failed check", async () => {
    const h = harness()
    h.watch.start()
    h.advance(CHECK_EVERY_MS)
    h.watch.tick()
    h.checks[0]("unknown")
    await flush()
    h.advance(CHECK_EVERY_MS)
    h.watch.tick()
    expect(h.checks).toHaveLength(2)
    expect(h.signedOut()).toBe(0)
  })

  it("does nothing once disposed, even when an answer arrives late", async () => {
    const h = harness()
    h.watch.start()
    h.advance(CHECK_EVERY_MS)
    h.watch.tick()
    h.watch.dispose()
    h.checks[0]("signed-out")
    await flush()
    expect(h.signedOut()).toBe(0)
    h.advance(TOUCH_EVERY_MS)
    h.watch.focus()
    expect(h.touches).toHaveLength(1)
  })
})
