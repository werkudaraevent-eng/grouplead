"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"

/**
 * Linear progress at the top edge while a route changes inside the app.
 * Twin of LeadEngine's components/layout/top-loader.tsx.
 *
 * Material's linear indicator for page loads: 4dp, primary, at the top of
 * the region that is loading. Indeterminate in spirit (the trickle never
 * reaches the end on its own) because a route's duration is unknown. It
 * waits 120ms before showing, so a navigation that is already done never
 * flashes a bar; and it stays out of cross-origin links, which the app
 * transit screen covers instead.
 *
 * Under reduced motion the bar appears and disappears without the trickle.
 */
export function TopLoader() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevUrl = useRef("")

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduceMotion(query.matches)
    const onChange = () => setReduceMotion(query.matches)
    query.addEventListener("change", onChange)
    return () => query.removeEventListener("change", onChange)
  }, [])

  const clearTimers = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (delayRef.current) clearTimeout(delayRef.current)
    timerRef.current = null
    delayRef.current = null
  }

  const start = useCallback(() => {
    clearTimers()
    delayRef.current = setTimeout(() => {
      setVisible(true)
      setProgress(reduceMotion ? 60 : 0)
      if (reduceMotion) return
      let p = 0
      timerRef.current = setInterval(() => {
        p += p < 30 ? 8 : p < 60 ? 3 : p < 80 ? 1 : 0.5
        if (p > 90) p = 90
        setProgress(p)
      }, 100)
    }, 120)
  }, [reduceMotion])

  const done = useCallback(() => {
    clearTimers()
    setProgress((prev) => (prev > 0 ? 100 : 0))
    const t = setTimeout(() => {
      setVisible(false)
      setProgress(0)
    }, 300)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const url = pathname + searchParams.toString()
    if (prevUrl.current && prevUrl.current !== url) done()
    prevUrl.current = url
  }, [pathname, searchParams, done])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a")
      if (!target) return
      const href = target.getAttribute("href")
      if (!href || href.startsWith("#") || href.startsWith("http") || href.startsWith("mailto:")) return
      if (target.getAttribute("target") === "_blank" || target.hasAttribute("download")) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
      const currentUrl = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "")
      if (href !== currentUrl && href !== pathname) start()
    }
    document.addEventListener("click", handleClick, { capture: true })
    return () => document.removeEventListener("click", handleClick, { capture: true })
  }, [pathname, searchParams, start])

  useEffect(() => () => clearTimers(), [])

  if (!visible && progress === 0) return null

  return (
    <div
      role="progressbar"
      aria-label="Memuat halaman"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 4,
        zIndex: 9999,
        pointerEvents: "none",
        opacity: visible ? 1 : 0,
        transition: reduceMotion ? "none" : "opacity 300ms ease-out",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${progress}%`,
          background: "var(--primary)",
          transition: reduceMotion || progress === 0 ? "none" : progress === 100 ? "width 200ms ease-out" : "width 400ms ease",
        }}
      />
    </div>
  )
}
