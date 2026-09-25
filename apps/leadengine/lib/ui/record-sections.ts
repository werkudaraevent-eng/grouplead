/**
 * A record page's Overview is one scroll of sections under a pinned header
 * and tab row (Zoho CRM's record page: the related-list rail beside the
 * sections, each rail item a jump to its section, the one in view marked).
 * These are the sums behind that: where to scroll the page's own scroller
 * so a section's top lands just under what is pinned, and which section a
 * reader is in.
 *
 * The page scrolls in the shell's `<main>`, never through
 * `Element.scrollIntoView`, which asks every ancestor to scroll and slides
 * the whole shell.
 */

/** The breathing room left between the pinned bars and a section's top. */
export const SECTION_GAP_PX = 16

/**
 * The `scrollTop` that puts a section's top `gap` below the pinned bars.
 * `sectionTop` and `scrollerTop` are viewport coordinates (from
 * `getBoundingClientRect`), `scrollTop` the scroller's current offset.
 * Never below 0, and never past `maxScrollTop` when given, so the target is
 * one the scroller can reach.
 */
export function sectionScrollTop({
    scrollTop,
    sectionTop,
    scrollerTop,
    pinned,
    gap = SECTION_GAP_PX,
    maxScrollTop,
}: {
    scrollTop: number
    sectionTop: number
    scrollerTop: number
    pinned: number
    gap?: number
    maxScrollTop?: number
}): number {
    const target = Math.round(scrollTop + (sectionTop - scrollerTop) - pinned - gap)
    const ceiling = maxScrollTop === undefined ? Number.POSITIVE_INFINITY : Math.max(0, maxScrollTop)
    return Math.min(Math.max(0, target), ceiling)
}

/**
 * The band an IntersectionObserver watches, as a `rootMargin`: from just
 * under the pinned bars (`pinned + gap`) down to `bandShare` of the
 * scroller's height. The section crossing that band is the one being read.
 * The band is at least 1px tall, however short the window.
 */
export function spyRootMargin(pinned: number, rootHeight: number, gap = SECTION_GAP_PX, bandShare = 0.4): string {
    const top = Math.max(0, Math.round(pinned + gap))
    const bandBottom = Math.max(top + 1, Math.round(rootHeight * bandShare))
    const bottom = Math.max(0, Math.round(rootHeight) - bandBottom)
    const inset = (px: number) => (px === 0 ? "0px" : `-${px}px`)
    return `${inset(top)} 0px ${inset(bottom)} 0px`
}

/**
 * Which section is being read: at the end of the page, the last one (a
 * short last section never reaches the band, and the reader who scrolled
 * to the end is reading it); otherwise the first section, in page order,
 * that crosses the band; `null` when none does (the band sits in the gap
 * between two sections), so the caller keeps the one it had.
 */
export function pickActiveSection(order: readonly string[], inBand: ReadonlySet<string>, atEnd: boolean): string | null {
    if (order.length === 0) return null
    if (atEnd) return order[order.length - 1]
    for (const id of order) if (inBand.has(id)) return id
    return null
}
