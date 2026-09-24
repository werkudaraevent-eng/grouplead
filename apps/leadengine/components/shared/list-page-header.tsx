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
 * dismisses it, once for all their devices (`PageIntro`).
 *
 * Below `lg` the page hides this row (`max-lg:hidden` on its wrapper) and
 * the phone shell carries it: the title in the top app bar, the secondary
 * actions (`phoneMenu`: Export, Import) in the bar's overflow menu, the
 * primary one as a FAB, and no description, so the list opens on its
 * records rather than on its furniture (Sales Activity's "Content before
 * chrome on a phone"). Every other page's header (`SettingsPageHeader`) is
 * the same row, with a parent line above the title on a page under
 * Settings.
 */

import * as React from "react"
import { PageChrome, type ChromeMenuItem } from "@/components/layout/page-chrome"
import { PageIntro } from "./page-intro"

interface ListPageHeaderProps {
    title: string
    subtitle?: string
    /** The subtitle only teaches: dismissible, remembered per person under `key` (`listIntroKey`). */
    intro?: { key: string; seen: boolean }
    /** Right-aligned content slot (action buttons, badges). */
    actions?: React.ReactNode
    /** The secondary actions for the top app bar's overflow menu below `lg`. */
    phoneMenu?: ChromeMenuItem[]
    className?: string
}

export function ListPageHeader({ title, subtitle, intro, actions, phoneMenu, className }: ListPageHeaderProps) {
    return (
        <div className={className}>
            <PageChrome title={title} menu={phoneMenu} />
            <div className="flex min-h-14 items-center justify-between gap-3">
                <h1 className="min-w-0 truncate text-xl font-semibold text-foreground tracking-tight">{title}</h1>
                {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
            </div>
            {subtitle && (intro ? (
                <PageIntro hintKey={intro.key} seen={intro.seen}>{subtitle}</PageIntro>
            ) : (
                <p className="pb-1 text-sm text-muted-foreground">{subtitle}</p>
            ))}
        </div>
    )
}
