"use client"

/**
 * The browser's install prompt, kept for the moment the person asks.
 *
 * Chrome (Android, desktop) fires `beforeinstallprompt` once the page is
 * installable; the event must be held and replayed from a user gesture.
 * Safari never fires it: iOS installs from the Share sheet, so the Pasang
 * page shows those steps instead.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

declare global {
  interface Window {
    __saInstallPrompt?: BeforeInstallPromptEvent | null
  }
}

export const INSTALLABLE_EVENT = "sa:installable"

export function captureInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault()
    window.__saInstallPrompt = event as BeforeInstallPromptEvent
    window.dispatchEvent(new Event(INSTALLABLE_EVENT))
  })
  window.addEventListener("appinstalled", () => {
    window.__saInstallPrompt = null
    window.dispatchEvent(new Event(INSTALLABLE_EVENT))
  })
}

export function canPromptInstall(): boolean {
  return typeof window !== "undefined" && Boolean(window.__saInstallPrompt)
}

export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const prompt = window.__saInstallPrompt
  if (!prompt) return "unavailable"
  await prompt.prompt()
  const { outcome } = await prompt.userChoice
  if (outcome === "accepted") window.__saInstallPrompt = null
  return outcome
}

export function isIos(): boolean {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent
  return /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
}
