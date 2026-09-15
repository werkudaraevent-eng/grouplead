"use client"

import { useEffect, useRef, useState } from "react"

/**
 * A list that fits its box and turns pages by itself.
 *
 * A wall display has nobody to scroll it, so a list longer than the panel
 * used to clip or spill into the rows below. This measures the panel, fills
 * it with as many rows as fit (each row declares its height, so a day
 * subheader and a visit row can share one list), and when there is more it
 * cycles through pages on a timer with a page indicator and a progress bar,
 * the way kiosk dashboards do. The page survives the board's periodic
 * reload, so a long list is not stuck on its first page forever.
 */

export interface FitItem {
  key: string
  /** Rendered height in px; the row must render at exactly this height. */
  height: number
  node: React.ReactNode
}

const INDICATOR_HEIGHT = 36

export function FitList({ id, items, intervalMs = 8000 }: { id: string; items: FitItem[]; intervalMs?: number }) {
  const box = useRef<HTMLDivElement>(null)
  const [available, setAvailable] = useState<number | null>(null)
  const [page, setPage] = useState(0)

  useEffect(() => {
    const node = box.current
    if (!node) return
    const measure = () => setAvailable(node.clientHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  // Pages, greedy by height. One row always fits, so a too-small box shows
  // one row rather than nothing.
  const pages: FitItem[][] = []
  if (available !== null) {
    let current: FitItem[] = []
    let used = 0
    const limitFor = (multi: boolean) => available - (multi ? INDICATOR_HEIGHT : 0)
    // First pass assumes an indicator; if everything fits without one, redo without it.
    const paginate = (limit: number) => {
      pages.length = 0
      current = []
      used = 0
      for (const item of items) {
        if (current.length > 0 && used + item.height > limit) {
          pages.push(current)
          current = []
          used = 0
        }
        current.push(item)
        used += item.height
      }
      if (current.length > 0) pages.push(current)
    }
    paginate(limitFor(true))
    if (pages.length <= 1) paginate(limitFor(false))
  }
  const total = Math.max(1, pages.length)
  const shown = Math.min(page, total - 1)

  // Resume where the last reload left off, then advance on the timer.
  useEffect(() => {
    if (total <= 1) return
    const stored = Number(window.sessionStorage.getItem(`board-page:${id}`) ?? "0")
    const start = Number.isFinite(stored) ? ((stored % total) + total) % total : 0
    setPage(start)
    const timer = window.setInterval(() => {
      setPage((value) => {
        const next = (value + 1) % total
        window.sessionStorage.setItem(`board-page:${id}`, String(next))
        return next
      })
    }, intervalMs)
    return () => window.clearInterval(timer)
  }, [id, total, intervalMs])

  return (
    <div ref={box} className="relative h-full min-h-0 overflow-hidden">
      {available !== null && (
        <ul key={shown} className="board-page">
          {(pages[shown] ?? []).map((item) => (
            <li key={item.key} style={{ height: item.height }} className="overflow-hidden">
              {item.node}
            </li>
          ))}
        </ul>
      )}
      {total > 1 && (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-4 px-6" style={{ height: INDICATOR_HEIGHT }}>
          <span className="text-sm text-[var(--board-text-dim)]" aria-live="polite">
            Halaman {shown + 1} dari {total}
          </span>
          <span className="flex items-center gap-1.5" aria-hidden="true">
            {Array.from({ length: total }, (_, index) => (
              <span key={index} className={index === shown ? "h-1.5 w-5 rounded-full bg-[var(--board-accent)]" : "h-1.5 w-1.5 rounded-full bg-[var(--board-line)]"} />
            ))}
          </span>
          <span className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-[var(--board-line)]">
            <span key={shown} className="board-progress block h-full bg-[var(--board-accent)]" style={{ animationDuration: `${intervalMs}ms` }} />
          </span>
        </div>
      )}
    </div>
  )
}
