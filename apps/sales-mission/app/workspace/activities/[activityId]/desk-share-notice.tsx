"use client"

import { useEffect, useState } from "react"
import { Info, Share, X } from "@/components/icons"
import { Button } from "@/components/ui/button"

/**
 * The banner for the desk road of "Bagikan ke WhatsApp".
 *
 * A snackbar is one or two lines that vanish; what happened here needs a
 * sentence of explanation and a button that waits, so it is a banner (M3):
 * in the report card, under its header, until the person closes it, with
 * text buttons for its two actions so the card's own filled action keeps
 * the page's hierarchy. The
 * share button announces the road through a window event and this notice
 * listens, so the two can sit in different parts of the card.
 */
export const DESK_SHARE_EVENT = "report-share-desk"

export interface DeskShareDetail {
  /** WhatsApp Web's URL with the text filled in. */
  url: string
  /** Whether the browser let the tab open; when not, the button here is the way. */
  opened: boolean
}

export function DeskShareNotice() {
  const [detail, setDetail] = useState<DeskShareDetail | null>(null)

  useEffect(() => {
    const onShare = (event: Event) => setDetail((event as CustomEvent<DeskShareDetail>).detail)
    window.addEventListener(DESK_SHARE_EVENT, onShare)
    return () => window.removeEventListener(DESK_SHARE_EVENT, onShare)
  }, [])

  if (!detail) return null
  return (
    <div role="status" className="flex flex-col gap-3 rounded-xl bg-[var(--tonal)] px-4 py-3 text-sm text-[var(--tonal-foreground)] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2.5">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          WhatsApp desktop tidak terpasang di komputer ini, jadi WhatsApp Web yang dipakai.
          {detail.opened ? " Teks laporan sudah terisi di tab barunya; seret foto yang baru diunduh ke chat." : " Browser menahan tab barunya; buka lewat tombol ini, teksnya sudah terisi, lalu seret foto yang baru diunduh ke chat."}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 max-sm:justify-end">
        <Button variant="ghost" size="sm" className="text-[var(--tonal-foreground)] hover:bg-[var(--tonal-foreground)]/10" onClick={() => setDetail(null)}>
          <X className="h-4 w-4" /> Tutup
        </Button>
        {/* A text button, as M3 banners have: the card's filled action stays the loudest thing on the page. */}
        <Button variant="ghost" size="sm" className="font-semibold text-[var(--tonal-foreground)] hover:bg-[var(--tonal-foreground)]/10" onClick={() => window.open(detail.url, "_blank", "noopener")}>
          <Share className="h-4 w-4" /> Buka WhatsApp Web
        </Button>
      </div>
    </div>
  )
}
