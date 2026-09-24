"use client"

import { useEffect, useRef, useState, type RefObject } from "react"
import { panelOf } from "@/lib/ui/scroll-in-panel"
import { isQuickReturnStuck, nextQuickReturn, quickReturnStart } from "@/lib/ui/quick-return"

/**
 * Quick return for a block pinned (`position: sticky`) at the top of the
 * page's scroller: it slides away while the reader scrolls down and comes
 * back the moment they scroll up. The decision is `nextQuickReturn` in
 * lib/ui/quick-return.ts; this measures the page for it, once per animation
 * frame, from a passive scroll listener on `#page-scroll`.
 *
 * `block` is the sticky block; `after` is the element in normal flow right
 * under it (a list's count), which says where the block rests without the
 * pin or the slide moving it. The block holds the reader, and so stays,
 * while `held` (a sheet it opened is open), while the cursor is in a field
 * inside it (the keyboard is up) or a keyboard user's focus is on one of
 * its controls, and while any control in it has its menu or sheet open
 * (`aria-expanded="true"`).
 *
 * Returns whether the block is slid away (`hidden`) and whether it has left
 * its resting place to pin over the content (`stuck`). Both stay false
 * while `enabled` is off, which is how a desk opts out.
 */
export function useQuickReturn({
  block,
  after,
  enabled,
  held,
}: {
  block: RefObject<HTMLElement | null>
  after: RefObject<HTMLElement | null>
  enabled: boolean
  held: boolean
}): { hidden: boolean; stuck: boolean } {
  const [view, setView] = useState({ hidden: false, stuck: false })
  const heldRef = useRef(held)

  useEffect(() => {
    heldRef.current = held
  }, [held])

  useEffect(() => {
    const node = block.current
    const scroller = enabled && node ? panelOf(node) : null
    if (!node || !scroller) return
    let state = quickReturnStart(scroller.scrollTop)
    let frame = 0

    const measure = () => {
      frame = 0
      const height = node.offsetHeight
      const top = scroller.scrollTop
      // Where the block rests, in the scroller's coordinates: straight above
      // the element that follows it. It pins that far down from the
      // scroller's content edge, which sits under the scroller's own padding.
      const next = after.current
      const flowTop = next ? next.getBoundingClientRect().top - scroller.getBoundingClientRect().top + top : height
      const pin = (parseFloat(getComputedStyle(scroller).paddingTop) || 0) + (parseFloat(getComputedStyle(node).top) || 0)
      const rest = flowTop - height - pin
      state = nextQuickReturn(state, {
        top,
        max: scroller.scrollHeight - scroller.clientHeight,
        rest,
        height,
        held: heldRef.current || holdsReader(node),
      })
      const hidden = state.hidden
      const stuck = isQuickReturnStuck(top, rest)
      setView((prev) => (prev.hidden === hidden && prev.stuck === stuck ? prev : { hidden, stuck }))
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }

    scroller.addEventListener("scroll", onScroll, { passive: true })
    // A page restored mid-list is pinned from its first frame.
    onScroll()
    return () => {
      scroller.removeEventListener("scroll", onScroll)
      if (frame) cancelAnimationFrame(frame)
      setView({ hidden: false, stuck: false })
    }
  }, [enabled, block, after])

  return { hidden: view.hidden && !held, stuck: view.stuck }
}

/** Whether something inside `block` has the reader's attention right now. */
function holdsReader(block: HTMLElement): boolean {
  if (block.querySelector('[aria-expanded="true"]')) return true
  const active = document.activeElement
  if (!(active instanceof HTMLElement) || !block.contains(active)) return false
  if (active.matches("input, textarea, select, [contenteditable]")) return true
  try {
    // A tapped chip keeps focus on Android without it meaning anything;
    // a keyboard user's focus ring does.
    return active.matches(":focus-visible")
  } catch {
    return false
  }
}
