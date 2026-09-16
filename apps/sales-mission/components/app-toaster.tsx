"use client"

import { Toaster } from "sonner"
import { useCompact } from "@/hooks/use-compact"

/**
 * Snackbars sit where the thumb is. On a phone that is the bottom, above
 * the navigation bar; on a desk it is the top-right corner.
 */
export function AppToaster() {
  const compact = useCompact()
  return <Toaster richColors position={compact ? "bottom-center" : "top-right"} offset={compact ? 100 : 16} />
}
