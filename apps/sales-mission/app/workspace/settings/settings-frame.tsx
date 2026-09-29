"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"
import { PageChrome } from "@/components/page-chrome"
import { activeSettingsItem, settingsBackHref, visibleSettingsGroups } from "@/lib/settings/settings-nav"
import { paths } from "@/lib/paths"
import { cn } from "@/lib/utils"

/**
 * Every page under Pengaturan sits in this frame (DESIGN.md "Settings
 * layout and page width"), the M3 list-detail layout that Linear's and
 * GitHub's settings use: from `lg` a fixed 248px menu of the settings
 * pages on the left, grouped as the Pengaturan page groups them, and the
 * page beside it in a column of at most 880px (`WorkspacePage` reads
 * `data-settings-frame`; a page that shows a table or a matrix asks for
 * the full width with `wide`). The drawer stays; the menu is the page's,
 * not the app's, so it sits on the page's surface with a hairline edge.
 *
 * Below `lg` there is no menu: Pengaturan is the list a phone opens, and a
 * settings page carries the top app bar's back arrow to it (or to the item
 * it sits below), announced here once for every settings page.
 */
export function SettingsFrame({ canOpenSettings, children }: { canOpenSettings: boolean; children: React.ReactNode }) {
  const pathname = usePathname()
  const groups = visibleSettingsGroups(canOpenSettings)
  const active = activeSettingsItem(pathname)
  const back = settingsBackHref(pathname)
  const onIndex = pathname === paths.settings.index
  const menuRef = useRef<HTMLElement>(null)

  // A long menu scrolls on its own; open it with the current page in view.
  // The menu's own scroller only (never scrollIntoView, which would move the
  // shell as well).
  useEffect(() => {
    const menu = menuRef.current
    const current = menu?.querySelector<HTMLElement>("[data-active]")
    if (!menu || !current) return
    const top = current.offsetTop
    const bottom = top + current.offsetHeight
    if (top < menu.scrollTop || bottom > menu.scrollTop + menu.clientHeight) {
      menu.scrollTop = Math.max(0, top - (menu.clientHeight - current.offsetHeight) / 2)
    }
  }, [pathname])

  return (
    <div className="flex h-full w-full min-w-0">
      {back && <PageChrome backHref={back} />}
      <nav
        ref={menuRef}
        aria-label="Menu pengaturan"
        className="thin-scrollbar hidden h-full w-settings-menu shrink-0 flex-col overflow-y-auto border-r bg-background px-3 pb-6 lg:flex"
      >
        {/* Level with the drawer's header and the page's own 56dp row. */}
        <div className="flex min-h-14 shrink-0 items-center px-3">
          <Link
            href={paths.settings.index}
            aria-current={onIndex ? "page" : undefined}
            className="truncate rounded-md text-lg font-semibold tracking-tight text-foreground outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
          >
            Pengaturan
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
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
      </nav>
      <div data-settings-frame="" className="h-full min-w-0 flex-1">
        {children}
      </div>
    </div>
  )
}
