"use client"

import { useEffect } from "react"
import { touchDevice } from "@/app/actions/device-actions"
import { createClient } from "@/utils/supabase/client"
import { createSessionWatch, WATCH_TICK_MS } from "@/lib/devices/session-watch"
import { isSignedOutError, SIGNED_OUT_LOGIN_PATH } from "@/lib/devices/signed-out"

/**
 * Active devices, from the open tab: records this device on load and on
 * coming back to it, and notices when it was signed out elsewhere (another
 * device's Active devices, Sales Activity's Perangkat aktif, an admin's Sign
 * out everywhere, a password change). Draws nothing. The rules live in
 * `lib/devices/session-watch.ts`.
 *
 * It replaces the "last login wins" guard, which signed this browser out
 * whenever the account signed in anywhere else. Several sessions are allowed
 * now; only one that was actually ended is signed out here.
 *
 * Signing out here is only tidying up: the session is already gone on the
 * server and nothing typed could be saved any more. The page is left with a
 * full navigation rather than the router's, so a page that guards unsaved
 * work with `beforeunload` (the form layout builder) still gets to ask first.
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
