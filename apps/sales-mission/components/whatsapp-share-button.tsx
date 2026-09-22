"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2, Share } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * "Bagikan ke WhatsApp": the two roads, once, for anything the app can
 * hand to a chat.
 *
 * The roads are chosen by the device rather than by what the browser
 * offers, because Chrome, Edge and Brave on Windows 11 offer the Web Share
 * API too and open the Windows share sheet, which lists Outlook contacts
 * and a "WhatsApp · Install" tile and leads nowhere useful.
 *
 * Phone or tablet: the share sheet with the text (and a file when the
 * caller has one); the person picks the group.
 *
 * Desk: the text is copied, a file downloaded under a tidy name, and
 * WhatsApp desktop is tried through its whatsapp:// link, the way Zoom and
 * Slack open their apps. A page cannot ask which apps are installed; it
 * can only try and watch: when the page loses focus within a moment, the
 * app opened. When nothing happens, WhatsApp Web opens instead and the
 * toast says why. The answer is remembered per browser so the next click
 * goes straight there. Neither desk road can carry a file (both accept
 * text only), so it is downloaded to be dragged into the chat.
 *
 * What is shared, and what is recorded afterwards, belongs to the caller:
 * a sent report marks itself as shared and explains the web road in a
 * banner, the daily brief does neither.
 */
export function WhatsAppShareButton({
  text,
  getFile,
  label = "Bagikan ke WhatsApp",
  busyLabel = "Membuka WhatsApp…",
  variant = "outline",
  size = "sm",
  className,
  onPhoneShared,
  onDeskWeb,
  blockedHint = "Coba lagi.",
}: {
  /** The message. Read inside the click, so a caller may recompute it. */
  text: string | (() => string)
  /** A file to carry along, already fetched: a share sheet or a download must happen inside the tap. */
  getFile?: () => File | null
  label?: string
  busyLabel?: string
  variant?: "outline" | "default" | "ghost"
  size?: "sm" | "default"
  className?: string
  /** Ran after a completed share sheet on a phone. */
  onPhoneShared?: () => void | Promise<void>
  /** Told about the WhatsApp Web road, for a caller that explains it in a banner. */
  onDeskWeb?: (detail: { url: string; opened: boolean }) => void
  /** What to say when the browser held the new tab back; the caller knows where its own fallback button is. */
  blockedHint?: string
}) {
  const [busy, setBusy] = useState(false)

  const share = async () => {
    const message = typeof text === "function" ? text() : text
    const file = getFile?.() ?? null
    setBusy(true)
    try {
      if (isPhoneOrTablet() && typeof navigator.share === "function") await sharePhone(message, file, onPhoneShared)
      else await shareDesk(message, file, { onDeskWeb, blockedHint })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button type="button" variant={variant} size={size} className={cn(className)} onClick={share} disabled={busy}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share className="h-4 w-4" />} {busy ? busyLabel : label}
    </Button>
  )
}

async function sharePhone(text: string, file: File | null, onShared?: () => void | Promise<void>) {
  const data: ShareData = file && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] }) ? { text, files: [file] } : { text }
  try {
    await navigator.share(data)
  } catch (error) {
    if ((error as Error).name === "AbortError") return
    toast.error("Share sheet tidak bisa dibuka. Coba lagi, atau salin teksnya dari halaman.")
    return
  }
  await onShared?.()
}

async function shareDesk(
  text: string,
  file: File | null,
  { onDeskWeb, blockedHint }: { onDeskWeb?: (detail: { url: string; opened: boolean }) => void; blockedHint: string }
) {
  // Inside the click, before anything waits: Safari refuses a clipboard
  // write that comes later. Nothing here may steal the window's focus
  // before the probe, or the probe would read that as the app opening.
  let copied = true
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    copied = false
  }
  const remembered = readDeskRoad()
  if (remembered !== "web") {
    const opened = await probeDesktopApp(text)
    if (opened) {
      rememberDeskRoad("app")
      const downloaded = file ? downloadFile(file) : false
      toast.success(downloaded ? "WhatsApp dibuka. Seret foto yang baru diunduh ke chat." : "WhatsApp dibuka dengan teksnya.")
      return
    }
  }

  // No desktop app: WhatsApp Web. The tab is opened after the probe, still
  // inside the click's activation window on most browsers; Brave holds it
  // anyway, which is what the caller's banner is for.
  rememberDeskRoad("web")
  const tab = window.open(webUrl(text), "_blank", "noopener")
  const downloaded = file ? downloadFile(file) : false
  if (!tab || remembered !== "web") onDeskWeb?.({ url: webUrl(text), opened: Boolean(tab) })
  const facts = [copied ? "Teks tersalin" : null, downloaded ? "foto diunduh" : null].filter(Boolean).join(", ")
  const sentence = facts ? `${facts[0].toUpperCase()}${facts.slice(1)}.` : ""
  toast.success(
    tab
      ? `WhatsApp Web dibuka.${sentence ? ` ${sentence}` : ""}`
      : sentence
        ? `${sentence} ${blockedHint}`
        : blockedHint
  )
}

/** A phone or a tablet, iPad included although Safari there calls itself a Mac. */
export function isPhoneOrTablet(): boolean {
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

/**
 * Try the desktop app through its link and watch whether the page loses
 * focus: the app taking the screen is the only signal a page gets. An
 * invisible frame carries the link so the page itself never navigates.
 */
function probeDesktopApp(text: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!document.hasFocus()) {
      // The page is not the front window (a download shelf, another app);
      // a blur could not be read as the app opening, so do not guess.
      resolve(false)
      return
    }
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
