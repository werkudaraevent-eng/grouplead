"use client"

import { useEffect, useState, useSyncExternalStore, type RefObject } from "react"
import { QUICK_RETURN_REST, nextQuickReturn, type QuickReturnState } from "@/lib/ui/quick-return"

/** Below Tailwind's `md`: where a list is cards and its controls return on scroll up. */
const BELOW_MD = "(max-width: 767.98px)"

export interface QuickReturnView {
    /** Slid up out of view: the block should be `inert` and translated up by its height. */
    hidden: boolean
    /** Pinned under the top app bar with the page passing under it: the moment for its hairline. */
    stuck: boolean
}

const AT_REST: QuickReturnView = { hidden: false, stuck: false }

function useMedia(query: string): boolean {
    return useSyncExternalStore(
        (onChange) => {
            const list = window.matchMedia(query)
            list.addEventListener("change", onChange)
            return () => list.removeEventListener("change", onChange)
        },
        () => window.matchMedia(query).matches,
        () => false,
    )
}

/** The nearest ancestor that scrolls vertically (the shell's `<main>`), or null when the document does. */
function scrollParent(el: HTMLElement): HTMLElement | null {
    for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
        const { overflowY } = getComputedStyle(node)
        if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") return node
    }
    return null
}

/**
 * Someone is using the block: focus is in it where they can see it (typing in
 * the search, or moving through it by keyboard), or something opened from it
 * (the Filter sheet, a menu) is still open.
 *
 * Only a visible focus counts. When the Filter sheet closes, focus goes back
 * to the Filter button, and Chrome on Android focuses a button when it is
 * tapped. That focus stays until something else takes it, so counting it
 * would keep the block pinned for good after a tap. A text field's focus is
 * always visible, and so is a keyboard user's.
 */
function isHeld(block: HTMLElement): boolean {
    if (block.querySelector('[aria-expanded="true"]')) return true
    const active = document.activeElement
    if (!active || active === block || !block.contains(active)) return false
    try {
        return active.matches(":focus-visible")
    } catch {
        return true
    }
}

/**
 * Quick return for a block of controls (M3 top app bar, "enter always"): it
 * scrolls away as the reader reads down and slides back, pinned under the
 * top app bar, the moment they scroll up. The decision is `nextQuickReturn`
 * in `lib/ui/quick-return.ts`; this hook only measures.
 *
 * `block` is the element that carries `sticky top-0`; `anchor` is an empty
 * element right before it, because a pinned block's own box is where it is
 * pinned, not where it belongs in the page. One passive scroll listener on
 * the scroller, read at most once per animation frame.
 *
 * Only below `md` (`query`); elsewhere, and on the server, the block is at
 * rest: shown, not stuck.
 */
export function useQuickReturn(
    block: RefObject<HTMLElement | null>,
    anchor: RefObject<HTMLElement | null>,
    { query = BELOW_MD }: { query?: string } = {},
): QuickReturnView {
    const enabled = useMedia(query)
    const [view, setView] = useState<QuickReturnView>(AT_REST)

    useEffect(() => {
        const el = block.current
        const mark = anchor.current
        if (!enabled || !el || !mark) return

        const scroller = scrollParent(el)
        const root = scroller ?? document.scrollingElement ?? document.documentElement
        const target: HTMLElement | Window = scroller ?? window

        // A page that opens scrolled (Back to the list) opens with the block shown.
        let state: QuickReturnState = { ...QUICK_RETURN_REST, y: root.scrollTop }
        let frame = 0

        const measure = () => {
            frame = 0
            const edge = scroller ? scroller.getBoundingClientRect().top : 0
            state = nextQuickReturn(state, {
                y: root.scrollTop,
                max: root.scrollHeight - root.clientHeight,
                past: edge - mark.getBoundingClientRect().top,
                height: el.offsetHeight,
                held: isHeld(el),
            })
            const { hidden, stuck } = state
            setView((prev) => (prev.hidden === hidden && prev.stuck === stuck ? prev : { hidden, stuck }))
        }
        const onScroll = () => {
            if (!frame) frame = window.requestAnimationFrame(measure)
        }

        target.addEventListener("scroll", onScroll, { passive: true })
        onScroll()
        return () => {
            target.removeEventListener("scroll", onScroll)
            if (frame) window.cancelAnimationFrame(frame)
            // Back at rest, so a return below `md` never starts from a stale "hidden".
            setView(AT_REST)
        }
    }, [enabled, block, anchor])

    return enabled ? view : AT_REST
}
