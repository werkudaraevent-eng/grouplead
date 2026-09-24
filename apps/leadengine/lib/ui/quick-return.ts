/**
 * Quick return (M3 top app bar, "enter always"; Gmail, Google Contacts): a
 * block of controls that scrolls away as the reader reads down and comes
 * back, pinned under the top app bar, the moment they scroll up.
 *
 * This is the decision alone, with no DOM, so it can be tested.
 * `useQuickReturn` (`hooks/use-quick-return.ts`) measures the page once per
 * frame while it scrolls and feeds each reading through `nextQuickReturn`.
 *
 * The rules, in order:
 *   1. Held (focus inside the block, or a sheet or menu opened from it still
 *      open): shown, and the travel starts again from nothing.
 *   2. Near the top, while the block's own place is less than its height
 *      above the scroller's edge: shown. It sits in its place, or pinned
 *      for the few pixels before it would have left the view anyway.
 *   3. Otherwise it follows the direction of travel, once the travel in
 *      that direction reaches `QUICK_RETURN_JITTER`: down hides, up shows.
 *      A smaller wobble (a resting finger, momentum settling) changes
 *      nothing. Travel adds up across readings and starts again whenever
 *      the direction turns.
 *
 * `stuck` says whether the block is at its pinned place rather than its own
 * place in the page: the page draws the hairline under it only then, and
 * only while it is shown.
 */

/** Travel in one direction, in px, before the block changes state. */
export const QUICK_RETURN_JITTER = 8

export interface QuickReturnState {
    /** Slid up out of view. */
    hidden: boolean
    /** Pinned under the top app bar, with the page passing under it, rather than in its own place. */
    stuck: boolean
    /** The scroller's offset at the last reading, clamped to its range. */
    y: number
    /** Distance travelled in the current direction: positive down, negative up. */
    travel: number
}

export interface QuickReturnReading {
    /** The scroller's `scrollTop`. */
    y: number
    /** Its largest `scrollTop` (`scrollHeight - clientHeight`); beyond it, or under 0, is overscroll bounce. */
    max: number
    /** How far the block's own place in the page is above the scroller's top edge: 0 or less while it is there. */
    past: number
    /** The block's height. */
    height: number
    /** Focus is inside the block, or a sheet or menu opened from it is open. */
    held: boolean
}

/** At the top of the page: in its place, shown, nothing travelled. */
export const QUICK_RETURN_REST: QuickReturnState = { hidden: false, stuck: false, y: 0, travel: 0 }

/** The state after one reading. Returns `prev` itself when nothing changed. */
export function nextQuickReturn(prev: QuickReturnState, reading: QuickReturnReading): QuickReturnState {
    // An overscroll bounce (iOS rubber-banding at either end) is not travel.
    const y = Math.min(Math.max(reading.y, 0), Math.max(reading.max, 0))
    const delta = y - prev.y
    const travel = reading.held
        ? 0
        : delta === 0
            ? prev.travel
            : Math.sign(delta) === Math.sign(prev.travel)
                ? prev.travel + delta
                : delta
    const stuck = reading.past > 0

    let hidden: boolean
    if (reading.held || reading.past < reading.height) hidden = false
    else if (travel >= QUICK_RETURN_JITTER) hidden = true
    else if (travel <= -QUICK_RETURN_JITTER) hidden = false
    else hidden = prev.hidden

    if (hidden === prev.hidden && stuck === prev.stuck && y === prev.y && travel === prev.travel) return prev
    return { hidden, stuck, y, travel }
}
