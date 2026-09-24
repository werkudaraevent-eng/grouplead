"use client"

import * as React from "react"
import { X } from "@/components/icons"
import { Tooltip } from "@/components/ui/tooltip"
import { markHintsSeen } from "@/app/actions/hint-actions"
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
 * A list page's description, shown until the person closes it.
 *
 * The sentence under a list's title teaches what the list is. A newcomer
 * needs it once; on every later visit it is a line between the title and
 * the records. M3 keeps supporting text that has done its job out of the
 * way, so the description carries a ✕ (tooltip "Dismiss") and, once closed,
 * stays closed for that person on every device: the key goes to
 * public.user_hints through `markHintsSeen`, the store the What's new dialog
 * uses, with localStorage for a close that never reaches the server.
 * Sales Activity's lists do the same with the same keys (`list-intro-<list>`).
 *
 * `seen` comes from the server so the first render is already right; the
 * browser's own record can only hide it, never bring it back.
 */
export function ListIntro({ hintKey, seen, children, className }: { hintKey: string; seen: boolean; children: React.ReactNode; className?: string }) {
    const stored = React.useSyncExternalStore(subscribeStorage, () => readStored(hintKey), () => false)
    const [closedNow, setClosedNow] = React.useState(false)

    if (seen || stored || closedNow) return null

    const dismiss = () => {
        setClosedNow(true)
        try {
            window.localStorage.setItem(STORAGE_PREFIX + hintKey, "1")
        } catch {
            // Ignore; the server row is the record.
        }
        markHintsSeen([hintKey]).catch(() => undefined)
    }

    return (
        <div className={cn("flex max-w-3xl items-start gap-1", className)}>
            <p className="min-w-0 flex-1 text-sm text-muted-foreground">{children}</p>
            <Tooltip content="Dismiss">
                <button
                    type="button"
                    onClick={dismiss}
                    aria-label="Dismiss description"
                    // Centred on the first line without making the line taller.
                    className="-my-1.5 grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                    <X className="h-4 w-4" />
                </button>
            </Tooltip>
        </div>
    )
}
