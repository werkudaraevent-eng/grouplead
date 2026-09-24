/**
 * Quick return: a list's search and chips on a phone scroll away while the
 * reader reads down and come back, pinned under the top app bar, the moment
 * they scroll up (M3 top app bar, "enter always"; Gmail, Google Contacts).
 *
 * This is the decision alone, one scroll frame at a time, so it can be read
 * and tested without a browser; `useQuickReturn` in hooks/use-quick-return.ts
 * measures the page and feeds it. Distances are CSS pixels in the page
 * scroller's own coordinates (its `scrollTop`).
 *
 * - Near the top, while the block would still overlap its own resting place
 *   (`top < rest + height`), it is simply there: hiding it would open a hole
 *   exactly where it is about to be read.
 * - Further down, travel in one direction is summed, and a turn resets the
 *   sum: `tolerance` pixels down hides it, `tolerance` pixels up shows it.
 *   A finger lifting, a momentum scroll settling or a sub-pixel correction
 *   moves a pixel or two and changes nothing.
 * - While something in the block holds the reader (the search field has the
 *   cursor and the keyboard is up, a sheet or menu it opened is open), it
 *   stays, whatever the scroll does.
 * - The bounce past either end on iOS is not a scroll: the offset is clamped
 *   to the scroller's range first, so bouncing off the last card does not
 *   bring the block back.
 */

/** Pixels of travel in one direction before the block changes state. */
export const QUICK_RETURN_TOLERANCE = 8

export interface QuickReturnState {
  /** Whether the block is slid out of view. */
  hidden: boolean
  /** The scroll offset of the frame before, clamped to the scroller's range. */
  last: number
  /** Travel summed since the last turn: positive is down, negative is up. */
  travel: number
}

export interface QuickReturnFrame {
  /** The scroller's `scrollTop` now. */
  top: number
  /** The largest `scrollTop` the scroller allows (`scrollHeight - clientHeight`). */
  max: number
  /** The `scrollTop` at which the block leaves its resting place and pins. */
  rest: number
  /** The block's own height. */
  height: number
  /** Something in the block holds the reader: focus in the search, an open sheet or menu. */
  held: boolean
}

/** Shown, at whatever offset the page opened on (a restored scroll included). */
export function quickReturnStart(top: number): QuickReturnState {
  return { hidden: false, last: Math.max(0, top), travel: 0 }
}

/** The block's state after one scroll frame. */
export function nextQuickReturn(prev: QuickReturnState, frame: QuickReturnFrame, tolerance = QUICK_RETURN_TOLERANCE): QuickReturnState {
  const top = Math.min(Math.max(frame.top, 0), Math.max(frame.max, 0))
  // Scrolling while the block is held does not count towards hiding it once let go.
  if (frame.held) return { hidden: false, last: top, travel: 0 }
  const delta = top - prev.last
  if (delta === 0) return { ...prev, hidden: prev.hidden && top >= frame.rest + frame.height }
  const travel = Math.sign(delta) === Math.sign(prev.travel) ? prev.travel + delta : delta
  const next = { last: top, travel }
  if (top < frame.rest + frame.height) return { ...next, hidden: false }
  if (travel >= tolerance) return { ...next, hidden: true }
  if (travel <= -tolerance) return { ...next, hidden: false }
  return { ...next, hidden: prev.hidden }
}

/**
 * Whether the block has left its resting place and is pinned over the
 * content scrolling beneath it, which is when it draws its bottom hairline.
 */
export function isQuickReturnStuck(top: number, rest: number): boolean {
  return top > rest
}
