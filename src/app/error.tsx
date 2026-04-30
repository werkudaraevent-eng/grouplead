"use client"

import { useEffect } from "react"
import { AlertTriangle, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

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
