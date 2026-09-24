/**
 * Scroll something into view without moving anything but the page's own panel.
 *
 * `Element.scrollIntoView` walks the whole ancestor chain and scrolls every
 * scrollable box it finds on the way. In this shell that is one box too many.
 * The workspace's `main` sits above the page's scroller and contains the page
 * header, so a jump from inside a form slid the entire page up: the title was
 * clipped off the top and a strip of bare background appeared under the last
 * card, which reads as the screen having broken rather than having moved.
 *
 * The window and the shell are already clipped against exactly this (see the
 * `.app-shell` rules in globals.css and the comment in workspace-shell). This
 * closes the one remaining gap by scrolling the panel itself and nothing else,
 * so a jump can only ever move the region the person is reading.
 *
 * Focus is moved with `preventScroll`, for the same reason: focusing an element
 * is itself a scroll request to every ancestor.
 */

/** The workspace's scrolling region, rendered once by `WorkspacePage`. */
const PANEL_ID = "page-scroll"

/** The page's own scroller around `element`, or null outside the workspace shell. */
export function panelOf(element: Element): HTMLElement | null {
  return element.closest<HTMLElement>(`#${PANEL_ID}`)
}

function behaviorNow(): ScrollBehavior {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
}

/**
 * Bring `element` into view inside its panel.
 *
 * `center` puts it in the middle of the panel, which is what a jump to a field
 * wants; `start` puts its top at the top, which is what a jump to a section
 * heading wants. Outside a panel it falls back to the browser's own behaviour,
 * so this is safe on a page that is not inside the workspace shell.
 */
export function scrollInPanel(element: Element, block: "center" | "start" = "center"): void {
  const behavior = behaviorNow()
  const panel = panelOf(element)
  if (!panel) {
    element.scrollIntoView({ block, behavior })
    return
  }
  const box = element.getBoundingClientRect()
  const frame = panel.getBoundingClientRect()
  const offset = block === "center" ? (panel.clientHeight - box.height) / 2 : 0
  const top = panel.scrollTop + box.top - frame.top - offset
  panel.scrollTo({ top: Math.max(0, top), behavior })
}

/**
 * Jump to a field and put the cursor in it.
 *
 * Most ids sit on a field wrapper, so the control is inside; a few ids are the
 * control itself, which has nothing inside to focus. `selector` widens what
 * counts as the control where a form's answer is a button rather than an input.
 */
export function jumpToField(id: string, selector = "input, textarea, select"): void {
  const element = document.getElementById(id)
  if (!element) return
  scrollInPanel(element, "center")
  const control = element.querySelector<HTMLElement>(selector) ?? (element.matches(selector) ? element : null)
  control?.focus({ preventScroll: true })
}
