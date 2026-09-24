"use client"

import { useCallback, type RefCallback, type RefObject } from "react"
import { attachEdgeFade } from "@/lib/ui/edge-fade"

/**
 * A ref for a row that scrolls sideways and carries the `edge-fade` class:
 * each edge fades while the row can still scroll that way, and neither when
 * it all fits (`lib/ui/edge-fade.ts`). Pass `ref` when the caller needs the
 * element too (the stage tabs centre their chosen tab through it).
 */
export function useEdgeFade<T extends HTMLElement>(ref?: RefObject<T | null>): RefCallback<T> {
    return useCallback(
        (el: T | null) => {
            if (ref) ref.current = el
            if (!el) return
            const detach = attachEdgeFade(el)
            return () => {
                detach()
                if (ref) ref.current = null
            }
        },
        [ref],
    )
}
