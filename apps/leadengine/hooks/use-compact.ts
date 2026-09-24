"use client"

import { useSyncExternalStore } from "react"

/** Below Tailwind's `lg` (1024px). */
const BELOW_LG = "(max-width: 1023.98px)"

/** Below Tailwind's `md` (768px). */
const BELOW_MD = "(max-width: 767.98px)"

/** False on the server and during hydration, so the first HTML matches. */
function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener("change", onChange)
      return () => list.removeEventListener("change", onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/**
 * Whether the window is below `lg`, where LeadEngine's shell drops the
 * drawer for the phone shell (top app bar, navigation bar): phones and
 * small tablets. Surfaces that are a dialog on a desk become a bottom sheet
 * here (M3: modal bottom sheet in a compact window).
 *
 * False on the server and during hydration, so the first HTML matches;
 * anything that must be right in that HTML uses CSS breakpoints instead.
 */
export function useCompact(): boolean {
  return useMedia(BELOW_LG)
}

/**
 * Whether the window is below `md`, a phone held upright, where a menu
 * becomes a bottom sheet of 56dp rows (`ResponsiveMenu`; Sales Activity's
 * own `useCompact` draws this same line). Between `md` and `lg` the phone
 * shell is still drawn, but a pointer-sized menu fits.
 */
export function useBelowMd(): boolean {
  return useMedia(BELOW_MD)
}
