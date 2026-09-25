"use client"

import Link from "next/link"
import { Fragment, useId, useRef, useState, type ComponentType, type KeyboardEvent, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip } from "@/components/ui/tooltip"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { InitialsAvatar } from "@/components/shared/initials-avatar"
import { useEdgeFade } from "@/hooks/use-edge-fade"
import { useCurrency } from "@/contexts/currency-context"
import { cn } from "@/lib/utils"
import {
    ArrowLeft, ArrowRightLeft, ArrowUpRight, Calendar, CheckSquare, ChevronDown, ChevronLeft, ChevronRight, Clock, FileText,
    Loader2, Mail, Paperclip, Pencil, Phone, Plus, Trash2,
} from "@/components/icons"
import {
    activityTime, COMPOSER_KINDS, composerPlaceholder, emptyFieldsToggleLabel, feedHeadline, leadStanding,
    leadSummaryLabel, summarizeLeads, type ActivityKind, type ComposerKind, type FeedItem, type LeadStageFacts,
    type LeadStanding,
} from "@/lib/record-page"

/**
 * The parts of a record's page, the approved design (Figma "Contact detail
 * — Desktop 1440" and "— Phone 390"; DESIGN.md, "Record pages"), shared by
 * the Contact and Company pages:
 *
 *   desk (lg+)  RecordHeader: the parent link, avatar, name, the line under
 *               it and the actions, then the facts row (RecordFact)
 *   phone       RecordHero: avatar, name, lines, QuickAction buttons;
 *               KeyFactsCard, AddNoteRow, ComposerSheet
 *   both        RecordTabs pinned under the top; RecordCard and its kinds:
 *               ActivityComposer, RecentActivityCard, AboutCard,
 *               RelatedCompanyCard, RecordLeadsCard, RelatedListCard
 *
 * Tokens only; sentence case; 4dp grid (4/8 inside a group, 16–24 between
 * groups); the type as the frames set it, with the font's own line height.
 */

type IconType = ComponentType<{ className?: string }>

/**
 * The frames set every line in the font's own line height ("normal", about
 * 1.26 for Plus Jakarta Sans), where Tailwind's sizes carry taller ones
 * (14/20, 12/16, 24/32): a record page's root, and anything of it that is
 * portalled (its bottom sheet), takes this, so `text-sm` and the rest
 * measure as the frames do.
 */
export const RECORD_TYPE = "leading-[normal] [--text-xs--line-height:normal] [--text-sm--line-height:normal] [--text-base--line-height:normal] [--text-2xl--line-height:normal]"

/** The outlined button of the header (Call, Email, Edit): the card's surface, a hairline, 36dp, 8dp corners. */
export const OUTLINED_BUTTON = "h-9 rounded-[8px] border-border bg-card px-4 font-semibold text-foreground shadow-none hover:bg-muted hover:text-foreground"
/** The filled button (New lead, Save note). */
export const FILLED_BUTTON = "h-9 rounded-[8px] px-4 font-semibold"
/** A 36dp round icon button (‹ › ⋮). */
export const ICON_BUTTON = "size-9 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"

// ═══════════════════════════════════════════════════════════════
//  HEADER (desk)
// ═══════════════════════════════════════════════════════════════

/**
 * A record's header from `lg`, on the card's surface: the parent as a link
 * ("← Contacts"), 12dp below it the identity (a 48dp avatar, 16dp, the
 * name at 24px and the line under it at 14px) with the actions at the
 * trailing edge, and 24dp below that the facts, under the name (48 + 16 =
 * 64dp in), 48dp apart. It scrolls away; the tabs under it stay.
 */
