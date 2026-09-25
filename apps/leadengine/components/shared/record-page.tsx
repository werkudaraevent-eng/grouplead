"use client"

import { useRef, type KeyboardEvent, type MouseEvent } from "react"
import { useEdgeFade } from "@/hooks/use-edge-fade"
import { cn } from "@/lib/utils"

/**
 * The parts of a record's page (a contact today; a company and a lead are
 * to follow) laid out on Zoho CRM's record page with M3's rules: primary
 * tabs for the record's views, and on its Overview a related-list rail on
 * a desk (a chip row on a phone) that jumps to each section of one scroll.
 * See DESIGN.md, "Record pages".
 */

export interface RecordTab<T extends string> {
    id: T
    label: string
}

/**
 * M3 primary tabs: the record's sibling views (Overview, Timeline), 48dp,
 * sentence case, the 3dp indicator under the label of the one shown, as
 * wide as the label (Sales Activity's Laporan tabs). Each fills an equal share of the row below `lg`, where M3
 * gives a phone fixed tabs; from `lg` they sit at the row's leading edge.
 * The caller pins the row (`sticky`, opaque). Arrow keys, Home and End move
 * between them and choose, the focus following without a scroll.
 */
export function RecordTabs<T extends string>({
    tabs,
    value,
    onChange,
    label,
    idPrefix,
    className,
    ref,
}: {
    tabs: readonly RecordTab<T>[]
    value: T
    onChange: (next: T) => void
    label: string
    /** Ties each tab to its panel: `${idPrefix}-tab-${id}` controls `${idPrefix}-panel-${id}`. */
    idPrefix: string
    className?: string
    ref?: React.Ref<HTMLDivElement>
}) {
    const buttons = useRef(new Map<T, HTMLButtonElement>())

    const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
        const index = tabs.findIndex((tab) => tab.id === value)
        const next =
            event.key === "ArrowRight" ? Math.min(tabs.length - 1, index + 1)
            : event.key === "ArrowLeft" ? Math.max(0, index - 1)
            : event.key === "Home" ? 0
            : event.key === "End" ? tabs.length - 1
            : null
        if (next === null) return
        event.preventDefault()
        const target = tabs[next].id
        onChange(target)
        buttons.current.get(target)?.focus({ preventScroll: true })
    }

    return (
        <div ref={ref} role="tablist" aria-label={label} onKeyDown={onKey} className={cn("flex border-b border-border bg-background", className)}>
            {tabs.map((tab) => {
                const active = tab.id === value
                return (
                    <button
                        key={tab.id}
                        ref={(el) => {
                            if (el) buttons.current.set(tab.id, el)
                            else buttons.current.delete(tab.id)
                        }}
                        type="button"
                        role="tab"
                        id={`${idPrefix}-tab-${tab.id}`}
                        aria-controls={`${idPrefix}-panel-${tab.id}`}
                        aria-selected={active}
                        tabIndex={active ? 0 : -1}
                        onClick={() => onChange(tab.id)}
                        className={cn(
                            "flex h-12 items-center justify-center px-4 text-sm font-medium transition-colors outline-none focus-visible:bg-muted max-lg:flex-1",
                            active ? "text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                    >
                        {/* M3 primary tab: the indicator spans the label, not the tab. */}
                        <span className={cn(
                            "relative flex h-full items-center",
                            active && "after:absolute after:-inset-x-1 after:bottom-0 after:h-[3px] after:rounded-t-full after:bg-primary",
                        )}>
                            {tab.label}
                        </span>
                    </button>
                )
            })}
        </div>
    )
}

export interface SectionLink {
    /** The section's element id. */
    domId: string
    label: string
    /** Shown after the label; null for none (or not known yet). */
    count: number | null
}

function jumpHandler(onJump: (domId: string) => void, domId: string) {
    return (event: MouseEvent<HTMLAnchorElement>) => {
        // The page moves its own scroller; the browser's jump to a fragment
        // would scroll every ancestor and write the fragment into the URL.
        event.preventDefault()
        onJump(domId)
    }
}

function accessibleName(link: SectionLink) {
    return link.count === null ? link.label : `${link.label}, ${link.count}`
}

/**
 * The related-list rail beside a record's Overview on a desk (Zoho CRM's
 * record page): one jump per section with its count at the trailing edge
 * (M3 navigation drawer: label, then a badge label), the section being
 * read on the tonal fill the drawer and the More sheet use for the current
 * place. The caller pins it (`sticky`) beside the sections.
 */
export function SectionRail({ links, active, onJump, className }: {
    links: readonly SectionLink[]
    active: string
    onJump: (domId: string) => void
    className?: string
}) {
    return (
        <nav aria-label="Sections" className={className}>
            <ul className="space-y-0.5">
                {links.map((link) => {
                    const current = link.domId === active
                    return (
                        <li key={link.domId}>
                            <a
                                href={`#${link.domId}`}
                                onClick={jumpHandler(onJump, link.domId)}
                                aria-current={current ? "location" : undefined}
                                aria-label={accessibleName(link)}
                                className={cn(
                                    "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                                    current
                                        ? "bg-[var(--tonal)] text-[var(--tonal-foreground)]"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                                )}
                            >
                                <span className="min-w-0 flex-1 truncate">{link.label}</span>
                                {link.count !== null && <span className="text-xs tabular-nums">{link.count}</span>}
                            </a>
                        </li>
                    )
                })}
            </ul>
        </nav>
    )
}

/**
 * The same jumps on a phone: a row of 32dp chips under the tabs that
 * scrolls sideways and fades at each edge it can still scroll toward (see
 * DESIGN.md, Chips), the section being read on the tonal fill of a chosen
 * chip. Each chip's target reaches 44px, above and below it.
 */
export function SectionChips({ links, active, onJump, className }: {
    links: readonly SectionLink[]
    active: string
    onJump: (domId: string) => void
    className?: string
}) {
    const fade = useEdgeFade<HTMLDivElement>()
    return (
        <nav aria-label="Sections" className={className}>
            <div ref={fade} className="edge-fade no-scrollbar flex gap-2 overflow-x-auto px-4 py-3 sm:px-6">
                {links.map((link) => {
                    const current = link.domId === active
                    return (
                        <a
                            key={link.domId}
                            href={`#${link.domId}`}
                            onClick={jumpHandler(onJump, link.domId)}
                            aria-current={current ? "location" : undefined}
                            aria-label={accessibleName(link)}
                            className={cn(
                                "relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                                "before:absolute before:inset-x-0 before:-inset-y-1.5",
                                current
                                    ? "border-transparent bg-[var(--tonal)] text-[var(--tonal-foreground)]"
                                    : "border-border bg-background text-foreground hover:bg-muted",
                            )}
                        >
                            {link.label}
                            {link.count !== null && <span className={cn("tabular-nums", !current && "text-muted-foreground")}>{link.count}</span>}
                        </a>
                    )
                })}
            </div>
        </nav>
    )
}
