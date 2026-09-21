"use client"

import { Toaster } from "sonner"
import { useCompact } from "@/hooks/use-compact"

/**
 * Snackbars sit at the bottom, where M3 puts them: centred above the
 * navigation bar on a phone, left-aligned on a desk (M3: on larger screens
 * a snackbar is left- or centre-aligned at the bottom, never a corner at
 * the top, which is where notification libraries put them by habit).
 */
export function AppToaster() {
  const compact = useCompact()
  return <Toaster richColors position={compact ? "bottom-center" : "bottom-left"} offset={compact ? 100 : 24} />
}
