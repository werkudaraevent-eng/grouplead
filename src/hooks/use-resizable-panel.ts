"use client"

import { useCallback, useEffect, useRef, useState } from "react"

interface UseResizablePanelOptions {
    /** Storage key for persisting width */
    storageKey: string
    /** Default width in pixels */
    defaultWidth: number
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
    minWidth,
    maxWidth,
    onResizeStart,
    onResizeEnd,
}: UseResizablePanelOptions) {
    const [width, setWidth] = useState(defaultWidth)
    const [isResizing, setIsResizing] = useState(false)
    const startXRef = useRef(0)
    const startWidthRef = useRef(0)

    // Load persisted width on mount
    useEffect(() => {
        const stored = localStorage.getItem(storageKey)
        if (stored) {
            const parsed = parseInt(stored, 10)
            if (!isNaN(parsed) && parsed >= minWidth && parsed <= maxWidth) {
                setWidth(parsed)
            }
        }
    }, [storageKey, minWidth, maxWidth])

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
    }, [isResizing, width, minWidth, maxWidth, storageKey, onResizeEnd])

    return {
        width,
        isResizing,
        handleMouseDown,
        setWidth,
    }
}
