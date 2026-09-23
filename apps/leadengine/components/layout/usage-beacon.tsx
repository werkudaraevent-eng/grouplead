"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { recordUsage } from "@/app/actions/usage-actions"
import { createUsageBeacon, USAGE_TICK_MS, type UsageBeacon as Beacon } from "@/lib/usage/usage-beacon"
import { normalizeUsagePath } from "@/lib/usage/usage-path"

/**
 * Tells Settings → Usage that this person is here, and on which kind of
 * page. Draws nothing. The rules (a call at most every 30 seconds with the
 * opens batched, nothing while the tab is hidden, a heartbeat after five
 * active minutes on one page) live in `lib/usage/usage-beacon.ts`; this
 * only wires them to the router and the document.
 *
 * Only the route is sent (`/leads/:id`), never an id, a query string, or
 * anything typed. A failed call is dropped, whether the server answered
 * with an error or never answered: usage must never cost a page anything.
 */
export function UsageBeacon() {
  const pathname = usePathname()
  const beaconRef = useRef<Beacon | null>(null)

  useEffect(() => {
    const beacon = createUsageBeacon({
      send: (visits) => {
        try {
          recordUsage(visits).catch(() => {})
        } catch {
          // A synchronous throw (no action runtime yet) is dropped the same way.
        }
      },
      now: () => Date.now(),
      isVisible: () => document.visibilityState === "visible",
      setTimer: (run, ms) => window.setTimeout(run, ms),
      clearTimer: (handle) => window.clearTimeout(handle as number),
    })
    beaconRef.current = beacon

    const interact = () => beacon.interact()
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return
      // Coming back to the tab is itself a sign of someone at the screen.
      beacon.interact()
      beacon.tick()
    }
    const options = { capture: true, passive: true } as const
    const events = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const
    for (const name of events) document.addEventListener(name, interact, options)
    document.addEventListener("visibilitychange", onVisibility)
    const interval = window.setInterval(() => beacon.tick(), USAGE_TICK_MS)

    return () => {
      for (const name of events) document.removeEventListener(name, interact, options)
      document.removeEventListener("visibilitychange", onVisibility)
      window.clearInterval(interval)
      beacon.dispose()
      beaconRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!pathname) return
    beaconRef.current?.visit(normalizeUsagePath(pathname))
  }, [pathname])

  return null
}
