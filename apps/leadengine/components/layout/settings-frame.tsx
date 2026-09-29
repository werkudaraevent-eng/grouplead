"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { usePermissions } from "@/contexts/permissions-context"
import { SETTINGS_HREF } from "@/lib/navigation/app-nav"
import { SETTINGS_GROUPS, activeSettingsItem, visibleSettingsGroups } from "@/lib/navigation/settings-nav"
import { cn } from "@/lib/utils"

/**
 * Every page under Settings sits in this frame (DESIGN.md "Settings layout
 * and page width"), the M3 list-detail layout that Linear's and GitHub's
 * settings use: from `lg` a fixed 248px menu of the settings pages on the
 * left, grouped as the Settings page groups them, and the page beside it in
 * a column of at most 880px plus the page's 32px gutters. A page that shows
 * a table or a matrix marks its root `data-settings-wide`, and the column
 * then fills the room beside the menu. The drawer stays; the menu is the
 * page's, not the app's, so it sits on the page's surface with a hairline
 * edge, and it stays in place while `<main>` scrolls the page.
 *
 * Below `lg` there is no menu: Settings is the list a phone opens, and each
 * page's top app bar carries the back arrow (`SettingsPageHeader`).
 */
export function SettingsFrame({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const { can, loading } = usePermissions()
    // Until the grants arrive, Account (everyone's) and placeholders.
    const groups = loading ? SETTINGS_GROUPS.filter((group) => group.everyone) : visibleSettingsGroups(can)
    const active = activeSettingsItem(pathname)
    const onIndex = pathname === SETTINGS_HREF
    const menuRef = useRef<HTMLElement>(null)

    // A long menu scrolls on its own; open it with the current page in view,
    // moving the menu's own scroller only.
    useEffect(() => {
        const menu = menuRef.current
        const current = menu?.querySelector<HTMLElement>("[data-active]")
        if (!menu || !current) return
        const top = current.offsetTop
        const bottom = top + current.offsetHeight
        if (top < menu.scrollTop || bottom > menu.scrollTop + menu.clientHeight) {
            menu.scrollTop = Math.max(0, top - (menu.clientHeight - current.offsetHeight) / 2)
        }
    }, [pathname, loading])

    return (
        <div className="lg:flex lg:items-start">
            <nav
                ref={menuRef}
                aria-label="Settings menu"
                className="thin-scrollbar hidden w-settings-menu shrink-0 flex-col overflow-y-auto border-r border-border bg-background px-3 pb-6 lg:sticky lg:top-0 lg:flex lg:h-dvh"
            >
                {/* Level with the drawer's header and the page's own 56dp row. */}
                <div className="flex min-h-14 shrink-0 items-center px-3">
                    <Link
                        href={SETTINGS_HREF}
                        aria-current={onIndex ? "page" : undefined}
                        className="truncate rounded-md text-lg font-semibold tracking-tight text-foreground outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        Settings
                    </Link>
                </div>
                {groups.map((group, index) => (
                    <div key={group.id} role="group" aria-labelledby={`settings-menu-${group.id}`} className={index === 0 ? "pt-1" : "pt-4"}>
                        <p id={`settings-menu-${group.id}`} className="px-3 pb-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                            {group.label}
                        </p>
                        <ul className="space-y-0.5">
                            {group.items.map((item) => {
                                const isActive = active?.href === item.href
                                return (
                                    <li key={item.href}>
                                        <Link
                                            href={item.href}
                                            data-active={isActive ? "" : undefined}
                                            aria-current={isActive ? (pathname === item.href ? "page" : "true") : undefined}
                                            className={cn(
                                                "flex min-h-9 items-center rounded-lg px-3 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                                                isActive
                                                    ? "bg-[var(--tonal)] text-[var(--tonal-foreground)]"
                                                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                                            )}
                                        >
                                            <span className="min-w-0 truncate">{item.title}</span>
                                        </Link>
                                    </li>
                                )
                            })}
                        </ul>
                    </div>
                ))}
                {loading && (
                    <div className="space-y-2 px-3 pt-4" aria-hidden="true">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="h-7 animate-pulse rounded-lg bg-muted" />
                        ))}
                    </div>
                )}
            </nav>
            <div
                data-settings-frame=""
                className="min-w-0 flex-1 lg:max-w-[calc(var(--container-settings)+4rem)] lg:has-[[data-settings-wide]]:max-w-none"
            >
                {children}
            </div>
        </div>
    )
}
