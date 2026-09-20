"use client"

import { Check } from "@/components/icons"
import { cn } from "@/lib/utils"

/**
 * Material 3 filter chip.
 *
 * The M3 chip is 32dp tall with 8dp corners, outlined at rest and tonal
 * (secondary container) with a leading check when selected. Not a pill,
 * and not filled with the primary: the full-round pill belongs to buttons
 * and segmented buttons, and a saturated fill on every selected option
 * turned a form of five answers into five Save buttons. The tonal fill
 * reads as "chosen" without shouting, which is what keeps a long form
 * easy on the eyes.
 *
 * The visible chip is 32dp; the 48dp touch target comes from the
 * pseudo-element that extends the hit area above and below. A label a
 * narrow screen must wrap grows the chip with it (min height, not a fixed
 * one), so the text never spills past the border; labels are still
 * written to fit one line on a phone.
 */
export function ChoiceChip({
  selected,
  onClick,
  disabled,
  children,
  className,
}: {
  selected: boolean
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        "relative inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-3 py-1 text-left text-sm leading-tight transition-colors after:absolute after:inset-x-0 after:-inset-y-2 after:content-[''] disabled:opacity-50",
        selected
          ? "border-transparent bg-[var(--tonal)] font-medium text-[var(--tonal-foreground)]"
          : "border-input bg-transparent text-foreground hover:bg-muted",
        className
      )}
    >
      {selected && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
      {children}
    </button>
  )
}

/** A row of chips with the vertical room their touch targets need. */
export function ChipRow({ children, className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-wrap gap-x-2 gap-y-3 py-1", className)} {...props}>
      {children}
    </div>
  )
}
