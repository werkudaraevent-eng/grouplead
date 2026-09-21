"use client"

import { useCallback, useSyncExternalStore } from "react"
import { Check } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { FormActionBar } from "@/components/form-action-bar"
import { ShareReportButton } from "./share-report-button"

/**
 * The offer after "Kirim laporan": share it to the group now.
 *
 * Not a dialog. M3 keeps dialogs for decisions that must be answered before
 * anything else, and a rep who sends five reports a day would be closing
 * one each time. Strava after a save, Calendly and Typeform after a submit
 * put the next action on the confirmation itself; here that is a success
 * card on the report and, on a phone, the one next step on the bottom bar.
 * The offer ends when the share sheet completes (recorded on the report) or
 * when the author taps "Nanti saja" (remembered on this device for this
 * report). The share button in the card header stays either way.
 *
 * The card and the bar are two views of one offer, so "Nanti saja" on one
 * removes both: the state lives in localStorage and a window event, read
 * through useSyncExternalStore so both slots update together.
 */
export interface ShareOffer {
  missionId: string
  text: string
  photo: { url: string; name: string } | null
}

const EVENT = "report-share-offer"
const key = (missionId: string) => `report-share-offer:${missionId}`

function isDismissed(missionId: string): boolean {
  try {
    return window.localStorage.getItem(key(missionId)) === "later"
  } catch {
    return false
  }
}

function dismiss(missionId: string) {
  try {
    window.localStorage.setItem(key(missionId), "later")
  } catch {
    // No storage: the offer returns on the next visit, which is acceptable.
  }
  window.dispatchEvent(new Event(EVENT))
}

function useOfferOpen(missionId: string): boolean {
  const subscribe = useCallback((notify: () => void) => {
    window.addEventListener(EVENT, notify)
    window.addEventListener("storage", notify)
    return () => {
      window.removeEventListener(EVENT, notify)
      window.removeEventListener("storage", notify)
    }
  }, [])
  // Before hydration the offer is treated as open, so the card is in the
  // server HTML; a dismissed one disappears on the first client render.
  return useSyncExternalStore(subscribe, () => !isDismissed(missionId), () => true)
}

/** The success card at the top of the report: confirmation first, then the one thing to do next. */
export function ShareOfferCard({ offer }: { offer: ShareOffer }) {
  const open = useOfferOpen(offer.missionId)
  if (!open) return null
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--success-foreground)]/20 bg-[var(--success)] px-4 py-3 text-[var(--success-foreground)] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2.5">
        <Check className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.6} />
        <div className="text-sm">
          <p className="font-semibold">Laporan terkirim</p>
          <p className="mt-0.5">Bagikan ke grup WhatsApp sekarang? Teks dan fotonya sudah disiapkan.</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 max-sm:justify-end">
        <Button variant="ghost" size="sm" className="text-[var(--success-foreground)] hover:bg-[var(--success-foreground)]/10" onClick={() => dismiss(offer.missionId)}>
          Nanti saja
        </Button>
        {/* On a phone the bottom bar carries the share; the card keeps it on a desk. */}
        <ShareReportButton missionId={offer.missionId} text={offer.text} photo={offer.photo} variant="default" className="max-lg:hidden" onShared={() => dismiss(offer.missionId)} />
      </div>
    </div>
  )
}

/**
 * The phone's bottom bar while the offer is open: Bagikan ke WhatsApp as
 * the next step. Once the offer ends, the bar the page would otherwise
 * show (or none) takes its place.
 */
export function ShareOfferBar({ offer, fallback }: { offer: ShareOffer; fallback: React.ReactNode }) {
  const open = useOfferOpen(offer.missionId)
  if (!open) return <>{fallback}</>
  return (
    <FormActionBar until="lg">
      <div className="flex items-center gap-2">
        <ShareReportButton missionId={offer.missionId} text={offer.text} photo={offer.photo} variant="default" size="default" className="h-12 flex-1" onShared={() => dismiss(offer.missionId)} />
      </div>
    </FormActionBar>
  )
}
