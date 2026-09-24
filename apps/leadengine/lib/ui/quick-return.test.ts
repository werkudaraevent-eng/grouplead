import { describe, expect, it } from "vitest"
import { QUICK_RETURN_JITTER, QUICK_RETURN_REST, nextQuickReturn, type QuickReturnReading, type QuickReturnState } from "./quick-return"

/** The block's own place is 64px down the page (under the header row) and it is 100px tall. */
const TOP = 64
const HEIGHT = 100
const MAX = 5000

function reading(y: number, extra: Partial<QuickReturnReading> = {}): QuickReturnReading {
    return { y, max: MAX, past: y - TOP, height: HEIGHT, held: false, ...extra }
}

/** Feeds the offsets in order from `start`, as the hook does once per frame. */
function scroll(start: QuickReturnState, ys: number[], extra: Partial<QuickReturnReading> = {}): QuickReturnState {
    return ys.reduce((state, y) => nextQuickReturn(state, reading(y, extra)), start)
}

/** Scrolled well down the page, the block slid away. */
function hiddenAt(y: number): QuickReturnState {
    const state = scroll(QUICK_RETURN_REST, [0, y / 2, y])
    expect(state.hidden).toBe(true)
    return state
}

describe("nextQuickReturn", () => {
    it("rests in its place at the top: shown, not stuck", () => {
        const state = nextQuickReturn(QUICK_RETURN_REST, reading(0))
        expect(state).toBe(QUICK_RETURN_REST)
        expect(state.hidden).toBe(false)
        expect(state.stuck).toBe(false)
    })

    it("stays shown near the top, while its place is less than its height above the edge", () => {
        const state = scroll(QUICK_RETURN_REST, [20, 60, 100, TOP + HEIGHT - 1])
        expect(state.hidden).toBe(false)
        // Past its own place it is pinned under the top app bar.
        expect(state.stuck).toBe(true)
    })

    it("hides once scrolling down takes it past its own height", () => {
        const state = scroll(QUICK_RETURN_REST, [40, 120, TOP + HEIGHT + 2])
        expect(state.hidden).toBe(true)
        expect(state.stuck).toBe(true)
    })

    it("comes back when the reader scrolls up by the jitter distance, added up across readings", () => {
        const hidden = hiddenAt(1200)
        const halfway = scroll(hidden, [1195])
        expect(halfway.hidden).toBe(true)
        const back = scroll(halfway, [1200 - QUICK_RETURN_JITTER])
        expect(back.hidden).toBe(false)
        expect(back.stuck).toBe(true)
    })

    it("ignores a wobble smaller than the jitter distance, either way", () => {
        const hidden = hiddenAt(1200)
        expect(scroll(hidden, [1197, 1199, 1196, 1198]).hidden).toBe(true)

        const shown = scroll(hidden, [1180])
        expect(shown.hidden).toBe(false)
        expect(scroll(shown, [1183, 1181, 1185, 1182]).hidden).toBe(false)
    })

    it("starts counting again when the direction turns", () => {
        const hidden = hiddenAt(1200)
        // Up 5, down 2, up 5: never 8 in one direction.
        expect(scroll(hidden, [1195, 1197, 1192]).hidden).toBe(true)
    })

    it("hides again when a returned block is scrolled down past the jitter distance", () => {
        const shown = scroll(hiddenAt(1200), [1150])
        expect(shown.hidden).toBe(false)
        expect(scroll(shown, [1150 + QUICK_RETURN_JITTER - 1]).hidden).toBe(false)
        expect(scroll(shown, [1150 + QUICK_RETURN_JITTER]).hidden).toBe(true)
    })

    it("is shown whenever it is near the top, however it got there", () => {
        const hidden = hiddenAt(1200)
        // One jump straight back near the top, then a small step down.
        const top = scroll(hidden, [80])
        expect(top.hidden).toBe(false)
        expect(scroll(top, [90]).hidden).toBe(false)
        expect(scroll(top, [0]).stuck).toBe(false)
    })

    it("stays shown while held (focus inside, or its sheet or menu open), however far the page scrolls", () => {
        const held = scroll(QUICK_RETURN_REST, [0, 400, 900, 1500], { held: true })
        expect(held.hidden).toBe(false)
        expect(held.travel).toBe(0)
    })

    it("shows at once when it becomes held while hidden", () => {
        const hidden = hiddenAt(1200)
        expect(nextQuickReturn(hidden, reading(1200, { held: true })).hidden).toBe(false)
    })

    it("once let go, needs a fresh jitter distance down before it hides", () => {
        const held = scroll(QUICK_RETURN_REST, [0, 400, 900], { held: true })
        expect(scroll(held, [905]).hidden).toBe(false)
        expect(scroll(held, [905, 909]).hidden).toBe(true)
    })

    it("ignores an overscroll bounce at the bottom", () => {
        const hidden = hiddenAt(MAX)
        // Rubber-banding past the end and settling back is not an upward scroll.
        expect(scroll(hidden, [MAX + 40, MAX + 10, MAX]).hidden).toBe(true)
    })

    it("ignores an overscroll bounce at the top", () => {
        const state = scroll(QUICK_RETURN_REST, [-30, -5, 0])
        expect(state.hidden).toBe(false)
        expect(state.y).toBe(0)
    })

    it("returns the same state when a reading changes nothing", () => {
        const hidden = hiddenAt(1200)
        expect(nextQuickReturn(hidden, reading(1200))).toBe(hidden)
    })
})
