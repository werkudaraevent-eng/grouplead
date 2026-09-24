"use client"

/**
 * List page header — standard slot for entity directory pages.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ Title                              [Export] [Import] [+] │  one 56dp row
 *   │ description, until dismissed                         ✕   │
 *   └──────────────────────────────────────────────────────────┘
 *
 * One compact row, level with the drawer's header: the 20px title and the
 * page's actions centred on it, with no padding above beyond the row's
 * own, because every pixel above the table is a row of records fewer
 * (Sales Activity's list header is the same row). The description only
 * teaches what the list is, so with `intro` it shows until the person
 * dismisses it, once for all their devices (`ListIntro`). On a phone the
 * title and the actions share the row and the description is left out, so
 * the list opens on its records rather than on its furniture (Sales
 * Activity's "Content before chrome on a phone").
 */

import * as React from "react"
import { MoreVertical } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ListIntro } from "./list-intro"

interface ListPageHeaderProps {
    title: string
    subtitle?: string
    /** The subtitle only teaches: dismissible, remembered per person under `key` (`listIntroKey`). */
    intro?: { key: string; seen: boolean }
    /** Right-aligned content slot (action buttons, badges). */
    actions?: React.ReactNode
    className?: string
}

export function ListPageHeader({ title, subtitle, intro, actions, className }: ListPageHeaderProps) {
    return (
        <div className={className}>
            <div className="flex min-h-14 items-center justify-between gap-3">
                <h1 className="min-w-0 truncate text-xl font-semibold text-foreground tracking-tight">{title}</h1>
                {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
            </div>
            {subtitle && (intro ? (
                <ListIntro hintKey={intro.key} seen={intro.seen} className="hidden md:flex">{subtitle}</ListIntro>
            ) : (
                <p className="hidden pb-1 text-sm text-muted-foreground md:block">{subtitle}</p>
            ))}
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
