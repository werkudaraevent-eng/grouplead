/**
 * Edge fades for a row that scrolls sideways (the stage tabs on a phone, a
 * row of applied-filter chips): each edge fades while the row can still
 * scroll that way, so a tab or chip cut by the edge reads as "more this
 * way" rather than as a layout fault (M3 carousel and scrollable tabs; Sales
 * Activity's `.chip-scroll`, which fades the right edge only). The left
 * fade shows once the row has left its start, the right one until its end
 * is reached, and neither when everything fits.
 *
 * The row carries the `edge-fade` class (`app/globals.css`), which draws
 * the mask from two data attributes this module sets: `data-fade-left` and
 * `data-fade-right`. `attachEdgeFade` keeps them true to the row's scroll
 * position and size; `useEdgeFade` (`hooks/use-edge-fade.ts`) attaches it
 * from a ref.
 */

/** Each fade's width: 2.5rem at the root's 16px, as in `.edge-fade`. */
export const EDGE_FADE_PX = 40

/** A sub-pixel scroll offset (zoom, fractional widths) is not a scroll. */
const TOLERANCE = 1

export interface EdgeFadeReading {
    scrollLeft: number
    scrollWidth: number
    clientWidth: number
}

/** Which edges should fade: the left once scrolled away from the start, the right while more lies beyond it. */
export function edgeFadeState({ scrollLeft, scrollWidth, clientWidth }: EdgeFadeReading): { left: boolean; right: boolean } {
    const max = scrollWidth - clientWidth
    if (max <= TOLERANCE) return { left: false, right: false }
    return {
        left: scrollLeft > TOLERANCE,
        right: scrollLeft < max - TOLERANCE,
    }
}

/**
 * Keeps `data-fade-left` / `data-fade-right` on `row` true to its scroll
 * position, at most once a frame: on scroll, when the row or anything in it
 * changes size (a chip added, a count that grew), and when its children
 * change. A row whose `overflow-x` does not scroll at the moment (a row
 * that wraps on a desk) gets neither. Returns the function that stops it
 * and takes the attributes off.
 */
export function attachEdgeFade(row: HTMLElement): () => void {
    let frame = 0
    const update = () => {
        frame = 0
        // A row that does not scroll here (a desk's wrapping chip row) never fades.
        const scrolls = /auto|scroll/.test(getComputedStyle(row).overflowX)
        const { left, right } = scrolls ? edgeFadeState(row) : { left: false, right: false }
        row.toggleAttribute("data-fade-left", left)
        row.toggleAttribute("data-fade-right", right)
    }
    const schedule = () => {
        if (!frame) frame = requestAnimationFrame(update)
    }

    const resize = new ResizeObserver(schedule)
    const observeChildren = () => {
        resize.observe(row)
        for (const child of Array.from(row.children)) resize.observe(child)
    }
    const mutation = new MutationObserver(() => {
        observeChildren()
        schedule()
    })

    update()
    observeChildren()
    mutation.observe(row, { childList: true, subtree: true, characterData: true })
    row.addEventListener("scroll", schedule, { passive: true })

    return () => {
        if (frame) cancelAnimationFrame(frame)
        row.removeEventListener("scroll", schedule)
        resize.disconnect()
        mutation.disconnect()
        row.removeAttribute("data-fade-left")
        row.removeAttribute("data-fade-right")
    }
}
