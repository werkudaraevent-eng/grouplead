"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Pause, Play } from "lucide-react"

/**
 * Keeps the internal board current without reloading the document.
 *
 * The TV board can use `<meta http-equiv="refresh">` because it has no shell
 * and nobody interacts with it. This page sits inside the workspace, where a
 * full reload every 30 seconds would throw away the sidebar state, the scroll
 * position, and the keyboard focus, and re-download the whole app — on a field
 * connection too. `router.refresh()` refetches only the server components.
 *
 * The pause control is not decoration: auto-updating content the reader cannot
 * stop is a WCAG 2.2.4 failure.
 */

const INTERVAL_MS = 30_000

export function AutoRefresh() {
  const router = useRouter()
  const [running, setRunning] = useState(true)

  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => router.refresh(), INTERVAL_MS)
    return () => clearInterval(timer)
  }, [running, router])

  return (
    <button
      type="button"
      onClick={() => setRunning((value) => !value)}
      aria-pressed={running}
      className="fixed bottom-5 right-5 z-30 flex min-h-11 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      {running ? "Jeda pembaruan" : "Lanjutkan pembaruan"}
    </button>
  )
}
