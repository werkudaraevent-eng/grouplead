"use client"

import { useState, useEffect } from "react"

/**
 * Returns true after the component has mounted on the client.
 * Used to guard Recharts rendering (avoids SSR hydration mismatch).
 */
export function useHasMounted(): boolean {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  return mounted
}
