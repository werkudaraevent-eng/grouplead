"use client"

import { useEffect } from "react"
import { captureInstallPrompt } from "@/lib/pwa"

/**
 * Registers the service worker and keeps the install prompt.
 *
 * The worker is versioned by the build id in its URL, so every deploy
 * installs a fresh one that throws the previous build's asset cache away
 * on activation. It caches hashed static assets only; every page and every
 * piece of data comes from the network. That is the whole design: the
 * stale-UI incident LeadEngine guards against with a kill switch came from
 * a worker that cached HTML.
 */
export function PwaRegister() {
  useEffect(() => {
    captureInstallPrompt()
    if (process.env.NODE_ENV !== "production") return
    if (!("serviceWorker" in navigator)) return
    const version = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev"
    navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(version)}`, { scope: "/" }).catch(() => {
      // An installed app keeps working without the worker; only the
      // home-screen install prompt depends on it.
    })
  }, [])
  return null
}
