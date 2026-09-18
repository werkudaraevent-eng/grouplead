"use client"

import { useRef } from "react"
import type { PointerEvent, MouseEvent } from "react"

/**
 * A long press, the way a phone enters selection mode (Gmail, Google Files,
 * Photos; Android's contextual action bar).
 *
 * Pointer events rather than touch events, so a mouse held down counts too.
 * A scroll that starts under the finger arrives as `pointercancel` and
 * clears the timer, so scrolling a list never picks a row. The click that
 * the browser fires when the finger lifts is the caller's to swallow with
 * `consumeClick`, otherwise the press would also open the row.
 */
export function useLongPress(onLongPress: () => void, { ms = 450, enabled = true }: { ms?: number; enabled?: boolean } = {}) {
  const timer = useRef<number | null>(null)
  const fired = useRef(false)

  const clear = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
  }

  const handlers = enabled
    ? {
        onPointerDown: (event: PointerEvent<HTMLElement>) => {
          if (event.pointerType === "mouse" && event.button !== 0) return
          fired.current = false
          clear()
          timer.current = window.setTimeout(() => {
            timer.current = null
            fired.current = true
            onLongPress()
          }, ms)
        },
        onPointerUp: clear,
        onPointerCancel: clear,
        onPointerLeave: clear,
        // The browser's own long-press menu (open link in new tab, copy
        // address) would otherwise open on top of the mode.
        onContextMenu: (event: MouseEvent<HTMLElement>) => event.preventDefault(),
      }
    : {}

  /** True once, right after a long press, so the click that follows can be swallowed. */
  const consumeClick = () => {
    const was = fired.current
    fired.current = false
    return was
  }

  return { handlers, consumeClick }
}
