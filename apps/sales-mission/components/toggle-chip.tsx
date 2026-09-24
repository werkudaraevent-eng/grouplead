"use client"

import type { ComponentType } from "react"
import { Check } from "@/components/icons"
import { cn } from "@/lib/utils"

/**
 * A filter chip that is one yes/no (M3 filter chip): "Butuh follow-up" on
 * Prospek, "Saya" and the answer lenses on Aktivitas. It sits in the filter
 * row beside the facets and is the same 8dp-cornered chip as a facet's
 * button: outlined at rest (with its own icon, when it has one), and when on
 * the facet's primary tint with a leading check, so a toggle that narrows
 * the list reads the same as a facet that does. `aria-pressed` carries the
 * state for a screen reader. A count, when given, says how many rows the
 * toggle would leave: in the warning ink while off when the rows it finds
 * wait on the reader, neutral otherwise, primary once on.
 */
export function ToggleChip({
  label,
  pressed,
  onToggle,
  icon: Icon,
  count,
  countTone = "neutral",
  showZero = false,
  className,
}: {
  label: string
  pressed: boolean
  onToggle: () => void
  icon?: ComponentType<{ className?: string }>
  count?: number
  countTone?: "neutral" | "warning"
  /** Show a count of 0 too (an answer lens says "nothing waits"); by default a 0 is left out. */
  showZero?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-3 text-sm font-medium text-foreground transition-colors md:h-9",
        pressed ? "border-primary/50 bg-primary/5" : "bg-card hover:bg-muted",
        className
      )}
    >
      {pressed ? <Check className="h-4 w-4 text-primary" aria-hidden="true" /> : Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {label}
      {count !== undefined && (count > 0 || showZero) && (
        <span
          className={cn(
            "grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold tabular-nums",
            pressed
              ? "bg-primary text-primary-foreground"
              : countTone === "warning"
                ? "bg-[var(--warning-foreground)] text-white"
                : "bg-muted text-muted-foreground"
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
}
