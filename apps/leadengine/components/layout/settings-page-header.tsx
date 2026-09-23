"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface Breadcrumb {
    label: string
    href?: string
}

interface SettingsPageHeaderProps {
    title: string
    subtitle?: string
    breadcrumbs?: Breadcrumb[]
    actions?: React.ReactNode
}

export function SettingsPageHeader({ title, subtitle, breadcrumbs, actions }: SettingsPageHeaderProps) {
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

    const defaultBreadcrumbs: Breadcrumb[] = [{ label: "Settings", href: "/settings" }]
    const allCrumbs = breadcrumbs ? [...defaultBreadcrumbs, ...breadcrumbs] : defaultBreadcrumbs

    return (
        <>
            {/* Sticky header */}
            <div
                ref={headerRef}
                className={cn(
                    "sticky top-0 z-40 bg-white px-4 sm:px-6 lg:px-8 transition-all duration-200",
                    scrolled ? "py-3 border-b border-border shadow-sm" : "pt-6 pb-3 border-b border-transparent",
                )}
            >
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <h1 className={cn(
                            "font-extrabold text-foreground tracking-tight transition-all duration-200 m-0",
                            scrolled ? "text-[17px]" : "text-2xl",
                        )}>
                            {title}
                        </h1>
                        {/* Collapses on scroll by animating the grid row from
                            its content height to 0, never to a fixed height: a
                            fixed 20px box clipped the descenders under the 4px
                            top margin and cut a subtitle that wraps on a phone
                            down to its first line. */}
                        {subtitle && (
                            <div className={cn(
                                "grid transition-[grid-template-rows,opacity] duration-200",
                                scrolled ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100",
                            )}>
                                <div className="min-h-0 overflow-hidden">
                                    <p className="pt-1 text-sm leading-5 text-muted-foreground">{subtitle}</p>
                                </div>
                            </div>
                        )}
                    </div>
                    {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
                </div>
            </div>

            {/* Breadcrumb */}
            {allCrumbs.length > 1 && (
                <nav className="px-4 sm:px-6 lg:px-8 pt-2 pb-4 flex items-center gap-1.5 text-[11.5px]">
                    {allCrumbs.map((crumb, i) => (
                        <span key={i} className="flex items-center gap-1.5">
                            {i > 0 && <span className="text-slate-300">/</span>}
                            {crumb.href && i < allCrumbs.length - 1 ? (
                                <Link
                                    href={crumb.href}
                                    className="text-muted-foreground font-medium hover:text-primary transition-colors duration-100"
                                >
                                    {crumb.label}
                                </Link>
                            ) : (
                                <span className="text-slate-700 font-semibold">{crumb.label}</span>
                            )}
                        </span>
                    ))}
                </nav>
            )}
        </>
    )
}