export function RecordHeader({ backHref, backLabel, avatar, name, nameAdornment, supporting, actions, facts }: {
    backHref: string
    backLabel: string
    avatar: ReactNode
    name: string
    nameAdornment?: ReactNode
    supporting?: ReactNode
    actions: ReactNode
    facts?: ReactNode
}) {
    return (
        <header className="hidden bg-card px-8 pt-4 lg:block">
            <Link href={backHref} className="flex w-fit items-center gap-1 rounded-sm text-[13px] font-medium text-muted-foreground outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/50">
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                {backLabel}
            </Link>
            <div className="flex items-center justify-between gap-6 pt-3">
                <div className="flex min-w-0 items-center gap-4">
                    {avatar}
                    <div className="flex min-w-0 flex-col gap-1">
                        <div className="flex min-w-0 items-center gap-2">
                            <h1 className="truncate text-2xl font-semibold text-foreground" title={name}>{name}</h1>
                            {nameAdornment}
                        </div>
                        {supporting && <p className="truncate text-sm text-muted-foreground">{supporting}</p>}
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">{actions}</div>
            </div>
            {facts ? <dl className="flex flex-wrap gap-x-12 gap-y-4 pb-5 pl-16 pt-6">{facts}</dl> : <div className="h-5" />}
        </header>
    )
}

/** ‹ › to the record before and after this one (by name), 36dp round, named by their tooltips. */
export function RecordStepper({ prevHref, nextHref, prevLabel, nextLabel }: {
    prevHref?: string | null
    nextHref?: string | null
    prevLabel: string
    nextLabel: string
}) {
    const step = (href: string | null | undefined, label: string, Icon: IconType) => (
        <Tooltip content={label} position="bottom">
            {href ? (
                <Button asChild variant="ghost" size="icon" className={ICON_BUTTON}>
                    <Link href={href} prefetch={false} aria-label={label}><Icon className="h-5 w-5" /></Link>
                </Button>
            ) : (
                <Button variant="ghost" size="icon" disabled aria-label={label} className={ICON_BUTTON}><Icon className="h-5 w-5" /></Button>
            )}
        </Tooltip>
    )
    return (
        <div className="flex items-center gap-2">
            {step(prevHref, prevLabel, ChevronLeft)}
            {step(nextHref, nextLabel, ChevronRight)}
        </div>
    )
}

/**
 * A header action that is a link (Call, Email): outlined, 36dp. Without a
 * number or an address it stays, disabled, and its tooltip says why.
 */
export function HeaderLinkButton({ href, label, missing }: { href: string | null; label: string; missing: string }) {
    if (href) {
        return (
            <Button asChild variant="outline" className={OUTLINED_BUTTON}>
                <a href={href}>{label}</a>
            </Button>
        )
    }
    return (
        <Tooltip content={missing} position="bottom">
            <Button variant="outline" disabled className={OUTLINED_BUTTON}>{label}</Button>
        </Tooltip>
    )
}

/** One fact under the header: the label (12px, medium, muted) over its value (14px). No icon beside it; the label names it. */
export function RecordFact({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 max-w-80 flex-col gap-1">
            <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
            <dd className="min-w-0 truncate text-sm font-medium text-foreground">{children}</dd>
        </div>
    )
}

/** A person as their 20dp avatar and name, 8dp apart: the owner, wherever a record names them. */
export function PersonLine({ name, src }: { name: string; src?: string | null }) {
    return (
        <span className="inline-flex min-w-0 max-w-full items-center gap-2 align-middle">
            <InitialsAvatar name={name} src={src} size="xs" />
            <span className="truncate">{name}</span>
        </span>
    )
}

/** A value in the facts that is a link (tel:, mailto:, a website): the primary ink. */
export function FactLink({ href, external = false, children }: { href: string; external?: boolean; children: ReactNode }) {
    return (
        <a
            href={href}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="rounded-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
        >
            {children}
        </a>
    )
}

/** A fact with nothing to show, in the muted ink ("No activity yet"). */
export function FactNone({ children }: { children: ReactNode }) {
    return <span className="font-normal text-muted-foreground">{children}</span>
}

// ═══════════════════════════════════════════════════════════════
//  HERO (phone)
// ═══════════════════════════════════════════════════════════════

/**
 * A record's header below `lg`, on the card's surface and centred: the
 * 64dp avatar, the name at 22px, its lines at 14px, then the quick
 * actions, 14dp apart (Google Contacts; Zoho CRM mobile).
 */
