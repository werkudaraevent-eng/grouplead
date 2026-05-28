"use client"

/**
 * Bulk action bar — floating bottom-center pill that appears when the
 * user selects rows in a list view (Linear / Notion / Attio pattern).
 *
 *   Visual:
 *     ┌──────────────────────────────────────────────────────┐
 *     │  3 selected  ·  Delete  ·  Assign owner  ·  Cancel   │
 *     └──────────────────────────────────────────────────────┘
 *
 * Mounted via portal-like absolute positioning at the bottom of the
 * scrolling container. Receives a count + a children slot for actions.
 */

import * as React from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface BulkActionBarProps {
    count: number
    onClear: () => void
    /** Action buttons rendered to the right of the count. */
    children?: React.ReactNode
    /** Labels — defaults are sensible. */
    countLabel?: (count: number) => string
    className?: string
}

export function BulkActionBar({
    count,
    onClear,
    children,
    countLabel = (n) => `${n} selected`,
    className,
}: BulkActionBarProps) {
    if (count === 0) return null

    return (
        <div
            className={cn(
                "fixed left-1/2 -translate-x-1/2 z-50 bottom-6",
                "animate-in fade-in slide-in-from-bottom-4 duration-200",
                className,
            )}
        >
            <div className="flex items-center gap-1 rounded-full border border-border bg-foreground text-background shadow-2xl pl-4 pr-1.5 py-1.5">
                <span className="text-[13px] font-medium pr-1">{countLabel(count)}</span>
                <span className="h-4 w-px bg-background/20 mx-1" aria-hidden />
                {children}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClear}
                    className="h-7 px-2 text-background/80 hover:text-background hover:bg-background/10 ml-1"
                    aria-label="Clear selection"
                >
                    <X className="h-3.5 w-3.5" />
                </Button>
            </div>
        </div>
    )
}
