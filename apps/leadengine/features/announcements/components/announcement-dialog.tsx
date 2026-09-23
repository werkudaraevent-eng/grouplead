"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { ArrowRight, Sparkles } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { usePermissions } from "@/contexts/permissions-context"
import { useCompact } from "@/hooks/use-compact"
import { markHintsSeen } from "@/app/actions/hint-actions"
import type { AnnouncementState } from "@/lib/announcements/announcements"

/**
 * "What's new in LeadEngine": the one-time dialog for releases an admin has
 * switched on in Settings → Announcements, the way Slack, Notion and Gmail
 * announce a release: once per person, two or three highlights, each with a
 * way straight to the feature, and a text button to put it off. It is
 * rendered by the dashboard only and opens after the page settles, so a
 * person who went straight to a record is never interrupted. On a phone it
 * is a bottom sheet. Later and Got it both close it for good; Later is the
 * quiet one.
 *
 * "For good" is per account (a seen mark in public.user_hints, written
 * through a server action), keyed on the last (re)announcement. A mark that
 * fails to save still holds on this device: in memory for the rest of the
 * session and in localStorage after that.
 */
const PRODUCT_NAME = "LeadEngine"
const TITLE = `What's new in ${PRODUCT_NAME}`
const STORAGE_PREFIX = "le:hint:"
const SETTLE_MS = 700

// Closed in this tab. Module state outlives the dashboard's unmount, so
// leaving and coming back never re-opens it even when the save failed.
const closedThisSession = new Set<string>()

function closedHere(key: string): boolean {
  if (closedThisSession.has(key)) return true
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + key) === "1"
  } catch {
    return false
  }
}

function rememberClosed(keys: readonly string[]) {
  for (const key of keys) {
    closedThisSession.add(key)
    try {
      window.localStorage.setItem(STORAGE_PREFIX + key, "1")
    } catch {
      // Storage may be unavailable; the session set and the server row are enough.
    }
  }
}

export function AnnouncementDialog({ items: pending }: { items: readonly AnnouncementState[] }) {
  const compact = useCompact()
  const { can } = usePermissions()
  // The changelog is an admin page (settings.read); only they get the link.
  const canReadChangelog = can("settings", "read")
  const primaryRef = useRef<HTMLButtonElement>(null)

  // Latched when it opens, so closing does not empty the list mid-animation.
  const [items, setItems] = useState<AnnouncementState[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (items.length > 0 || pending.length === 0) return
    const timer = window.setTimeout(() => {
      const fresh = pending.filter((item) => !closedHere(item.seenKey))
      if (fresh.length === 0) return
      setItems(fresh)
      setOpen(true)
    }, SETTLE_MS)
    return () => window.clearTimeout(timer)
  }, [items.length, pending])

  const close = () => {
    if (!open) return
    const keys = items.map((item) => item.seenKey)
    rememberClosed(keys)
    setOpen(false)
    // A failed save keeps the local mark; the dialog does not come back here.
    markHintsSeen(keys).catch(() => undefined)
  }

  if (items.length === 0) return null

  const description = items.length === 1 ? "One new thing, ready to use." : `${items.length} new things, ready to use.`
  const body = (
    <ol className="space-y-3">
      {items.map((item) => (
        <li key={item.key} className="flex gap-3 rounded-xl border bg-card px-4 py-3">
          <span
            className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"
            aria-hidden="true"
          >
            <Sparkles className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{item.title}</p>
            <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            {item.href && (
              <Link
                href={item.href}
                onClick={close}
                className="-ml-2 mt-0.5 inline-flex min-h-11 items-center lg:min-h-8 gap-1 rounded-md px-2 text-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {item.hrefLabel ?? "Try it now"} <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
  const more = canReadChangelog ? (
    <p className="text-xs text-muted-foreground">
      More in the{" "}
      <Link href="/changelog" onClick={close} className="font-semibold text-primary hover:underline">
        changelog
      </Link>
      .
    </p>
  ) : null
  const actions = (
    <>
      <Button type="button" variant="ghost" onClick={close} className="max-lg:h-11">
        Later
      </Button>
      <Button ref={primaryRef} type="button" onClick={close} className="max-lg:h-11">
        Got it
      </Button>
    </>
  )

  if (compact) {
    return (
      <BottomSheet
        open={open}
        onOpenChange={(next) => {
          if (!next) close()
        }}
        title={TITLE}
        description={description}
        footer={<div className="flex justify-end gap-2">{actions}</div>}
      >
        <div className="space-y-3 px-4 pt-2 pb-3">
          {body}
          {more}
        </div>
      </BottomSheet>
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close()
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          // Land on Got it rather than on the first item's link.
          event.preventDefault()
          primaryRef.current?.focus({ preventScroll: true })
        }}
      >
        <DialogHeader>
          <DialogTitle>{TITLE}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          {body}
          {more}
        </DialogBody>
        <DialogFooter>{actions}</DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
