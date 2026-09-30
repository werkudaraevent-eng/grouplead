"use client"

import { useEffect, useRef } from "react"
import { EDITABLE_SELECTOR, OVERLAY_SELECTOR, isSidebarShortcut } from "@/lib/ui/sidebar-shortcut"

/** Tailwind's `lg`, where the drawer is drawn; below it there is no drawer to fold. */
const FROM_LG = "(min-width: 1024px)"

/**
 * `[` folds the drawer to the rail and opens it again (see
 * lib/ui/sidebar-shortcut.ts for when the key is left alone). Twin of Sales
 * Activity's hooks/use-sidebar-shortcut.ts.
 */
export function useSidebarShortcut(onToggle: () => void) {
  const latest = useRef(onToggle)
  useEffect(() => {
    latest.current = onToggle
  })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!window.matchMedia(FROM_LG).matches) return
      const element = event.target instanceof Element ? event.target : null
      const target = {
        editable: Boolean(element?.closest(EDITABLE_SELECTOR)) || (element instanceof HTMLElement && element.isContentEditable),
        inOverlay: Boolean(element?.closest(OVERLAY_SELECTOR)),
      }
      const keyEvent = {
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        altGraph: event.getModifierState?.("AltGraph") ?? false,
        repeat: event.repeat,
        isComposing: event.isComposing,
        defaultPrevented: event.defaultPrevented,
      }
      if (!isSidebarShortcut(keyEvent, target)) return
      event.preventDefault()
      latest.current()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])
}
