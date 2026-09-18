"use client"

import { Check } from "@/components/icons"
import { cn } from "@/lib/utils"

/**
 * Material 3 segmented button: two to five mutually exclusive options in
 * one pill, the chosen one in the secondary container (tonal) with a
 * leading check. Not the primary fill: that is for the one main action
 * of a screen, and a filled "Bulan ini" beside a filled Ekspor made two
 * buttons look like two things to press. For "which of these views"
 * questions (a range, a mode), not for filters with many values, which
 * are chips or a facet.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = "md",
  className,
}: {
  value: T
  options: ReadonlyArray<{ value: T; label: string }>
  onChange: (next: T) => void
  label: string
  size?: "sm" | "md"
  className?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-full border bg-card p-0.5", size === "sm" ? "h-8" : "h-10 md:h-9", className)}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full font-medium transition-colors",
              size === "sm" ? "px-2.5 text-xs" : "px-3.5 text-sm",
              active ? "bg-[var(--tonal)] text-[var(--tonal-foreground)]" : "text-foreground hover:bg-muted"
            )}
          >
            {active && <Check className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden="true" />}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
