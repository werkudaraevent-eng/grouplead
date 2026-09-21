"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

/**
 * A list on a wall that nobody can scroll.
 *
 * Airport boards do not paginate; when there is more than fits, the board
 * moves on its own and comes back to the top. This box shows its content
 * continuously and, only when the content is taller than the box, turns a
 * page every few seconds: the next page starts at the first row the current
 * one cut off, so a row is never shown in two halves and nothing is skipped
 * (a FIDS turns whole rows, never half a flight). A page that holds what is
 * happening now stays twice as long, because that is the page a passer-by
 * came to read. No page counter: a faint fade at the bottom edge says there
 * is more. With reduced motion it jumps instead of gliding. The position
 * survives the page's minute reload.
 */
export function AutoScroll({
  id,
  children,
  className,
  intervalMs = 10_000,
  dwellSelector = "[data-board-now]",
}: {
  id: string
  children: React.ReactNode
  className?: string
  intervalMs?: number
  /** Rows the board should linger on; a page containing one waits twice the interval. */
  dwellSelector?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [overflowing, setOverflowing] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const key = `board-scroll:${id}`
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const measure = () => setOverflowing(node.scrollHeight > node.clientHeight + 4)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)

    /** The rows: the list items of the list inside the box (its decorative rail is not a row). */
    const rows = (): HTMLElement[] => {
      const list = node.firstElementChild
      return list ? (Array.from(list.children).filter((child) => child.tagName === "LI") as HTMLElement[]) : []
    }
    /** Where the page after the one starting at `top` begins: the first row the current page cuts off. */
    const nextPageTop = (top: number): number | null => {
      const bottom = top + node.clientHeight
      const cut = rows().find((row) => row.offsetTop + row.offsetHeight > bottom + 2 && row.offsetTop > top)
      if (!cut) return null
      return Math.min(cut.offsetTop, node.scrollHeight - node.clientHeight)
    }
    const pageHoldsNow = (top: number): boolean => {
      const bottom = top + node.clientHeight
      return rows().some((row) => row.matches(dwellSelector) && row.offsetTop >= top - 2 && row.offsetTop + row.offsetHeight <= bottom + 2)
    }

    try {
      const saved = Number(window.sessionStorage.getItem(key) ?? "0")
      if (saved > 0) node.scrollTo({ top: saved, behavior: "auto" })
    } catch {
      // Storage may be unavailable; start from the top.
    }

    let timer: number | null = null
    const schedule = () => {
      const wait = pageHoldsNow(node.scrollTop) ? intervalMs * 2 : intervalMs
      timer = window.setTimeout(() => {
        if (node.scrollHeight > node.clientHeight + 4) {
          const top = nextPageTop(node.scrollTop) ?? 0
          node.scrollTo({ top, behavior: reduced ? "auto" : "smooth" })
          try {
            window.sessionStorage.setItem(key, String(top))
          } catch {
            // Ignore.
          }
        }
        schedule()
      }, wait)
    }
    schedule()

    return () => {
      observer.disconnect()
      if (timer) window.clearTimeout(timer)
    }
  }, [id, intervalMs, dwellSelector])

  return (
    <div className="relative h-full min-h-0">
      <div ref={ref} className={cn("h-full overflow-hidden", className)}>
        {children}
      </div>
      {overflowing && <div aria-hidden="true" className="board-fade-bottom pointer-events-none absolute inset-x-0 bottom-0 h-[3.5em]" />}
    </div>
  )
}
