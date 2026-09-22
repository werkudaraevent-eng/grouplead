"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { markReportShared } from "@/app/actions/visit-report-actions"
import { WhatsAppShareButton } from "@/components/whatsapp-share-button"
import { DESK_SHARE_EVENT, type DeskShareDetail } from "./desk-share-notice"

/**
 * "Bagikan ke WhatsApp" on a sent report.
 *
 * The two roads (phone share sheet, desk app probe then WhatsApp Web) are
 * `WhatsAppShareButton`'s, shared with the daily brief; what belongs to a
 * report is here: the first photo, fetched as soon as the button renders
 * rather than on tap, because a share sheet or a download must happen
 * inside the tap's activation window; the "shared" mark on the record,
 * which only the phone road can honestly set (the desk road cannot know
 * the message was sent); and the banner that explains the WhatsApp Web
 * road, which the notice in the report card listens for.
 */
export function ShareReportButton({
  missionId,
  text,
  photo,
  variant = "outline",
  size = "sm",
  className,
  onShared,
}: {
  missionId: string
  text: string
  /** The first photo's signed URL and the file name to share it under. */
  photo: { url: string; name: string } | null
  variant?: "outline" | "default"
  size?: "sm" | "default"
  className?: string
  onShared?: () => void
}) {
  const file = useRef<File | null>(null)
  const router = useRouter()

  useEffect(() => {
    file.current = null
    if (!photo) return
    let cancelled = false
    fetch(photo.url)
      .then((response) => (response.ok ? response.blob() : Promise.reject(new Error(String(response.status)))))
      .then((blob) => {
        if (!cancelled) file.current = new File([blob], photo.name, { type: blob.type || "image/jpeg" })
      })
      .catch(() => {
        // Text still goes; the photo stays in the gallery below.
      })
    return () => {
      cancelled = true
    }
  }, [photo])

  return (
    <WhatsAppShareButton
      text={text}
      getFile={() => file.current}
      variant={variant}
      size={size}
      className={className}
      blockedHint="Buka WhatsApp Web dari tombol di kartu laporan."
      onPhoneShared={async () => {
        const result = await markReportShared(missionId)
        if (result.success) {
          onShared?.()
          router.refresh()
        }
      }}
      onDeskWeb={(detail) => window.dispatchEvent(new CustomEvent<DeskShareDetail>(DESK_SHARE_EVENT, { detail }))}
    />
  )
}