export function RecordHero({ avatar, name, nameAdornment, lines, actions }: {
    avatar: ReactNode
    name: string
    nameAdornment?: ReactNode
    lines?: ReactNode
    actions?: ReactNode
}) {
    return (
        <section aria-label={name} className="flex flex-col items-center gap-3.5 bg-card px-4 pb-4 pt-5 text-center lg:hidden">
            {avatar}
            <div className="flex max-w-full flex-col items-center gap-1">
                <h1 className="max-w-full break-words text-[22px] font-semibold text-foreground">
                    {name}
                    {nameAdornment && <span className="ml-1.5 inline-block align-[-2px]">{nameAdornment}</span>}
                </h1>
                {lines}
            </div>
            {actions && <div className="flex w-full items-start justify-center gap-3">{actions}</div>}
        </section>
    )
}

/**
 * An M3 labelled icon button for the phone's header: a 64×40dp tonal pill
 * over its label (12px), the whole column the target. Without a number or
 * an address it stays in its place, disabled, and says why.
 */
export function QuickAction({ icon: Icon, label, href, onClick, external = false, missing }: {
    icon: IconType
    label: string
    href?: string | null
    onClick?: () => void
    external?: boolean
    /** Why it is unavailable, when there is no `href` nor `onClick`. */
    missing?: string
}) {
    const body = (
        <>
            <span className="grid h-10 w-16 place-items-center rounded-full bg-[var(--tonal)] text-[var(--tonal-foreground)] transition-colors group-hover/quick:bg-[color-mix(in_srgb,var(--tonal-foreground)_8%,var(--tonal))] group-focus-visible/quick:ring-2 group-focus-visible/quick:ring-ring/50">
                <Icon className="h-5 w-5" />
            </span>
            <span className="text-xs font-medium">{label}</span>
        </>
    )
    const base = "group/quick flex w-16 flex-col items-center gap-1.5 text-foreground outline-none"
    if (href) {
        return (
            <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className={base}>
                {body}
            </a>
        )
    }
    if (onClick) {
        return <button type="button" onClick={onClick} className={base}>{body}</button>
    }
    return (
        <button type="button" disabled title={missing} aria-label={missing ? `${label} (${missing.toLowerCase()})` : label} className={cn(base, "opacity-40")}>
            {body}
        </button>
    )
}

// ═══════════════════════════════════════════════════════════════
//  TABS
// ═══════════════════════════════════════════════════════════════

export interface RecordTab<T extends string> {
    id: T
    label: string
    /** Shown after the label ("Leads 2"); null or left out for none. */
    count?: number | null
}

/**
 * M3 primary tabs for a record's views, on the card's surface with a
 * hairline under them, pinned to the top of the page's scroll (under the
 * phone's top app bar, which is outside it). Active: semibold in the
 * primary with a 3dp indicator; the others medium and muted. On a desk
 * they sit at the leading edge, 43dp, the indicator the tab's width; on a
 * phone they share the width, 48dp, the indicator 40dp under the label,
 * and when they do not fit (a company's five) the row scrolls sideways and
 * fades at its edges. Arrow keys, Home and End move between them and
 * choose; the chosen tab is brought into the row's view by the row's own
 * scroller, never `scrollIntoView`.
 */
