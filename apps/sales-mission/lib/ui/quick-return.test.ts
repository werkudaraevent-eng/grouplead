import { describe, expect, it } from "vitest"
import { QUICK_RETURN_TOLERANCE, isQuickReturnStuck, nextQuickReturn, quickReturnStart, type QuickReturnFrame, type QuickReturnState } from "./quick-return"

// A block 150px tall resting at the top of a long list.
const PAGE = { max: 5000, rest: 0, height: 150, held: false }

/** Feeds a run of scroll offsets through the decision, as the frames arrive. */
function scroll(offsets: number[], from: QuickReturnState = quickReturnStart(0), page: Partial<QuickReturnFrame> = {}): QuickReturnState {
  return offsets.reduce((state, top) => nextQuickReturn(state, { ...PAGE, ...page, top }), from)
}

describe("nextQuickReturn", () => {
  it("hides once the reader scrolls down past the block's own height", () => {
    expect(scroll([40, 100, 149]).hidden).toBe(false)
    expect(scroll([40, 100, 160, 220]).hidden).toBe(true)
  })

  it("stays in place near the top, however the reader scrolls there", () => {
    const deep = scroll([200, 400, 600])
    expect(deep.hidden).toBe(true)
    expect(scroll([603, 606, 120], deep).hidden).toBe(false)
    expect(scroll([10, 60, 120, 140]).hidden).toBe(false)
  })

  it("counts from where the block rests when something sits above it", () => {
    const underTabs = { rest: 60 }
    expect(scroll([100, 180, 205], quickReturnStart(0), underTabs).hidden).toBe(false)
    expect(scroll([100, 180, 215], quickReturnStart(0), underTabs).hidden).toBe(true)
  })

  it("shows again on a scroll up of the tolerance or more", () => {
    const deep = scroll([300, 600, 900])
    expect(deep.hidden).toBe(true)
    expect(scroll([900 - QUICK_RETURN_TOLERANCE], deep).hidden).toBe(false)
    expect(scroll([897, 894, 891], deep).hidden).toBe(false)
  })

  it("ignores jitter under the tolerance in either direction", () => {
    const deep = scroll([300, 600, 900])
    expect(scroll([897, 899, 896, 898], deep).hidden).toBe(true)

    const shown = scroll([900, 880], deep)
    expect(shown.hidden).toBe(false)
    expect(scroll([882, 885, 881, 886], shown).hidden).toBe(false)
  })

  it("hides again on the next scroll down past the tolerance", () => {
    const shown = scroll([300, 600, 900, 880])
    expect(shown.hidden).toBe(false)
    expect(scroll([884, 889], shown).hidden).toBe(true)
  })

  it("resets the sum when the direction turns", () => {
    const deep = scroll([300, 600, 900])
    // 5px up, 3px down, 5px up: never 8px in one direction.
    expect(scroll([895, 898, 893], deep).hidden).toBe(true)
  })

  it("stays shown while the block holds the reader", () => {
    const held = { held: true }
    expect(scroll([300, 600, 900], quickReturnStart(0), held).hidden).toBe(false)

    const deep = scroll([300, 600, 900])
    const typing = scroll([950], deep, held)
    expect(typing.hidden).toBe(false)
    // Let go, it takes a fresh scroll down past the tolerance to hide it.
    expect(scroll([953], typing).hidden).toBe(false)
    expect(scroll([953, 960], typing).hidden).toBe(true)
  })

  it("changes nothing on a frame that did not move", () => {
    const deep = scroll([300, 600, 900])
    expect(scroll([900, 900], deep).hidden).toBe(true)
    const shown = scroll([880], deep)
    expect(scroll([880, 880], shown).hidden).toBe(false)
  })

  it("does not come back on the bounce past the last card", () => {
    const bottom = scroll([300, 600, 900, 1000], quickReturnStart(0), { max: 1000 })
    expect(bottom.hidden).toBe(true)
    expect(scroll([1040, 1000], bottom, { max: 1000 }).hidden).toBe(true)
  })

  it("is shown in the bounce past the top", () => {
    const deep = scroll([300, 600, 900])
    expect(scroll([-30], deep).hidden).toBe(false)
  })

  it("opens shown on a restored scroll deep in the list", () => {
    const restored = quickReturnStart(2400)
    expect(restored.hidden).toBe(false)
    expect(scroll([2403], restored).hidden).toBe(false)
    expect(scroll([2410], restored).hidden).toBe(true)
  })
})

describe("isQuickReturnStuck", () => {
  it("is stuck only once the page has scrolled past the block's resting place", () => {
    expect(isQuickReturnStuck(0, 0)).toBe(false)
    expect(isQuickReturnStuck(1, 0)).toBe(true)
    expect(isQuickReturnStuck(40, 60)).toBe(false)
    expect(isQuickReturnStuck(61, 60)).toBe(true)
  })
})
