"use client"

import { useEffect } from "react"
import { touchDevice } from "@/app/actions/device-actions"
import { createClient } from "@/utils/supabase/client"
import { createSessionWatch, WATCH_TICK_MS } from "@/lib/devices/session-watch"
import { isSignedOutError, SIGNED_OUT_LOGIN_PATH } from "@/lib/devices/signed-out"

/**
 * Perangkat aktif, from the open tab: records this device on load and on
 * coming back to it, and notices when it was signed out elsewhere (another
 * device's Perangkat aktif, LeadEngine's Active devices, an admin, a
 * password change). Draws nothing. The rules live in
 * `lib/devices/session-watch.ts`.
 *
 * Signing out here is only tidying up: the session is already gone on the
 * server and nothing typed could be saved any more. The page is left with a
 * full navigation rather than the router's, so any page that guards unsaved
 * work with `beforeunload` still gets to ask first.
 */
export function SessionWatch() {
  useEffect(() => {
    const supabase = createClient()
    const watch = createSessionWatch({
      now: () => Date.now(),
      touch: () => {
        touchDevice({ userAgent: navigator.userAgent }).catch(() => {})
      },
      check: async () => {
        try {
          const { error } = await supabase.auth.getUser()
          if (!error) return "ok"
          return isSignedOutError(error) ? "signed-out" : "unknown"
        } catch {
          return "unknown"
        }
      },
      onSignedOut: () => {
        supabase.auth
          .signOut({ scope: "local" })
          .catch(() => {})
          .finally(() => window.location.replace(SIGNED_OUT_LOGIN_PATH))
      },
    })

    watch.start()
    const onFront = () => {
      if (document.visibilityState === "visible") watch.focus()
    }
    window.addEventListener("focus", onFront)
    document.addEventListener("visibilitychange", onFront)
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") watch.tick()
    }, WATCH_TICK_MS)

    return () => {
      window.removeEventListener("focus", onFront)
      document.removeEventListener("visibilitychange", onFront)
      window.clearInterval(interval)
      watch.dispose()
    }
  }, [])

  return null
}