export function RecordTabs<T extends string>({ tabs, value, onChange, label, idPrefix }: {
    tabs: readonly RecordTab<T>[]
    value: T
    onChange: (next: T) => void
    label: string
    /** Ties each tab to its panel: `${idPrefix}-tab-${id}` controls `${idPrefix}-panel-${id}`. */
    idPrefix: string
}) {
    const buttons = useRef(new Map<T, HTMLButtonElement>())
    const rowRef = useRef<HTMLDivElement | null>(null)
    const fade = useEdgeFade(rowRef)

    const reveal = (id: T) => {
        const row = rowRef.current
        const tab = buttons.current.get(id)
        if (!row || !tab || row.scrollWidth <= row.clientWidth) return
        const left = tab.offsetLeft - 24
        const right = tab.offsetLeft + tab.offsetWidth + 24 - row.clientWidth
        if (left < row.scrollLeft) row.scrollTo({ left: Math.max(0, left) })
        else if (right > row.scrollLeft) row.scrollTo({ left: right })
    }

    const choose = (id: T) => {
        onChange(id)
        reveal(id)
    }

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
        choose(target)
        buttons.current.get(target)?.focus({ preventScroll: true })
    }

    return (
        <div className="sticky top-0 z-20 border-b border-border bg-card lg:px-8">
            <div
                ref={fade}
                role="tablist"
                aria-label={label}
                onKeyDown={onKey}
                className="edge-fade no-scrollbar flex overflow-x-auto"
            >
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
                            onClick={() => choose(tab.id)}
                            className={cn(
                                "relative flex h-12 min-w-fit flex-[1_0_0] items-center justify-center whitespace-nowrap px-3 text-sm outline-none transition-colors focus-visible:bg-muted lg:h-[43px] lg:flex-none lg:px-4 lg:pb-[1px]",
                                active ? "font-semibold text-primary" : "font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                            )}
                        >
                            {tab.label}
                            {tab.count !== undefined && tab.count !== null && <span className="ml-1 tabular-nums">{tab.count}</span>}
                            {active && (
                                <span aria-hidden="true" className="absolute bottom-0 left-1/2 h-[3px] w-10 -translate-x-1/2 rounded-t-[3px] bg-primary lg:inset-x-0 lg:w-auto lg:translate-x-0" />
                            )}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════
//  CARDS
// ═══════════════════════════════════════════════════════════════

/**
 * A card of the record's body: the card's surface, a hairline, 12dp
 * corners; its header (15px semibold, an action at the trailing edge) sits
 * over a hairline on a desk and runs straight into the body on a phone.
 */
export function RecordCard({ title, headingId, action, children, className }: {
    title?: string
    headingId?: string
    action?: ReactNode
    children: ReactNode
    className?: string
}) {
    return (
        <section aria-labelledby={title ? headingId : undefined} className={cn("overflow-hidden rounded-[12px] border border-border bg-card", className)}>
            {title && (
                <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-3.5 lg:border-b lg:border-border lg:py-3.5">
                    <h2 id={headingId} className="text-[15px] font-semibold text-foreground">{title}</h2>
                    {action}
                </div>
            )}
            {children}
        </section>
    )
}

/**
 * A card header's text action ("View all", "Edit", "+ New", "Open ↗"):
 * 13px semibold in the primary; its target reaches 48dp around the words
 * without moving them.
 */
export function CardAction({ href, onClick, external = false, children, "aria-label": ariaLabel }: {
    href?: string
    onClick?: () => void
    external?: boolean
    children: ReactNode
    "aria-label"?: string
}) {
    const className = "relative inline-flex shrink-0 items-center gap-0.5 rounded-sm text-[13px] font-semibold text-primary outline-none before:absolute before:-inset-x-2 before:-inset-y-4 before:content-[''] hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
    if (href) {
        return external
            ? <a href={href} target="_blank" rel="noopener noreferrer" aria-label={ariaLabel} className={className}>{children}</a>
            : <Link href={href} aria-label={ariaLabel} className={className}>{children}</Link>
    }
    return <button type="button" onClick={onClick} aria-label={ariaLabel} className={className}>{children}</button>
}

/** The phone's key facts: one card, each label (12px) over its value (14px). */
export function KeyFactsCard({ children, className }: { children: ReactNode; className?: string }) {
    return <dl className={cn("rounded-[12px] border border-border bg-card py-1", className)}>{children}</dl>
}

export function KeyFact({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-0.5 px-4 py-2.5">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="min-w-0 break-words text-sm text-foreground">{children}</dd>
        </div>
    )
}

/** The phone's way into the composer: one row that reads "Add a note…" and opens it in a bottom sheet. */
export function AddNoteRow({ onOpen, className }: { onOpen: () => void; className?: string }) {
    return (
        <button
            type="button"
            onClick={onOpen}
            aria-haspopup="dialog"
            className={cn("flex min-h-12 w-full items-center gap-2.5 rounded-[12px] border border-border bg-card px-4 py-3.5 text-left text-sm text-muted-foreground outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50", className)}
        >
            <FileText className="h-4 w-4 shrink-0 text-foreground" aria-hidden="true" />
            Add a note…
        </button>
    )
}

// ═══════════════════════════════════════════════════════════════
//  COMPOSER
// ═══════════════════════════════════════════════════════════════

/**
 * The composer (HubSpot's and Zoho's, M3's rules): what to log as tonal
 * choices (Note, Log call, Log email, Log meeting, Task), a 76dp text
 * field on the field fill that grows with what is written, and under it
 * "Ctrl + Enter to save" beside the filled button that says what it will
 * do (Save note, Log call…). `bare` drops the card (inside a sheet).
 */
export function ActivityComposer({ subject, onLog, onDone, bare = false, className }: {
    /** Named in the prompt: the contact's first name, the company's name. */
    subject: string
    onLog: (kind: ComposerKind, text: string) => Promise<boolean>
    /** Called after a save that worked. */
    onDone?: () => void
    bare?: boolean
    className?: string
}) {
    const [kind, setKind] = useState<ComposerKind>("note")
    const [text, setText] = useState("")
    const [saving, setSaving] = useState(false)
    const choice = COMPOSER_KINDS.find((entry) => entry.id === kind) ?? COMPOSER_KINDS[0]
    const fieldId = useId()
    const fade = useEdgeFade<HTMLDivElement>()

    const save = async () => {
        if (!text.trim() || saving) return
        setSaving(true)
        const saved = await onLog(kind, text)
        setSaving(false)
        if (!saved) return
        setText("")
        onDone?.()
    }

    return (
        <div className={cn(!bare && "overflow-hidden rounded-[12px] border border-border bg-card", className)}>
            {/* One row; on a narrow screen it scrolls sideways and fades at its edges. */}
            <div ref={fade} role="radiogroup" aria-label="What to log" className="edge-fade no-scrollbar flex gap-1 overflow-x-auto px-3 pb-2.5 pt-2.5">
                {COMPOSER_KINDS.map((entry) => {
                    const active = entry.id === kind
                    return (
                        <button
                            key={entry.id}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => setKind(entry.id)}
                            className={cn(
                                "relative shrink-0 rounded-[8px] px-3 py-1.5 text-[13px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 pointer-coarse:before:absolute pointer-coarse:before:-inset-y-2.5 pointer-coarse:before:inset-x-0 pointer-coarse:before:content-['']",
                                active ? "bg-[var(--tonal)] text-[var(--tonal-foreground)]" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                            )}
                        >
                            {entry.label}
                        </button>
                    )
                })}
            </div>
            <div className="px-3 pb-3">
                <label htmlFor={fieldId} className="sr-only">{choice.label}</label>
                <Textarea
                    id={fieldId}
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                            event.preventDefault()
                            save()
                        }
                    }}
                    placeholder={composerPlaceholder(kind, subject)}
                    className="max-h-60 min-h-[76px] resize-none rounded-[8px] px-3.5 py-3 text-sm shadow-none md:text-sm"
                />
            </div>
            <div className="flex items-center justify-between gap-3 px-3 pb-3">
                <span className="text-xs text-muted-foreground pointer-coarse:invisible">Ctrl + Enter to save</span>
                <Button onClick={save} disabled={!text.trim() || saving} className={FILLED_BUTTON}>
                    {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    {choice.action}
                </Button>
            </div>
        </div>
    )
}

