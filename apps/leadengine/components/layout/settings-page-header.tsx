"use client"

/**
 * The header of every page that is not a list (Settings and its pages, the
 * changelog): the same anatomy as `ListPageHeader`.
 *
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ Usage                                          [Action]  │  one 56dp row,
 *   ├──────────────────────────────────────────────────────────┤  sticky
 *   │ description, until dismissed (or a factual line)     ✕   │  scrolls away
 *   └──────────────────────────────────────────────────────────┘
 *
 * One row, level with the drawer's header, holds the 20px title and the
 * page's actions centred on it. Nothing sits above the title: a page under
 * Settings is in the settings frame, whose menu beside it names where the
 * page is (its row stays active on the pages below it, a pipeline's or a
 * goal's) and is the way back (DESIGN.md "Settings layout and page width").
 * The row stays at the top while the page scrolls and gains its edge once
 * content passes under it; its height and the title's size never change.
 * The line under it follows what it says: with `intro` it teaches and
 * closes for good with ✕ (`PageIntro`); without, it states facts and
 * always shows. The header block always ends 16px above the content,
 * whether or not a line shows.
 *
 * Below `lg` the phone shell's top app bar carries the title, and
 * `breadcrumbs` become the bar's back arrow to the nearest parent with a
 * page (Sales Activity hides its page title there the same way): the row
 * keeps only the actions, and is not drawn when there are none. The
 * description stays.
 */

import { useEffect, useRef, useState } from "react"
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
     * "/settings/ai" }, { label: "Usage" }]). It is drawn nowhere: on a phone
     * the top app bar's back arrow goes to the nearest parent with a page
     * ("Settings" for a page in the menu, AI for AI's usage); on a desk the
     * settings menu says where the page is. Left out, the page is top-level
     * and has no back arrow.
     */
    breadcrumbs?: Breadcrumb[]
    actions?: React.ReactNode
    /**
     * Whether `actions` also show on a phone. A page's one action that sits
     * under its content on a phone (Active devices' "Sign out of all other
     * devices", full width, where the thumb is) keeps to the desk's header
     * here, as Sales Activity's `phoneAction` does.
     */
    phoneActions?: boolean
}

const SETTINGS_CRUMB: Breadcrumb = { label: "Settings", href: "/settings" }

export function SettingsPageHeader({ title, subtitle, intro, breadcrumbs, actions, phoneActions = true }: SettingsPageHeaderProps) {
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
                    (!actions || !phoneActions) && "max-lg:hidden",
                )}
            >
                <div className="min-w-0 max-lg:hidden">
                    <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">{title}</h1>
                </div>
                {actions && <div className={cn("flex shrink-0 items-center gap-2", !phoneActions && "max-lg:hidden")}>{actions}</div>}
            </div>

            {/* Under the row, so it scrolls away; the 16px under it is always there.
                The 6px above keeps the ✕'s round target clear of the sticky row. */}
            <div className={cn("px-4 pb-4 sm:px-6 lg:px-8", (!actions || !phoneActions) && "max-lg:pt-1.5")}>
                {subtitle && (intro ? (
                    <PageIntro hintKey={intro} className="pt-1.5">{subtitle}</PageIntro>
                ) : (
                    <p className="max-w-3xl pt-1.5 text-sm text-muted-foreground">{subtitle}</p>
                ))}
            </div>
        </>
    )
}
