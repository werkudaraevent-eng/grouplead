"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { ArrowRight, Sparkles } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useDismissHint, useSeenHints } from "@/components/coach-mark"
import { useCompact } from "@/hooks/use-compact"
import { pendingAnnouncements, type AnnouncementState } from "@/lib/announcements/announcements"
import { PRODUCT_NAME } from "@/lib/brand"
import { paths } from "@/lib/paths"

/**
 * "Yang baru": the one-time dialog for releases the unit's admin has switched
 * on, the way Slack, Notion and Gmail announce a release: once per person,
 * two or three highlights, each with a way straight to the feature, and a
 * text button to put it off. It appears on Hari ini only, after the page
 * settles, never on a record someone arrived at from a notification. On a
 * phone it is a bottom sheet. Nanti saja closes it for good (the dot on Yang
 * baru stays until that page is opened); Mengerti and Coba sekarang clear
 * both.
 */
const TITLE = `Yang baru di ${PRODUCT_NAME}`

export function AnnouncementDialog({ announcements }: { announcements: readonly AnnouncementState[] }) {
  const pathname = usePathname()
  const router = useRouter()
  const compact = useCompact()
  const seen = useSeenHints()
  const dismiss = useDismissHint()
  const pending = useMemo(() => (pathname === paths.workspace ? pendingAnnouncements(announcements, seen) : []), [pathname, announcements, seen])

  // Latched at open time so a dismissal does not empty the list mid-close.
  const [items, setItems] = useState<AnnouncementState[]>([])
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (open || items.length > 0 || pending.length === 0) return
    const timer = window.setTimeout(() => {
      setItems(pending)
      setOpen(true)
    }, 700)
    return () => window.clearTimeout(timer)
  }, [open, items.length, pending])

  const later = () => {
    for (const item of items) dismiss(item.seenKey)
    setOpen(false)
  }
  const done = () => {
    for (const item of items) {
      dismiss(item.seenKey)
      dismiss(item.readKey)
    }
    setOpen(false)
  }
  const tryNow = (item: AnnouncementState) => {
    done()
    if (item.href) router.push(item.href)
  }

  if (items.length === 0) return null

  const description = items.length === 1 ? "Satu hal baru yang siap dipakai." : `${items.length} hal baru yang siap dipakai.`
  const body = (
    <ol className="space-y-3">
      {items.map((item) => (
        <li key={item.key} className="flex gap-3 rounded-xl border bg-card px-4 py-3">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--tonal)] text-[var(--tonal-foreground)]" aria-hidden="true">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{item.title}</p>
            <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            {item.href && (
              <button type="button" onClick={() => tryNow(item)} className="mt-1.5 inline-flex min-h-8 items-center gap-1 text-sm font-semibold text-primary hover:underline">
                {item.hrefLabel ?? "Coba sekarang"} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
  const more = (
    <p className="text-xs text-muted-foreground">
      Selengkapnya di <Link href={paths.whatsNew} onClick={done} className="font-semibold text-primary hover:underline">Yang baru</Link>.
    </p>
  )
  const actions = (
    <>
      <Button type="button" variant="ghost" onClick={later}>Nanti saja</Button>
      <Button type="button" onClick={done}>Mengerti</Button>
    </>
  )

  if (compact) {
    return (
      <BottomSheet
        open={open}
        onOpenChange={(next) => { if (!next) later() }}
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
    <Dialog open={open} onOpenChange={(next) => { if (!next) later() }}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{TITLE}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {body}
          {more}
        </div>
        <DialogFooter>{actions}</DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** A dot for the Yang baru entry while an announcement is on and the page not opened since. */
export function WhatsNewDot({ announcements, className }: { announcements: readonly AnnouncementState[]; className?: string }) {
  const seen = useSeenHints()
  const unread = announcements.some((item) => item.enabled && !seen.has(item.readKey))
  if (!unread) return null
  return <span className={className ?? "ml-auto h-2 w-2 shrink-0 rounded-full bg-primary"} aria-label="Ada yang baru" />
}

/** Opening Yang baru counts as reading every announcement that is on. */
export function MarkAnnouncementsRead({ readKeys }: { readKeys: readonly string[] }) {
  const seen = useSeenHints()
  const dismiss = useDismissHint()
  useEffect(() => {
    for (const key of readKeys) if (!seen.has(key)) dismiss(key)
    // Once, on arrival: later dismissals come from the same store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}
