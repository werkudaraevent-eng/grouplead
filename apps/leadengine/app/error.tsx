"use client"

import { useEffect } from "react"
import { AlertTriangle, RotateCcw } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { STALE_COPY, staleKind } from "@/lib/deploy/stale-client"

/**
 * A tab from the previous build (an action the new server does not have, a
 * file the new build does not serve) gets its own words and a full reload
 * instead of "Try again": `reset()` re-renders the same old code, which
 * fails the same way. The lead form and the composer keep their drafts in
 * this browser and give them back (DESIGN.md, "Surviving a deploy").
 */
export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error("[RouteError]", error)
    }, [error])

    if (staleKind(error) !== null) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
                <div className="w-16 h-16 rounded-2xl bg-[var(--tonal)] text-[var(--tonal-foreground)] flex items-center justify-center">
                    <RotateCcw className="w-8 h-8" />
                </div>
                <div>
                    <h1 className="text-2xl font-extrabold text-foreground tracking-tight">{STALE_COPY.screenTitle}</h1>
                    <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">{STALE_COPY.screenBody}</p>
                </div>
                <Button onClick={() => window.location.reload()} className="mt-2 gap-2">
                    <RotateCcw className="w-4 h-4" /> {STALE_COPY.reload}
                </Button>
            </div>
        )
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <div>
                <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Something went wrong</h1>
                <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">
                    An unexpected error occurred. Please try again.
                </p>
            </div>
            <Button onClick={reset} variant="outline" className="mt-2 gap-2">
                <RotateCcw className="w-4 h-4" /> Try again
            </Button>
        </div>
    )
}
