"use client"

import Link from "next/link"
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState } from "react"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { markHintSeen } from "@/app/actions/hint-actions"

/**
 * One-step coach marks.
 *
 * Material has no product tour; what it has is the rich tooltip: a title,
 * one sentence, one action, anchored to the thing it explains, never
 * locking the screen. A mark appears once, the first time its control
 * matters, and is dismissed with "Mengerti" (or by tapping anywhere else).
 * One mark at a time per screen, and the screen gets a moment to settle
 * first, so a hint is never one more thing loading.
 *
 * "Seen" is per account (the server list this provider is given, written
 * back through a server action) with localStorage as the fallback for a
 * dismissal that happens offline.
 */

const STORAGE_PREFIX = "sa:hint:"

/** The one mark on screen: its key and which rendered instance holds it
 *  (a list can render the same Join button twenty times). */
interface ActiveMark {
  key: string
  instance: string
}

interface HintStore {
  seen: Set<string>
  active: ActiveMark | null
  claim: (key: string, instance: string) => void
  release: (instance: string) => void
  dismiss: (key: string) => void
}

const HintContext = createContext<HintStore | null>(null)

export function HintsProvider({ seen: initial, children }: { seen: string[]; children: React.ReactNode }) {
  const [seen, setSeen] = useState(() => new Set(initial))
  const [active, setActive] = useState<ActiveMark | null>(null)

  useEffect(() => {
    // A dismissal that never reached the server still counts on this device.
    try {
      const extra: string[] = []
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index)
        if (key?.startsWith(STORAGE_PREFIX)) extra.push(key.slice(STORAGE_PREFIX.length))
      }
      if (extra.length > 0) setSeen((prev) => new Set([...prev, ...extra]))
    } catch {
      // Storage may be unavailable; the server list is enough.
    }
  }, [])

  const claim = useCallback((key: string, instance: string) => setActive((prev) => prev ?? { key, instance }), [])
  const release = useCallback((instance: string) => setActive((prev) => (prev?.instance === instance ? null : prev)), [])
  const dismiss = useCallback((key: string) => {
    setSeen((prev) => new Set(prev).add(key))
    setActive((prev) => (prev?.key === key ? null : prev))
    try {
      window.localStorage.setItem(STORAGE_PREFIX + key, "1")
    } catch {
      // Ignore; the server row is the record.
    }
    void markHintSeen(key)
  }, [])

  const value = useMemo(() => ({ seen, active, claim, release, dismiss }), [seen, active, claim, release, dismiss])
  return <HintContext.Provider value={value}>{children}</HintContext.Provider>
}

/** Whether the mark for `key` should be showing now, and how to dismiss it. */
export function useCoachMark(key: string, enabled = true): { show: boolean; dismiss: () => void } {
  const store = useContext(HintContext)
  const instance = useId()
  const claim = store?.claim
  const release = store?.release
  const wanted = Boolean(store) && enabled && !store!.seen.has(key)
  const idle = store?.active === null

  useEffect(() => {
    if (!claim || !wanted || !idle) return
    const timer = window.setTimeout(() => claim(key, instance), 900)
    return () => window.clearTimeout(timer)
  }, [claim, wanted, idle, key, instance])

  // Leaving the screen while showing hands the slot to the next mark.
  useEffect(() => () => release?.(instance), [release, instance])

  const show = wanted && store?.active?.instance === instance
  const dismiss = useCallback(() => store?.dismiss(key), [store, key])
  return { show, dismiss }
}

/** Whether this person has already dismissed the mark for `key`. */
export function useHintSeen(key: string): boolean {
  return useContext(HintContext)?.seen.has(key) ?? true
}

export function CoachMark({
  hintKey,
  title,
  body,
  learnHref,
  side = "top",
  align = "center",
  enabled = true,
  children,
}: {
  hintKey: string
  title: string
  body: string
  /** A "Pelajari" link to the guide, when one sentence is not enough. */
  learnHref?: string
  side?: "top" | "bottom" | "left" | "right"
  align?: "start" | "center" | "end"
  /** False while the control is not yet relevant (the mark waits). */
  enabled?: boolean
  /** The control the mark points at; must take a ref. */
  children: React.ReactElement
}) {
  const { show, dismiss } = useCoachMark(hintKey, enabled)
  return (
    <Popover open={show} onOpenChange={(open) => { if (!open) dismiss() }}>
      <PopoverAnchor asChild>{children}</PopoverAnchor>
      <PopoverContent
        side={side}
        align={align}
        sideOffset={12}
        collisionPadding={16}
        onOpenAutoFocus={(event) => event.preventDefault()}
        role="dialog"
        aria-label={title}
        className="w-72 rounded-xl border bg-card p-4 shadow-xl"
      >
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
        <div className="mt-3 flex items-center justify-end gap-1">
          {learnHref && (
            <Link href={learnHref} onClick={dismiss} className="inline-flex h-10 items-center rounded-lg px-3 text-sm font-semibold text-primary hover:bg-primary/10">
              Pelajari
            </Link>
          )}
          <button type="button" onClick={dismiss} className="inline-flex h-10 items-center rounded-lg px-3 text-sm font-semibold text-primary hover:bg-primary/10">
            Mengerti
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
