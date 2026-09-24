"use client"

/**
 * The header of every page that is not a list (Settings and its pages, My
 * profile, the changelog): the same anatomy as `ListPageHeader`.
 *
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ Settings / AI                                            │  one 56dp row,
 *   │ Usage                                          [Action]  │  sticky
 *   ├──────────────────────────────────────────────────────────┤
 *   │ description, until dismissed (or a factual line)     ✕   │  scrolls away
 *   └──────────────────────────────────────────────────────────┘
 *
 * One row, level with the drawer's header, holds the 20px title and the
 * page's actions centred on it; on a derived page (anything under Settings
 * but Settings itself and My profile) its parent sits above the title inside
 * the same row as one small line of links, "Settings" or "Settings / AI",
 * because LeadEngine has no Back button. The page itself is not repeated
 * there: the title says it. The row stays at the top while the page scrolls
 * and gains its edge once content passes under it; its height and the
 * title's size never change. The line under it follows what it says: with
 * `intro` it teaches and closes for good with ✕ (`PageIntro`); without, it
 * states facts and always shows. The header block always ends 16px above the
 * content, whether or not a line shows.
 *
 * Below `lg` the phone shell's top app bar carries the title, and the
 * parent line becomes the bar's back arrow to the nearest parent (Sales
 * Activity hides its page title there the same way): the row keeps only
 * the actions, and is not drawn when there are none. The description
 * stays.
 */

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { PageIntro } from "@/components/shared/page-intro"
import { PageChrome } from "@/components/layout/page-chrome"
import { cn } from "@/lib/utils"

interface Breadcrumb {
    label: string
    href?: string
}

interface SettingsPageHeaderProps {
    title: string
    subtitle?: string
    /**
     * The subtitle only teaches: a `pageIntroKey(...)`, under which it is
     * dismissible and remembered per person. Without it the subtitle is
     * information and always shows.
     */
    intro?: string
    /**
     * The trail below Settings, the current page last ([{ label: "AI", href:
     * "/settings/ai" }, { label: "Usage" }]). The parent line is "Settings"
     * plus every crumb but the last; left out, the page is top-level and has
     * no parent line.
     */
    breadcrumbs?: Breadcrumb[]
    actions?: React.ReactNode
}

const SETTINGS_CRUMB: Breadcrumb = { label: "Settings", href: "/settings" }

export function SettingsPageHeader({ title, subtitle, intro, breadcrumbs, actions }: SettingsPageHeaderProps) {
    const [scrolled, setScrolled] = useState(false)
    const headerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleScroll = (e: Event) => {
            const target = e.target as Element | Document | null
            if (!target) return
            if (target !== document && target !== document.documentElement && target !== document.body) {
                if (headerRef.current && !target.contains(headerRef.current)) return
            }
            const top = (target instanceof Element && target !== document.documentElement && target !== document.body)
                ? target.scrollTop
                : (window.scrollY || document.documentElement.scrollTop || 0)
            setScrolled(top > 12)
        }
        window.addEventListener("scroll", handleScroll, true)
        return () => window.removeEventListener("scroll", handleScroll, true)
    }, [])

    const parents = breadcrumbs ? [SETTINGS_CRUMB, ...breadcrumbs.slice(0, -1)] : []
    // The phone's back arrow goes to the nearest parent with a page.
    const backHref = [...parents].reverse().find((crumb) => crumb.href)?.href

    return (
        <>
            <PageChrome title={title} backHref={backHref} />
            {/* The sticky part is this one row and nothing else. */}
            <div
                ref={headerRef}
                className={cn(
                    "sticky top-0 z-40 flex min-h-14 items-center justify-between gap-3 border-b bg-background px-4 py-1.5 transition-[border-color,box-shadow] duration-200 sm:px-6 lg:px-8",
                    scrolled ? "border-border shadow-sm" : "border-transparent",
                    !actions && "max-lg:hidden",
                )}
            >
                <div className="min-w-0 max-lg:hidden">
                    {parents.length > 0 && (
                        <nav aria-label="Breadcrumb">
                            <ol className="flex min-w-0 items-center gap-1 text-xs font-medium text-muted-foreground">
                                {parents.map((crumb, i) => (
                                    <li key={`${crumb.label}-${i}`} className="flex min-w-0 items-center gap-1">
                                        {i > 0 && <span aria-hidden>/</span>}
                                        {crumb.href ? (
                                            <Link href={crumb.href} className="truncate transition-colors hover:text-primary">
                                                {crumb.label}
                                            </Link>
                                        ) : (
                                            <span className="truncate">{crumb.label}</span>
                                        )}
                                    </li>
                                ))}
                            </ol>
                        </nav>
                    )}
                    <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">{title}</h1>
                </div>
                {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
            </div>

            {/* Under the row, so it scrolls away; the 16px under it is always there.
                The 6px above keeps the ✕'s round target clear of the sticky row. */}
            <div className={cn("px-4 pb-4 sm:px-6 lg:px-8", !actions && "max-lg:pt-1.5")}>
                {subtitle && (intro ? (
                    <PageIntro hintKey={intro} className="pt-1.5">{subtitle}</PageIntro>
                ) : (
                    <p className="max-w-3xl pt-1.5 text-sm text-muted-foreground">{subtitle}</p>
                ))}
            </div>
        </>
    )
}
