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

/**
 * One value in a bottom sheet that picks several (a filter's values): the
 * same 56dp row as `SheetChoice`, `role="checkbox"`, with an 18dp M3
 * checkbox at its leading edge that fills with the primary colour and a
 * check when ticked (M3 list with checkboxes; a ticked row is not filled,
 * the box says it).
 */
export function SheetCheck({
    label,
    hint,
    checked,
    onToggle,
}: {
    label: string
    hint?: string
    checked: boolean
    onToggle: () => void
}) {
    return (
        <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            onClick={onToggle}
            className={cn(
                "flex min-h-14 w-full items-center gap-4 rounded-xl px-4 text-left text-sm text-foreground transition-colors hover:bg-muted",
                checked && "font-medium",
            )}
        >
            <span
                aria-hidden="true"
                className={cn(
                    "grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[3px] border-2 transition-colors",
                    checked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground",
                )}
            >
                {checked && <Check className="h-3.5 w-3.5" />}
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate">{label}</span>
                {hint && <span className="block truncate text-xs font-normal text-muted-foreground">{hint}</span>}
            </span>
        </button>
    )
}

/**
 * A choice chip in a sheet (how a filter compares: "Is any of", "After"):
 * 36px, 8dp corners, the chosen one tonal with a check, as the date
 * sheet's quick ranges. `role="radio"` inside the caller's `radiogroup`.
 */
export function SheetChoiceChip({ label, checked, onChoose }: { label: string; checked: boolean; onChoose: () => void }) {
    return (
        <button
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={onChoose}
            className={cn(
                "inline-flex h-9 min-w-12 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors",
                checked ? "border-transparent bg-[var(--tonal)] text-[var(--tonal-foreground)]" : "border-border text-foreground hover:bg-muted",
            )}
        >
            {checked && <Check className="h-4 w-4" aria-hidden="true" />}
            {label}
        </button>
    )
}
