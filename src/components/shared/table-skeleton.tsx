"use client"

/**
 * Skeleton table rows for list view loading states.
 *
 * Renders shimmering placeholder cells matching a column count, so the
 * user sees the table structure immediately rather than a centered
 * spinner over empty space.
 */

import * as React from "react"
import { TableCell, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

interface TableSkeletonProps {
    rows?: number
    columns: number
    className?: string
}

export function TableSkeleton({ rows = 6, columns, className }: TableSkeletonProps) {
    return (
        <>
            {Array.from({ length: rows }).map((_, rowIdx) => (
                <TableRow key={`skeleton-${rowIdx}`} className={cn("border-border", className)}>
                    {Array.from({ length: columns }).map((_, colIdx) => (
                        <TableCell key={`skeleton-${rowIdx}-${colIdx}`} className="px-4 py-3">
                            <div
                                className="h-3.5 rounded bg-muted/70 animate-pulse"
                                style={{ width: `${50 + ((rowIdx * 7 + colIdx * 11) % 40)}%` }}
                            />
                        </TableCell>
                    ))}
                </TableRow>
            ))}
        </>
    )
}
