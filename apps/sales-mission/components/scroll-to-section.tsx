"use client"

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"

/**
 * Scroll the shell's own panel to a section named in the URL (?fokus=id).
 *
 * Not a fragment (#id): a fragment jump asks the browser to scroll every
 * scrollable ancestor, the viewport included, and the viewport cannot be
 * made unscrollable by CSS (overflow: clip on the root is read as hidden,
 * which still scrolls programmatically). So the whole shell slid up and
 * left a blank strip below it. This moves the panel that owns scrolling,
 * by exactly the distance to the section, and pins the window at the top.
 */
export function ScrollToSection({ panelId = "main-content", offset = 16 }: { panelId?: string; offset?: number }) {
  const params = useSearchParams()
  const target = params.get("fokus")

  useEffect(() => {
    if (!target) return
    const section = document.getElementById(target)
    const panel = document.getElementById(panelId)
    if (!section || !panel) return
    const frame = requestAnimationFrame(() => {
      const delta = section.getBoundingClientRect().top - panel.getBoundingClientRect().top - offset
      panel.scrollTo({ top: panel.scrollTop + delta, behavior: "instant" as ScrollBehavior })
      window.scrollTo(0, 0)
      section.setAttribute("tabindex", "-1")
      section.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [target, panelId, offset])

  return null
}
