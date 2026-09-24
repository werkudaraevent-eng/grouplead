"use client"

import { Check } from "@/components/icons"
import { cn } from "@/lib/utils"

/**
 * One choice in a bottom sheet that picks one of a set (a pipeline, a
 * stage): a 56dp list row, `role="radio"` inside the caller's
 * `radiogroup`, the chosen one on the tonal indicator with a check at its
 * end, as the More sheet marks the business unit in view (M3 list in a
 * modal bottom sheet; `SheetRow`'s measurements).
 */
export function SheetChoice({
    label,
    hint,
    icon,
    checked,
    onChoose,
}: {
    label: string
    /** A second, muted line. */
    hint?: string
    /** A 20px leading icon. */
    icon?: React.ReactNode
    checked: boolean
    onChoose: () => void
}) {
    return (
        <button
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={onChoose}
            className={cn(
                "flex min-h-14 w-full items-center gap-4 rounded-xl px-4 text-left text-sm transition-colors",
                checked ? "bg-[var(--tonal)] font-medium text-[var(--tonal-foreground)]" : "text-foreground hover:bg-muted",
            )}
        >
            {icon && <span className="grid h-5 w-5 shrink-0 place-items-center">{icon}</span>}
            <span className="min-w-0 flex-1">
                <span className="block truncate">{label}</span>
                {hint && <span className={cn("block truncate text-xs font-normal", checked ? "opacity-80" : "text-muted-foreground")}>{hint}</span>}
            </span>
            {checked && <Check className="h-5 w-5 shrink-0" aria-hidden="true" />}
        </button>
    )
}
