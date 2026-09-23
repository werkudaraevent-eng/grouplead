"use client"

/**
 * List page header — standard slot for entity directory pages.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ Title                              [Export] [Import] [+] │
 *   │ subtitle                                                 │
 *   └──────────────────────────────────────────────────────────┘
 *
 * Sizing matches the modal `<SheetHeader>` pattern so the whole app
 * speaks the same typographic language. On a phone the title and the
 * actions share one line and the subtitle, which only teaches what the
 * page is, is left out, so the list opens on its records rather than on
 * its furniture (Sales Activity's "Content before chrome on a phone").
 */

import * as React from "react"
import { MoreVertical } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
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
        <div className={cn("flex items-center justify-between gap-3 md:items-end", className)}>
            <div className="min-w-0">
                <h1 className="text-xl font-semibold text-foreground tracking-tight">{title}</h1>
                {subtitle && (
                    <p className="text-sm text-muted-foreground mt-1 hidden md:block">{subtitle}</p>
                )}
            </div>
            {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
    )
}

/**
 * The header's overflow on a phone: the secondary actions (Export, Import)
 * as menu items behind one ⋮, beside the primary action, which stays a
 * button (M3 top app bar overflow; Sales Activity's phone menus).
 */
export function HeaderOverflowMenu({ label = "More actions", children }: { label?: string; children: React.ReactNode }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="icon" className="h-11 w-11" aria-label={label}>
                    <MoreVertical className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                {children}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
