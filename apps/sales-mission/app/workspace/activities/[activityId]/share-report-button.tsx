"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Share } from "@/components/icons"
import { markReportShared } from "@/app/actions/visit-report-actions"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * "Bagikan ke WhatsApp" on a sent report.
 *
 * Two roads, chosen by the device rather than by what the browser offers,
 * because Chrome, Edge and Brave on Windows 11 offer the Web Share API too
 * and open the Windows share sheet, which lists Outlook contacts and a
 * "WhatsApp · Install" tile and leads nowhere useful.
 *
 * Phone or tablet: the share sheet with the text and the first photo; the
 * rep picks the group. A completed share is recorded on the report.
 *
 * Desk: the text is copied, the photo downloaded under a tidy name, and
 * WhatsApp desktop is tried through its whatsapp:// link, the way Zoom and
 * Slack open their apps. A page cannot ask which apps are installed; it
 * can only try and watch: when the page loses focus within a moment, the
 * app opened. When nothing happens, WhatsApp Web opens instead and the
 * toast says why. The answer is remembered per browser so the next click
 * goes straight there. Neither desk road can carry the photo (both accept
 * text only), so it is downloaded to be dragged into the chat. Nothing is
 * recorded on the desk road: the app cannot know the message was sent.
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
  const [busy, setBusy] = useState(false)
  const file = useRef<File | null>(null)
  const router = useRouter()

  // The photo is fetched as soon as the button renders, not on tap: a share
  // sheet or a download must happen inside the tap's activation window.
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

  const sharePhone = async () => {
    const data: ShareData =
      file.current && typeof navigator.canShare === "function" && navigator.canShare({ files: [file.current] })
        ? { text, files: [file.current] }
        : { text }
    try {
      await navigator.share(data)
    } catch (error) {
      if ((error as Error).name === "AbortError") return
      toast.error("Share sheet tidak bisa dibuka. Coba lagi, atau salin teksnya dari laporan.")
      return
    }
    const result = await markReportShared(missionId)
    if (result.success) {
      onShared?.()
      router.refresh()
    }
  }

  const shareDesk = async () => {
    // Inside the click, before anything waits: Safari refuses a clipboard
    // write or a download that comes later.
    let copied = true
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      copied = false
    }
    const downloaded = file.current ? downloadFile(file.current) : false
    const photoHint = photo ? (downloaded ? " Seret foto yang baru diunduh ke chat." : " Foto: unduh dari galeri di bawah.") : ""

    const remembered = readDeskRoad()
    if (remembered === "web") {
      openWeb(text)
      toast.success(`WhatsApp Web dibuka dengan teks laporan terisi.${photoHint}`, { duration: 8000 })
      return
    }

    // A blank tab is opened now, inside the click, so that the fallback two
    // seconds later cannot be stopped by the popup blocker. It closes unused.
    const spare = remembered === "app" ? null : window.open("", "_blank")
    const opened = await probeDesktopApp(text)
    if (opened) {
      spare?.close()
      rememberDeskRoad("app")
      toast.success(`WhatsApp di komputer ini dibuka dengan teks laporan terisi.${photoHint}`, { duration: 8000 })
      return
    }
    rememberDeskRoad("web")
    if (spare && !spare.closed) spare.location.href = webUrl(text)
    else openWeb(text)
    toast.info(`WhatsApp desktop tidak terpasang di komputer ini, jadi dibuka WhatsApp Web. Teks laporan sudah terisi${copied ? " dan tersalin" : ""}.${photoHint}`, { duration: 10000 })
  }

  const share = async () => {
    setBusy(true)
    try {
      if (isPhoneOrTablet() && typeof navigator.share === "function") await sharePhone()
      else await shareDesk()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button variant={variant} size={size} className={cn(className)} onClick={share} disabled={busy}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share className="h-4 w-4" />} {busy ? "Membuka WhatsApp…" : "Bagikan ke WhatsApp"}
    </Button>
  )
}

/** A phone or a tablet, iPad included although Safari there calls itself a Mac. */
function isPhoneOrTablet(): boolean {
  const ua = navigator.userAgent
  if (/Android|iPhone|iPod|Windows Phone|Mobile/i.test(ua)) return true
  return /Macintosh|iPad/i.test(ua) && navigator.maxTouchPoints > 1
}

const ROAD_KEY = "whatsapp-desk-road"

function readDeskRoad(): "app" | "web" | null {
  try {
    const value = window.localStorage.getItem(ROAD_KEY)
    return value === "app" || value === "web" ? value : null
  } catch {
    return null
  }
}

function rememberDeskRoad(road: "app" | "web") {
  try {
    window.localStorage.setItem(ROAD_KEY, road)
  } catch {
    // Without storage the probe simply runs every time.
  }
}

const webUrl = (text: string) => `https://web.whatsapp.com/send?text=${encodeURIComponent(text)}`

function openWeb(text: string) {
  window.open(webUrl(text), "_blank", "noopener")
}

/**
 * Try the desktop app through its link and watch whether the page loses
 * focus: the app taking the screen is the only signal a page gets. An
 * invisible frame carries the link so the page itself never navigates.
 */
function probeDesktopApp(text: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (opened: boolean) => {
      if (settled) return
      settled = true
      window.removeEventListener("blur", onAway)
      document.removeEventListener("visibilitychange", onAway)
      window.clearTimeout(timer)
      frame.remove()
      resolve(opened)
    }
    const onAway = () => finish(true)
    window.addEventListener("blur", onAway)
    document.addEventListener("visibilitychange", onAway)
    const frame = document.createElement("iframe")
    frame.style.display = "none"
    frame.src = `whatsapp://send?text=${encodeURIComponent(text)}`
    document.body.appendChild(frame)
    const timer = window.setTimeout(() => finish(false), 2500)
  })
}

/** Save a file through a link click; the object URL is released once the click has been handled. */
function downloadFile(file: File): boolean {
  try {
    const url = URL.createObjectURL(file)
    const link = document.createElement("a")
    link.href = url
    link.download = file.name
    link.rel = "noopener"
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
    return true
  } catch {
    return false
  }
}
