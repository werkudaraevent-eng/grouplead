"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowLeft, MoreVertical } from "@/components/icons"
import { usePageChrome } from "@/components/layout/page-chrome"
import { ResponsiveMenu } from "@/components/layout/responsive-menu"
import { fallbackTitle } from "@/lib/navigation/app-nav"

/**
 * Material's small top app bar, below `lg`: the page's title, "back" on a
 * page below another (a record, a page under Settings) where the desk shows
 * a back arrow or a parent link, and the page's overflow menu at the
 * trailing edge. The product mark stands in for "back" at a top
 * destination. Twin of Sales Activity's `MobileTopBar` (workspace-shell.tsx),
 * less the bell: LeadEngine has no notifications.
 *
 * 56dp plus the status bar's inset, in the shell's column above `<main>`,
 * so it never scrolls and everything that pins inside `<main>` (a list's
 * quick-return controls, a settings page's header row) pins right under it.
 * The page announces the title, the back target and the menu through
 * `PageChrome`; before it does, the title is the destination the address
 * is in.
 */
export function MobileTopBar() {
    const pathname = usePathname()
    const { title, backHref, menu } = usePageChrome()
    const heading = title ?? fallbackTitle(pathname)

    return (
        <header className="flex min-h-14 shrink-0 items-center gap-1 border-b bg-background/95 px-2 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
            {backHref ? (
                <Link href={backHref} aria-label="Back" className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-foreground transition-colors hover:bg-muted">
                    <ArrowLeft className="h-5 w-5" />
                </Link>
            ) : (
                // The collapsed drawer's mark: a desk and a phone show one product.
                <span className="ml-2 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground" aria-hidden="true">
                    W
                </span>
            )}
            <h1 className="min-w-0 flex-1 truncate px-2 text-[17px] font-semibold text-foreground">{heading}</h1>
            {/* A page's secondary actions: Material's top app bar keeps them
                behind one overflow menu. */}
            {menu && menu.length > 0 && (
                <ResponsiveMenu
                    title={heading}
                    items={menu}
                    trigger={
                        <button
                            type="button"
                            aria-label="Page menu"
                            className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-foreground transition-colors hover:bg-muted"
                        >
                            <MoreVertical className="h-5 w-5" />
                        </button>
                    }
                />
            )}
        </header>
    )
}
