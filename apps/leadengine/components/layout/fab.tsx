"use client"

import { Plus } from "@/components/icons"
import { cn } from "@/lib/utils"

/**
 * Material's extended FAB: the one primary action of a screen, below `lg`.
 * Twin of Sales Activity's `components/fab.tsx`, as a button, because
 * LeadEngine's creates open a form over the page rather than a page of
 * their own.
 *
 * Bottom-right, 16dp from the edge and 16dp above the navigation bar
 * (80dp plus the home indicator's inset). Icon and label, 56dp tall, the
 * primary fill. Hidden from `lg` up, where the same action is the filled
 * button in the page header. A page that carries one ends its content
 * `FAB_CLEARANCE` above `<main>`'s foot, so its last row or pager is never
 * under it.
 */
export function Fab({ label, onClick, disabled, className }: { label: string; onClick: () => void; disabled?: boolean; className?: string }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={cn(
                "fixed right-4 z-30 inline-flex h-14 items-center gap-3 rounded-2xl bg-primary pl-4 pr-5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-[0.97] disabled:opacity-60 lg:hidden",
                "bottom-[calc(5rem+env(safe-area-inset-bottom)+1rem)]",
                className,
            )}
        >
            <Plus className="h-6 w-6" aria-hidden="true" />
            {label}
        </button>
    )
}

/**
 * The room a page with a FAB leaves at its foot below `lg`: the FAB's 56dp
 * and the 16dp under it, plus 16dp so the last row does not touch it.
 */
export const FAB_CLEARANCE = "max-lg:pb-[5.5rem]"