/** The composer in a bottom sheet, for the phone's "Add a note…" and Note. */
export function ComposerSheet({ open, onOpenChange, subject, onLog }: {
    open: boolean
    onOpenChange: (open: boolean) => void
    subject: string
    onLog: (kind: ComposerKind, text: string) => Promise<boolean>
}) {
    return (
        <BottomSheet open={open} onOpenChange={onOpenChange} title="Log activity">
            <ActivityComposer bare subject={subject} onLog={onLog} onDone={() => onOpenChange(false)} className={cn(RECORD_TYPE, "pb-2")} />
        </BottomSheet>
    )
}

// ═══════════════════════════════════════════════════════════════
//  ACTIVITY
// ═══════════════════════════════════════════════════════════════

export const ACTIVITY_ICON: Record<ActivityKind, IconType> = {
    note: FileText,
    call: Phone,
    email: Mail,
    meeting: Calendar,
    task: CheckSquare,
    file: Paperclip,
    stage: ArrowRightLeft,
    create: Plus,
    update: Pencil,
    delete: Trash2,
    other: Clock,
}

/** A feed row's icon: bare at 16dp on a phone, in a 32dp neutral circle on a desk. */
export function ActivityIcon({ kind }: { kind: ActivityKind }) {
    const Icon = ACTIVITY_ICON[kind]
    return (
        <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center text-foreground lg:size-8 lg:rounded-full lg:bg-muted">
            <Icon className="h-4 w-4" />
        </span>
    )
}

