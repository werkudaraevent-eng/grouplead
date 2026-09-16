"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

/**
 * A list on a wall that nobody can scroll.
 *
 * Airport boards do not paginate; when there is more than fits, the board
 * moves on its own, slowly, and comes back to the top. This box shows its
 * content continuously and, only when the content is taller than the box,
 * scrolls one screen (less a row, so nothing is skipped) every few seconds,
 * then returns to the top. No page counter, no progress bar: a faint fade
 * at the bottom edge says there is more. With reduced motion it jumps
 * instead of gliding. The position survives the page's minute reload.
 */
export function AutoScroll({
  id,
  children,
  className,
  intervalMs = 10_000,
}: {
  id: string
  children: React.ReactNode
  className?: string
  intervalMs?: number
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

    try {
      const saved = Number(window.sessionStorage.getItem(key) ?? "0")
      if (saved > 0) node.scrollTo({ top: saved, behavior: "auto" })
    } catch {
      // Storage may be unavailable; start from the top.
    }

    const timer = window.setInterval(() => {
      if (node.scrollHeight <= node.clientHeight + 4) return
      const atEnd = node.scrollTop + node.clientHeight >= node.scrollHeight - 4
      const step = Math.max(node.clientHeight * 0.85, 40)
      const top = atEnd ? 0 : Math.min(node.scrollTop + step, node.scrollHeight - node.clientHeight)
      node.scrollTo({ top, behavior: reduced ? "auto" : "smooth" })
      try {
        window.sessionStorage.setItem(key, String(top))
      } catch {
        // Ignore.
      }
    }, intervalMs)

    return () => {
      observer.disconnect()
      window.clearInterval(timer)
    }
  }, [id, intervalMs])

  return (
    <div className="relative h-full min-h-0">
      <div ref={ref} className={cn("h-full overflow-hidden", className)}>
        {children}
      </div>
      {overflowing && <div aria-hidden="true" className="board-fade-bottom pointer-events-none absolute inset-x-0 bottom-0 h-[3em]" />}
    </div>
  )
}
