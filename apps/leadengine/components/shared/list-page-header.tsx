"use client"

/**
 * List page header — standard slot for entity directory pages.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ Title                                                    │
 *   │ subtitle ↗                                               │
 *   └──────────────────────────────────────────────────────────┘
 *
 * Sizing matches the modal `<SheetHeader>` pattern so the whole app
 * speaks the same typographic language.
 */

import * as React from "react"
import { cn } from "@/lib/utils"

interface ListPageHeaderProps {
    title: string
    subtitle?: string
    /** Right-aligned content slot (action buttons, badges). */
    actions?: React.ReactNode
    className?: string
}

export function ListPageHeader({ title, subtitle, actions, className }: ListPageHeaderProps) {
    return (
        <div className={cn("flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3", className)}>
            <div>
                <h1 className="text-xl font-semibold text-foreground tracking-tight">{title}</h1>
                {subtitle && (
                    <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
                )}
            </div>
            {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
    )
}
