"use client"

import { useCallback, useEffect, useState } from "react"
import { ensureTodayInsight } from "@/app/actions/ai-insight-actions"
import { INSIGHT_POLL_LIMIT_MS, INSIGHT_POLL_MS, INSIGHT_UNFINISHED_MESSAGE } from "@/lib/ai/insight-brief"
import type { InsightView } from "@/lib/ai/insight-view"

/**
 * Today's brief for a page that must not wait for it.
 *
 * Writing a brief takes as long as a reasoning model takes, so the server
 * claims the row and answers "pending" straight away. A page that asked
 * once and then sat on "Menyusun brief…" was lying the moment the person
 * walked away and came back, so while the row is a claim this keeps asking
 * — every five seconds, the way Gmail's "Sending…" and Notion's background
 * jobs settle themselves without a refresh. A live claim costs one read on
 * the server, not a model call.
 *
 * The wait is the person's, not the clock's: a hidden tab stops asking and
 * its time does not count, so a laptop that slept does not come back to a
 * timed-out brief. After four minutes of actually waiting it gives up and
 * says so, because a spinner with no end is worse than a sentence.
 */
export function useTodayInsight({ initial, enabled = true, day = "" }: { initial: InsightView | null; enabled?: boolean; day?: string }): {
  view: InsightView | null
  loading: boolean
  /** A result from elsewhere (Buat ulang): shown, and polled again when it is still a claim. */
  apply: (view: InsightView) => void
} {
  const [view, setView] = useState<InsightView | null>(initial)
  const [loading, setLoading] = useState(enabled && (!initial || initial.status === "pending"))
  // Bumped whenever a fresh wait starts; zero means nothing to wait for.
  const [pollKey, setPollKey] = useState(0)

  const failed = useCallback((error: string): InsightView => ({ status: "failed", items: [], generatedAt: null, model: null, error, trigger: "view", reportsSeen: 0, scope: "unit", day }), [day])

  useEffect(() => {
    setView(initial)
    setPollKey((key) => (enabled && (!initial || initial.status === "pending") ? key + 1 : 0))
  }, [initial, enabled])

  useEffect(() => {
    if (pollKey === 0) {
      setLoading(false)
      return
    }
    setLoading(true)
    let cancelled = false
    // Set once the wait is over (an answer, a failure, or time up): nothing asks again after that.
    let done = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let asking = false
    let hiddenAt: number | null = null
    let deadline = Date.now() + INSIGHT_POLL_LIMIT_MS

    const hidden = () => document.visibilityState === "hidden"

    const schedule = () => {
      if (cancelled || done || timer !== null || hidden()) return
      timer = setTimeout(() => {
        timer = null
        void ask()
      }, INSIGHT_POLL_MS)
    }

    const ask = async () => {
      if (cancelled || done || asking) return
      asking = true
      const result = await ensureTodayInsight()
      asking = false
      if (cancelled) return
      const next = result.success && result.data ? result.data : failed(result.error ?? "Brief gagal dibuat.")
      if (next.status !== "pending") {
        done = true
        setView(next)
        setLoading(false)
        return
      }
      if (Date.now() >= deadline) {
        done = true
        // The row it carries says what went wrong, if anything did; otherwise the wait itself is the news.
        setView({ ...next, status: "failed", error: next.error ?? INSIGHT_UNFINISHED_MESSAGE })
        setLoading(false)
        return
      }
      setView(next)
      schedule()
    }

    const onVisibility = () => {
      if (cancelled || done) return
      if (hidden()) {
        hiddenAt = Date.now()
        if (timer !== null) {
          clearTimeout(timer)
          timer = null
        }
        return
      }
      if (hiddenAt !== null) {
        deadline += Date.now() - hiddenAt
        hiddenAt = null
      }
      void ask()
    }

    document.addEventListener("visibilitychange", onVisibility)
    void ask()
    return () => {
      cancelled = true
      if (timer !== null) clearTimeout(timer)
      document.removeEventListener("visibilitychange", onVisibility)
    }
    // `failed` only changes with the day, which is also when `initial` changes.
  }, [pollKey, failed])

  const apply = useCallback((next: InsightView) => {
    setView(next)
    setPollKey((key) => (next.status === "pending" ? key + 1 : 0))
  }, [])

  return { view, loading, apply }
}
