"use client"

import * as React from "react"
import { X } from "@/components/icons"
import { Tooltip } from "@/components/ui/tooltip"
import { markHintsSeen } from "@/app/actions/hint-actions"
import { useIntroSeen, useMarkIntroSeen } from "@/components/shared/intro-seen-provider"
import { cn } from "@/lib/utils"

const STORAGE_PREFIX = "le:hint:"

function readStored(key: string): boolean {
    try {
        return window.localStorage.getItem(STORAGE_PREFIX + key) !== null
    } catch {
        // Storage may be unavailable; the server's record is enough.
        return false
    }
}

/** Another tab closing the same description closes it here too. */
function subscribeStorage(onChange: () => void): () => void {
    window.addEventListener("storage", onChange)
    return () => window.removeEventListener("storage", onChange)
}

/**
 * A page's description, shown until the person closes it: the lists'
 * (Contacts, Companies) and every other page's alike (Settings and its
 * pages, the changelog).
 *
 * A sentence under a page's title that teaches (what the page is for, how it
 * works) is needed once by a newcomer; on every later visit it is a line
 * between the title and the work. M3 keeps supporting text that has done its
 * job out of the way, so the description carries a ✕ (tooltip "Dismiss")
 * and, once closed, stays closed for that person on every device: the key
 * goes to public.user_hints through `markHintsSeen`, the store the What's new
 * dialog uses, with localStorage for a close that never reaches the server.
 * Keys are `list-intro-<list>` for the lists and `page-intro-<page>` for the
 * rest (`lib/hints/hint-key.ts`), the same shapes as Sales Activity's. A line
 * that states facts (a count, a date, "Updated 2m ago") is not a description
 * of this kind and never goes through here.
 *
 * `seen` comes from the server so the first render is already right. A list
 * passes it from its own page; any other page leaves it out and it is read
 * from `IntroSeenProvider`, which the app layout fills. The browser's own
 * record can only hide the description, never bring it back.
 */
export function PageIntro({ hintKey, seen, children, className }: { hintKey: string; seen?: boolean; children: React.ReactNode; className?: string }) {
    const seenOnServer = useIntroSeen(hintKey)
    const markIntroSeen = useMarkIntroSeen()
    const stored = React.useSyncExternalStore(subscribeStorage, () => readStored(hintKey), () => false)
    const [closedNow, setClosedNow] = React.useState(false)

    if (seen || seenOnServer || stored || closedNow) return null

    const dismiss = () => {
        setClosedNow(true)
        markIntroSeen(hintKey)
        try {
            window.localStorage.setItem(STORAGE_PREFIX + hintKey, "1")
        } catch {
            // Ignore; the server row is the record.
        }
        markHintsSeen([hintKey]).catch(() => undefined)
    }

    return (
        <div className={cn("flex w-fit max-w-3xl items-start gap-1", className)}>
            <p className="min-w-0 flex-1 text-sm text-muted-foreground">{children}</p>
            <Tooltip content="Dismiss">
                <button
                    type="button"
                    onClick={dismiss}
                    aria-label="Dismiss description"
                    // Centred on the first line without making the line taller;
                    // 40px to a finger on a phone, 32px to a pointer.
                    className="-my-2.5 grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:-my-1.5 md:h-8 md:w-8"
                >
                    <X className="h-4 w-4" />
                </button>
            </Tooltip>
        </div>
    )
}
