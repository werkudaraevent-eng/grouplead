"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Loader2, Share } from "@/components/icons"
import { Button } from "@/components/ui/button"

/**
 * "Bagikan ke WhatsApp" on a sent report.
 *
 * The phone's share sheet (Web Share API) with the composed text and the
 * report's first photo; the rep picks the group. The photo is fetched as
 * soon as the button renders, not on tap: Safari and Chrome only allow the
 * share sheet inside the tap's activation window, and a download in between
 * would spend it. Where there is no share sheet (a desk browser), the text
 * is copied and WhatsApp's share URL opened with it; a photo cannot ride
 * along that way, and the toast says so.
 */
export function ShareReportButton({ text, photo }: { text: string; photo: { url: string; name: string } | null }) {
  const [busy, setBusy] = useState(false)
  const file = useRef<File | null>(null)

  useEffect(() => {
    file.current = null
    if (!photo || typeof navigator === "undefined" || typeof navigator.canShare !== "function") return
    let cancelled = false
    fetch(photo.url)
      .then((response) => (response.ok ? response.blob() : Promise.reject(new Error(String(response.status)))))
      .then((blob) => {
        if (cancelled) return
        const candidate = new File([blob], photo.name || "foto.jpg", { type: blob.type || "image/jpeg" })
        if (navigator.canShare({ files: [candidate] })) file.current = candidate
      })
      .catch(() => {
        // Text still shares; the photo stays in the gallery below.
      })
    return () => {
      cancelled = true
    }
  }, [photo])

  const share = async () => {
    setBusy(true)
    try {
      if (typeof navigator.share === "function") {
        const data: ShareData = file.current ? { text, files: [file.current] } : { text }
        try {
          await navigator.share(data)
          return
        } catch (error) {
          if ((error as Error).name === "AbortError") return
          // Fall through to the desk path.
        }
      }
      try {
        await navigator.clipboard.writeText(text)
      } catch {
        // Clipboard may be refused; WhatsApp still opens with the text.
      }
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener")
      toast.success(photo ? "Teks laporan disalin dan WhatsApp dibuka. Dari komputer, foto diunduh dari galeri di bawah." : "Teks laporan disalin dan WhatsApp dibuka.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={share} disabled={busy}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share className="h-4 w-4" />} Bagikan ke WhatsApp
    </Button>
  )
}
