"use client"

import { useEffect, useState } from "react"

/**
 * Material's compact window class, as the browser reports it.
 *
 * Below Tailwind's `md` (768px) the app runs the phone layout: bottom
 * navigation, sheets instead of popovers, one column. The hook is false on
 * the server and on the first client render so that hydration matches;
 * anything that must be right in the first HTML uses CSS breakpoints
 * instead of this hook.
 */
export function useCompact(): boolean {
  const [compact, setCompact] = useState(false)
  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)")
    const update = () => setCompact(query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])
  return compact
}

/** Whether the app runs installed (home screen), without browser chrome. */
export function useStandalone(): boolean {
  const [standalone, setStandalone] = useState(false)
  useEffect(() => {
    const query = window.matchMedia("(display-mode: standalone)")
    const nav = window.navigator as Navigator & { standalone?: boolean }
    const update = () => setStandalone(query.matches || nav.standalone === true)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])
  return standalone
}