/** When, as the desk says it ("2 days ago", "12 Sep 2026") and as the phone does ("2d", "12 Sep"). */
export function ActivityWhen({ at }: { at: string }) {
    return (
        <time dateTime={at} className="shrink-0 text-xs text-muted-foreground" suppressHydrationWarning>
            <span className="lg:hidden" suppressHydrationWarning>{activityTime(at, new Date(), true)}</span>
            <span className="hidden lg:inline" suppressHydrationWarning>{activityTime(at)}</span>
        </time>
    )
}

/**
 * The newest of the record's activity on its Overview: five on a desk,
 * three on a phone, each its icon, who did what (14px semibold), what it
 * said (13px, two lines at most) and when; "View all" opens Activity.
 */
export function RecentActivityCard({ feed, onViewAll }: { feed: readonly FeedItem[]; onViewAll: () => void }) {
    const shown = feed.slice(0, 5)
    return (
        <RecordCard title="Recent activity" headingId="recent-activity-heading" action={feed.length > 0 ? <CardAction onClick={onViewAll}>View all</CardAction> : undefined}>
            {shown.length === 0 ? (
                <p className="px-4 pb-4 pt-1 text-[13px] text-muted-foreground lg:pt-3.5">No activity yet. Notes, calls and meetings you log show here.</p>
            ) : (
                <ul className="pb-2 lg:pt-1">
                    {shown.map((item, index) => (
                        <li key={item.key} className={cn("flex gap-3 px-4 py-2.5 lg:py-3", index >= 3 && "max-lg:hidden")}>
                            <ActivityIcon kind={item.kind} />
                            <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                    <p className="min-w-0 truncate text-sm font-semibold text-foreground">
                                        <span className="lg:hidden">{feedHeadline(item, true)}</span>
                                        <span className="hidden lg:inline">{feedHeadline(item)}</span>
                                    </p>
                                    <ActivityWhen at={item.at} />
                                </div>
                                {item.detail && <p className="mt-0.5 line-clamp-2 break-words text-[13px] text-muted-foreground">{item.detail}</p>}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </RecordCard>
    )
}

// ═══════════════════════════════════════════════════════════════
//  ABOUT
// ═══════════════════════════════════════════════════════════════

/**
 * "About this contact" / "About this company": every field as label :
 * value (see `FieldShell`), each edited in place, the empty ones a person
 * fills in folded under "Show N empty fields"; "Edit" opens the record's
 * Edit form.
 */
export function AboutCard({ title, onEdit, filled, empty, idPrefix }: {
    title: string
    onEdit?: () => void
    filled: readonly { key: string; node: ReactNode }[]
    empty: readonly { key: string; node: ReactNode }[]
    idPrefix: string
}) {
    const [showEmpty, setShowEmpty] = useState(false)
    return (
        <RecordCard title={title} headingId={`${idPrefix}-about-heading`} action={onEdit ? <CardAction onClick={onEdit}>Edit</CardAction> : undefined}>
            <dl className="lg:py-1.5">
                {filled.map((field) => <Fragment key={field.key}>{field.node}</Fragment>)}
            </dl>
            {empty.length > 0 && (
                <>
                    {showEmpty && (
                        <dl id={`${idPrefix}-empty-fields`}>
                            {empty.map((field) => <Fragment key={field.key}>{field.node}</Fragment>)}
                        </dl>
                    )}
                    <div className="px-4 pb-3.5 pt-1">
                        <button
                            type="button"
                            aria-expanded={showEmpty}
                            aria-controls={`${idPrefix}-empty-fields`}
                            onClick={() => setShowEmpty((open) => !open)}
                            className="relative inline-flex items-center gap-1 rounded-sm text-[13px] font-semibold text-primary outline-none before:absolute before:-inset-x-2 before:-inset-y-4 before:content-[''] hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                        >
                            {emptyFieldsToggleLabel(empty.length, showEmpty)}
                            <ChevronDown className={cn("h-4 w-4 transition-transform", showEmpty && "rotate-180")} aria-hidden="true" />
                        </button>
                    </div>
                </>
            )}
            {filled.length === 0 && empty.length === 0 && <p className="px-4 pb-4 text-[13px] text-muted-foreground">Nothing recorded yet.</p>}
        </RecordCard>
    )
}

// ═══════════════════════════════════════════════════════════════
//  RELATED RECORDS
// ═══════════════════════════════════════════════════════════════

/**
 * The client company a contact belongs to. A desk card titled "Company"
 * with "Open ↗"; on a phone one row with a chevron. Its 40dp tile has
 * 10dp corners (organisations are square, people round).
 */
export function RelatedCompanyCard({ company }: { company: { id: string; name: string; line: string } }) {
    const href = `/companies/${company.id}`
    const identity = (
        <>
            <InitialsAvatar name={company.name} size="lg" shape="square" />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="truncate text-sm font-semibold text-foreground">{company.name}</p>
                {company.line && <p className="truncate text-[13px] text-muted-foreground">{company.line}</p>}
            </div>
        </>
    )
    return (
        <>
            <RecordCard
                title="Company"
                headingId="related-company-heading"
                className="hidden lg:block"
                action={<CardAction href={href} aria-label={`Open ${company.name}`}>Open <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></CardAction>}
            >
                <div className="flex items-center gap-3 px-4 pb-4 pt-3.5">{identity}</div>
            </RecordCard>
            <Link
                href={href}
                className="flex min-h-12 items-center gap-3 rounded-[12px] border border-border bg-card px-4 py-3.5 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50 lg:hidden"
            >
                {identity}
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
        </>
    )
}

export interface RelatedListItem {
    key: string
    href: string
    name: string
    detail?: string | null
    avatar: ReactNode
}

/**
 * A short list of related records on a card (a company's contacts, its
 * parent and subsidiaries): each row an avatar or tile, the name (14px
 * semibold) and one line under it (13px), the whole row the link; a
 * footer ("View all 12") when there are more.
 */
export function RelatedListCard({ title, headingId, action, items, footer, emptyText }: {
    title: string
    headingId: string
    action?: ReactNode
    items: readonly RelatedListItem[]
    footer?: ReactNode
    emptyText?: string
}) {
    return (
        <RecordCard title={title} headingId={headingId} action={action}>
            {items.length === 0 ? (
                <p className="px-4 pb-4 pt-1 text-[13px] text-muted-foreground lg:pt-3.5">{emptyText}</p>
            ) : (
                <ul className="pb-2 lg:pt-1.5">
                    {items.map((item) => (
                        <li key={item.key}>
                            <Link href={item.href} className="flex min-h-12 items-center gap-3 px-4 py-2 outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted">
                                {item.avatar}
                                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                    <span className="truncate text-sm font-semibold text-foreground">{item.name}</span>
                                    {item.detail && <span className="truncate text-[13px] text-muted-foreground">{item.detail}</span>}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
            {footer && <div className="px-4 pb-3.5">{footer}</div>}
        </RecordCard>
    )
}

// ═══════════════════════════════════════════════════════════════
//  LEADS
// ═══════════════════════════════════════════════════════════════

export interface RecordLead {
    id: number
    project_name: string | null
    estimated_value: number | null
    status?: string | null
    target_close_date: string | null
    pipeline_stage: (LeadStageFacts & { name: string; color?: string | null }) | null
    pic_sales_profile: { full_name: string } | null
}

/** Token tones by where a lead stands (DESIGN.md, Tokens): open on the tonal fill, won, lost, closed. */
export const STANDING_TONE: Record<LeadStanding, string> = {
    open: "bg-[var(--tonal)] text-[var(--tonal-foreground)]",
    won: "bg-[var(--success)] text-[var(--success-foreground)]",
    lost: "bg-[var(--danger)] text-[var(--danger-foreground)]",
    closed: "bg-muted text-foreground",
}

/** A lead's stage as a tonal chip: 12px semibold, 6dp corners. */
export function StageChip({ stage }: { stage: RecordLead["pipeline_stage"] }) {
    if (!stage) return <span className="text-xs text-muted-foreground">No stage</span>
    return (
        <span className={cn("inline-flex max-w-full items-center rounded-[6px] px-2 py-0.5 text-xs font-semibold", STANDING_TONE[leadStanding(stage)])}>
            <span className="truncate">{stage.name}</span>
        </span>
    )
}

/**
 * The record's leads on its Overview: "2 open · Rp 1.2B · 1 won" (compact
 * currency), then the open ones, what is still in play (five at most, the
 * newest first), each its name over its stage chip with its value at the
 * trailing edge, the row opening the lead. "+ New" starts one for this
 * record; "View all" opens the Leads tab, which holds the won and lost too.
 */
export function RecordLeadsCard({ leads, onNew, onViewAll, className }: {
    leads: readonly RecordLead[]
    onNew?: () => void
    onViewAll: () => void
    className?: string
}) {
    const { fmtAxis } = useCurrency()
    const summary = leadSummaryLabel(summarizeLeads(leads), fmtAxis)
    const shown = leads.filter((lead) => leadStanding(lead.pipeline_stage) === "open").slice(0, 5)
    return (
        <RecordCard
            title="Leads"
            headingId="record-leads-heading"
            className={className}
            action={onNew ? <CardAction onClick={onNew} aria-label="New lead"><Plus className="h-3.5 w-3.5" aria-hidden="true" />New</CardAction> : undefined}
        >
            {leads.length === 0 ? (
                <p className="px-4 pb-4 pt-1 text-[13px] text-muted-foreground lg:pt-3.5">No leads yet.</p>
            ) : (
                <div className="pb-2">
                    {summary && <p className="px-4 pb-1 pt-1 text-[13px] font-medium tabular-nums text-muted-foreground lg:pt-3">{summary}</p>}
                    {shown.length === 0 && <p className="px-4 py-2 text-[13px] text-muted-foreground">No open leads.</p>}
                    <ul>
                        {shown.map((lead) => (
                            <li key={lead.id}>
                                <Link href={`/leads/${lead.id}`} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2.5 outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted">
                                    <span className="flex min-w-0 flex-col items-start gap-1">
                                        <span className="max-w-full truncate text-sm font-semibold text-foreground">{lead.project_name || "Untitled lead"}</span>
                                        <StageChip stage={lead.pipeline_stage} />
                                    </span>
                                    <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">
                                        {lead.estimated_value ? fmtAxis(lead.estimated_value) : <span className="text-muted-foreground">—</span>}
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                    {leads.length > shown.length && (
                        <div className="px-4 pb-1.5 pt-1.5">
                            <CardAction onClick={onViewAll}>View all {leads.length}</CardAction>
                        </div>
                    )}
                </div>
            )}
        </RecordCard>
    )
}
