"use client"

/**
 * Pagination — page numbers with ellipsis + jump-to (modern Linear/Stripe style).
 *
 *   ┌───┬───┬───┬───┬───┬───┬───┐
 *   │ ← │ 1 │ … │ 6 │ 7 │ 8 │ … │ 18 │ → │
 *   └───┴───┴───┴───┴───┴───┴───┘
 *
 * Auto-collapses to ellipsis when total > 7 pages. Always shows first &
 * last. Active page is brand-themed.
 */

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface PaginationProps {
    currentPage: number
    totalPages: number
    onPageChange: (page: number) => void
    /** When provided, renders a compact size variant. */
    size?: "sm" | "md"
    className?: string
}

/**
 * Build the array of pages to render. Numbers are 1-indexed; "…" denotes
 * a gap. Examples (current = 1-indexed):
 *   total=5,  current=3  → [1, 2, 3, 4, 5]
 *   total=18, current=1  → [1, 2, 3, "…", 18]
 *   total=18, current=7  → [1, "…", 6, 7, 8, "…", 18]
 *   total=18, current=18 → [1, "…", 16, 17, 18]
 */
function buildRange(current: number, total: number): (number | "ellipsis")[] {
    if (total <= 7) {
        return Array.from({ length: total }, (_, i) => i + 1)
    }
    const pages: (number | "ellipsis")[] = []
    const left = Math.max(2, current - 1)
    const right = Math.min(total - 1, current + 1)

    pages.push(1)
    if (left > 2) pages.push("ellipsis")
    for (let i = left; i <= right; i++) pages.push(i)
    if (right < total - 1) pages.push("ellipsis")
    pages.push(total)
    return pages
}

export function Pagination({
    currentPage,
    totalPages,
    onPageChange,
    size = "md",
    className,
}: PaginationProps) {
    if (totalPages <= 1) return null

    const pages = buildRange(currentPage, totalPages)
    const buttonClass = size === "sm" ? "h-7 min-w-7 px-2 text-xs" : "h-8 min-w-8 px-2.5 text-sm"

    return (
        <div className={cn("flex items-center gap-1", className)} role="navigation" aria-label="Pagination">
            <Button
                variant="ghost"
                size="sm"
                onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
                disabled={currentPage === 1}
                className={cn(buttonClass, "px-2 text-muted-foreground")}
                aria-label="Previous page"
            >
                <ChevronLeft className="h-3.5 w-3.5" />
            </Button>

            {pages.map((p, idx) =>
                p === "ellipsis" ? (
                    <span key={`e-${idx}`} className={cn(buttonClass, "inline-flex items-center justify-center text-muted-foreground")}>
                        …
                    </span>
                ) : (
                    <Button
                        key={p}
                        variant={p === currentPage ? "default" : "ghost"}
                        size="sm"
                        onClick={() => onPageChange(p)}
                        className={cn(
                            buttonClass,
                            "font-medium",
                            p === currentPage
                                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                : "text-muted-foreground hover:text-foreground",
                        )}
                        aria-label={`Page ${p}`}
                        aria-current={p === currentPage ? "page" : undefined}
                    >
                        {p}
                    </Button>
                ),
            )}

            <Button
                variant="ghost"
                size="sm"
                onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
                disabled={currentPage === totalPages}
                className={cn(buttonClass, "px-2 text-muted-foreground")}
                aria-label="Next page"
            >
                <ChevronRight className="h-3.5 w-3.5" />
            </Button>
        </div>
    )
}
