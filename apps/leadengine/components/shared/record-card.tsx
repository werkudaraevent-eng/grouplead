"use client"

import Link from "next/link"
import type { MouseEvent, ReactNode } from "react"
import { InitialsAvatar } from "@/components/shared/initials-avatar"
import { shortPersonName } from "@/lib/person-name"
import { cn } from "@/lib/utils"

export interface RecordCardOwner {
    full_name: string
    avatar_url?: string | null
}

/**
 * One record in a phone list (Contacts and Companies below `md`), in Sales
 * Activity's card anatomy, rule for rule (its prospect, activity and report
 * cards; "Who is on it, at the card's foot" there):
 *
 *   ┌──────────────────────────────────────────┐
 *   │ Name ⚠                                   │  headline, semibold, one line
 *   │ supporting · line · muted                │  12px, muted, one line
 *   │                                          │
 *   │ the key fact · on one line               │  14px, one line
 *   ├──────────────────────────────────────────┤  hairline
 *   │ (AB) Owner name                        ⋮ │  who, then the one action
 *   └──────────────────────────────────────────┘
 *
 * No leading tile: the person is in the footer, so the headline gets the
 * width. Every card has the footer, so "who" is always in the same place,
 * and an empty owner says so ("No owner") rather than leaving a hole. The
 * card opens the record the way a table row does (`onOpen`, from
 * `useRowLink`), the name is the real link for the keyboard and a new tab,
 * and a control in the footer never opens the record.
 */
export function RecordCard({
    href,
    name,
    mark,
    supporting,
    supportingEmpty,
    fact,
    factEmpty,
    owner,
    action,
    onOpen,
}: {
    href: string
    /** The headline, and the card's link. */
    name: string
    /** Beside the name, such as the Needs details mark. */
    mark?: ReactNode
    supporting: string
    /** Said, muted, when there is no supporting line. */
    supportingEmpty: string
    fact: string
    /** Said, muted, when there is no fact. */
    factEmpty: string
    owner: RecordCardOwner | null | undefined
    /** The card's one action at the footer's trailing edge (its ⋮, or a button). */
    action?: ReactNode
    onOpen: (event: MouseEvent<HTMLElement>) => void
}) {
    return (
        <li onClick={onOpen} className="cursor-pointer overflow-hidden rounded-xl border border-border bg-card transition-colors hover:bg-muted/50">
            <div className="p-4">
                <div className="flex min-w-0 items-center gap-1.5">
                    <Link href={href} prefetch={false} className="truncate font-semibold text-foreground hover:underline">
                        {name}
                    </Link>
                    {mark}
                </div>
                <p className="truncate text-xs text-muted-foreground">{supporting || supportingEmpty}</p>
                <p className={cn("mt-2 truncate text-sm", fact ? "text-foreground" : "text-muted-foreground")}>{fact || factEmpty}</p>
            </div>
            {/* Who holds it at bottom-start, what to do at bottom-end (M3 card). */}
            <div className="flex min-h-11 items-center justify-between gap-3 border-t border-border px-3 py-2">
                <RecordCardOwnerLine owner={owner} />
                {action && <span className="flex shrink-0 items-center gap-2">{action}</span>}
            </div>
        </li>
    )
}

/** The owner at a card's foot: avatar and name, the name shortened to fit beside the action. */
export function RecordCardOwnerLine({ owner }: { owner: RecordCardOwner | null | undefined }) {
    if (!owner?.full_name) {
        return <span className="min-w-0 truncate text-xs text-muted-foreground">No owner</span>
    }
    return (
        <span className="flex min-w-0 items-center gap-2" title={owner.full_name}>
            <span aria-hidden="true" className="shrink-0">
                <InitialsAvatar name={owner.full_name} src={owner.avatar_url} size="sm" />
            </span>
            <span className="min-w-0 truncate text-xs font-medium text-foreground">
                <span className="sr-only">Owner: </span>
                {shortPersonName(owner.full_name)}
            </span>
        </span>
    )
}
