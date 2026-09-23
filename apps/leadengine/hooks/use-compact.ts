"use client"

import { useSyncExternalStore } from "react"

/**
 * Whether the window is below Tailwind's `lg` (1024px), where LeadEngine's
 * shell drops the sidebar for the menu button: phones and small tablets.
 * Surfaces that are a dialog on a desk become a bottom sheet here (M3: modal
 * bottom sheet in a compact window).
 *
 * False on the server and during hydration, so the first HTML matches;
 * anything that must be right in that HTML uses CSS breakpoints instead.
 */
const QUERY = "(max-width: 1023.98px)"

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(QUERY)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

export function useCompact(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  )
}
