"use client"

import { useEffect } from "react"
import { toast } from "sonner"
import {
  createDeployWatch,
  parseBuildId,
  STALE_COPY,
  staleKind,
  VERSION_PATH,
  VERSION_TICK_MS,
  type StaleKind,
} from "@/lib/deploy/stale-client"
import { STALE_DEPLOYMENT_EVENT, type StaleDeploymentDetail } from "@/lib/deploy/stale-announce"

/**
 * Surviving a deploy, from the open tab (DESIGN.md, "Surviving a deploy").
 * Draws nothing itself; it puts up one snackbar that stays until the
 * person reloads or closes it:
 *
 * - "Versi baru tersedia…" when `/api/version` answers with another build
 *   than the one this tab loaded: on coming back to the tab, and every five
 *   minutes while it is in front (`lib/deploy/stale-client.ts`).
 * - "Aplikasi baru saja diperbarui. Isianmu masih ada…" when something the
 *   person sent failed only because the tab is older than the server: a
 *   form that caught it announces it (`lib/deploy/stale-announce.ts`), and
 *   anything that did not is caught here from the unhandled rejection.
 *
 * Muat ulang is a full reload, never `router.refresh()`: the old tab's
 * code is the problem, and only a new page load replaces it. The forms keep
 * a draft in this browser, so the reload brings back what was typed.
 */
const TOAST_ID = "sa-app-update"

export function DeployWatch() {
  useEffect(() => {
    let shown: StaleKind | null = null
    let closedNewBuild = false

    const show = (kind: StaleKind) => {
      // The failure notice outranks the new-version one and replaces it in place.
      if (shown === "action" && kind === "build") return
      if (kind === "build" && closedNewBuild) return
      shown = kind
      toast(kind === "action" ? STALE_COPY.actionFailed : STALE_COPY.newBuild, {
        id: TOAST_ID,
        duration: Number.POSITIVE_INFINITY,
        action: { label: STALE_COPY.reload, onClick: () => window.location.reload() },
        cancel: { label: "Tutup", onClick: () => undefined },
        onDismiss: () => {
          if (shown === "build") closedNewBuild = true
          shown = null
        },
      })
    }

    const onAnnounce = (event: Event) => {
      const detail = (event as CustomEvent<StaleDeploymentDetail>).detail
      if (detail?.kind) show(detail.kind)
    }
    // A send that nobody caught: the notice instead of an error in the console.
    const onRejection = (event: PromiseRejectionEvent) => {
      const kind = staleKind(event.reason)
      if (!kind) return
      event.preventDefault()
      show(kind)
    }
    const onError = (event: ErrorEvent) => {
      const kind = staleKind(event.error ?? event.message)
      if (kind) show(kind)
    }
    window.addEventListener(STALE_DEPLOYMENT_EVENT, onAnnounce)
    window.addEventListener("unhandledrejection", onRejection)
    window.addEventListener("error", onError)

    // The version check. Not in development, where every restart is a new id.
    const current = process.env.NEXT_PUBLIC_BUILD_ID ?? ""
    const watching = process.env.NODE_ENV === "production" && current.length > 0
    const watch = createDeployWatch({
      now: () => Date.now(),
      currentBuildId: current,
      fetchBuildId: async () => {
        try {
          const response = await fetch(VERSION_PATH, { cache: "no-store", headers: { accept: "application/json" } })
          if (!response.ok) return null
          return parseBuildId(await response.json())
        } catch {
          return null
        }
      },
      onNewBuild: () => show("build"),
    })
    const onFront = () => {
      if (document.visibilityState === "visible") watch.focus()
    }
    const interval = watching
      ? window.setInterval(() => {
          if (document.visibilityState === "visible") watch.tick()
        }, VERSION_TICK_MS)
      : undefined
    if (watching) {
      window.addEventListener("focus", onFront)
      document.addEventListener("visibilitychange", onFront)
    }

    return () => {
      window.removeEventListener(STALE_DEPLOYMENT_EVENT, onAnnounce)
      window.removeEventListener("unhandledrejection", onRejection)
      window.removeEventListener("error", onError)
      window.removeEventListener("focus", onFront)
      document.removeEventListener("visibilitychange", onFront)
      if (interval !== undefined) window.clearInterval(interval)
      watch.dispose()
    }
  }, [])

  return null
}
