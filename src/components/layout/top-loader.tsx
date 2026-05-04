"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { usePathname, useSearchParams } from "next/navigation"

/**
 * NProgress-style top loading bar.
 * Pure CSS animation — no external dependencies.
 * Shows during Next.js page transitions (route changes).
 */
export function TopLoader({ color = "#02378D" }: { color?: string }) {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [progress, setProgress] = useState(0)
    const [visible, setVisible] = useState(false)
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const prevUrl = useRef("")

    const start = useCallback(() => {
        setVisible(true)
        setProgress(0)

        // Rapid initial progress, then slow trickle
        let p = 0
        timerRef.current = setInterval(() => {
            p += p < 30 ? 8 : p < 60 ? 3 : p < 80 ? 1 : 0.5
            if (p > 90) p = 90 // Never reach 100 until done
            setProgress(p)
        }, 100)
    }, [])

    const done = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
        }
        setProgress(100)
        // Fade out after reaching 100%
        setTimeout(() => {
            setVisible(false)
            setProgress(0)
        }, 300)
    }, [])

    // Detect route changes
    useEffect(() => {
        const url = pathname + searchParams.toString()
        if (prevUrl.current && prevUrl.current !== url) {
            done()
        }
        prevUrl.current = url
    }, [pathname, searchParams, done])

    // Intercept link clicks to start the bar before navigation
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            const target = (e.target as HTMLElement).closest("a")
            if (!target) return
            const href = target.getAttribute("href")
            if (!href || href.startsWith("#") || href.startsWith("http") || href.startsWith("mailto:")) return
            if (target.getAttribute("target") === "_blank") return
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return

            const currentUrl = pathname + searchParams.toString()
            if (href !== currentUrl && href !== pathname) {
                start()
            }
        }

        document.addEventListener("click", handleClick, { capture: true })
        return () => document.removeEventListener("click", handleClick, { capture: true })
    }, [pathname, searchParams, start])

    if (!visible && progress === 0) return null

    return (
        <div
            role="progressbar"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                height: 3,
                zIndex: 9999,
                pointerEvents: "none",
                opacity: visible ? 1 : 0,
                transition: "opacity 300ms ease-out",
            }}
        >
            <div
                style={{
                    height: "100%",
                    width: `${progress}%`,
                    background: color,
                    transition: progress === 0
                        ? "none"
                        : progress === 100
                            ? "width 200ms ease-out"
                            : "width 400ms ease",
                    boxShadow: `0 0 8px ${color}80, 0 0 2px ${color}40`,
                }}
            />
        </div>
    )
}
