"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { hasPreferenceCookie, writePreferenceCookie } from "@/lib/preference-cookie"

interface UseResizablePanelOptions {
    /** Storage key for persisting width */
    storageKey: string
    /** Default width in pixels */
    defaultWidth: number
    /** Width already known to the server (from a cookie), so the first render is right. */
    initialWidth?: number
    /** Also keep the width in a parent-domain cookie, so the server and the other app can read it. */
    syncCookie?: boolean
    /** Minimum width in pixels */
    minWidth: number
    /** Maximum width in pixels */
    maxWidth: number
    /** Callback when resizing starts */
    onResizeStart?: () => void
    /** Callback when resizing ends */
    onResizeEnd?: (width: number) => void
}

export function useResizablePanel({
    storageKey,
    defaultWidth,
    initialWidth,
    minWidth,
    maxWidth,
    onResizeStart,
    onResizeEnd,
    syncCookie = false,
}: UseResizablePanelOptions) {
    const [width, setWidth] = useState(initialWidth ?? defaultWidth)
    const [isResizing, setIsResizing] = useState(false)
    const startXRef = useRef(0)
    const startWidthRef = useRef(0)

    // Load persisted width on mount. Once a cookie carries it the server
    // already rendered the right width and localStorage is only history.
    useEffect(() => {
        if (syncCookie && hasPreferenceCookie(storageKey)) return
        const stored = localStorage.getItem(storageKey)
        if (stored) {
            const parsed = parseInt(stored, 10)
            if (!isNaN(parsed) && parsed >= minWidth && parsed <= maxWidth) {
                setWidth(parsed)
                if (syncCookie) writePreferenceCookie(storageKey, String(parsed))
            }
        }
    }, [storageKey, minWidth, maxWidth, syncCookie])

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsResizing(true)
        startXRef.current = e.clientX
        startWidthRef.current = width
        onResizeStart?.()
    }, [width, onResizeStart])

    useEffect(() => {
        if (!isResizing) return

        const handleMouseMove = (e: MouseEvent) => {
            const delta = e.clientX - startXRef.current
            const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidthRef.current + delta))
            setWidth(newWidth)
        }

        const handleMouseUp = () => {
            setIsResizing(false)
            localStorage.setItem(storageKey, String(width))
            if (syncCookie) writePreferenceCookie(storageKey, String(width))
            onResizeEnd?.(width)
        }

        document.addEventListener("mousemove", handleMouseMove)
        document.addEventListener("mouseup", handleMouseUp)
        // Prevent text selection during resize
        document.body.style.cursor = "col-resize"
        document.body.style.userSelect = "none"

        return () => {
            document.removeEventListener("mousemove", handleMouseMove)
            document.removeEventListener("mouseup", handleMouseUp)
            document.body.style.cursor = ""
            document.body.style.userSelect = ""
        }
    }, [isResizing, width, minWidth, maxWidth, storageKey, onResizeEnd, syncCookie])

    return {
        width,
        isResizing,
        handleMouseDown,
        setWidth,
    }
}
