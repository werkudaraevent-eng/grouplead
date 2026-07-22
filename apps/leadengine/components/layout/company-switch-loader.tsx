"use client"

import { useEffect, useRef, useState } from "react"
import { useCompany } from "@/contexts/company-context"

/**
 * Top progress bar shown specifically while the company/unit switcher is
 * re-fetching scoped server data. The generic <TopLoader /> only reacts to URL
 * changes, but switching units calls router.refresh() (same URL), so it never
 * fires. This component watches the company context's `isSwitching` transition
 * flag and drives an identical NProgress-style bar — accurate start/finish,
 * no guessed timers.
 */
export function CompanySwitchLoader({ color = "#02378D" }: { color?: string }) {
    const { isSwitching } = useCompany()
    const [progress, setProgress] = useState(0)
    const [visible, setVisible] = useState(false)
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

    useEffect(() => {
        if (isSwitching) {
            setVisible(true)
            setProgress(0)
            let p = 0
            timerRef.current = setInterval(() => {
                p += p < 30 ? 8 : p < 60 ? 3 : p < 80 ? 1 : 0.5
                if (p > 90) p = 90 // never complete until the transition resolves
                setProgress(p)
            }, 100)
        } else {
            if (timerRef.current) {
                clearInterval(timerRef.current)
                timerRef.current = null
            }
            // Only animate to 100% if we were actually showing the bar.
            setProgress((prev) => (prev > 0 ? 100 : 0))
            const t = setTimeout(() => {
                setVisible(false)
                setProgress(0)
            }, 300)
            return () => clearTimeout(t)
        }

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current)
                timerRef.current = null
            }
        }
    }, [isSwitching])

    if (!visible && progress === 0) return null

    return (
        <div
            role="progressbar"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Switching unit"
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
