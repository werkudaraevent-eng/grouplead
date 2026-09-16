import { AlertTriangle } from "@/components/icons"
import { cn } from "@/lib/utils"

/**
 * "Needs details": a record auto-created from an import that a person has
 * not yet completed. A tonal warning badge from the tokens, so it reads
 * as a note rather than an alarm and matches the rest of the app.
 */
export function NeedsDetailsBadge({ className }: { className?: string }) {
  return (
    <span
      title="Auto-created from a lead import. Edit and save to complete it."
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full bg-warning px-2 py-0.5 text-[11px] font-semibold text-warning-foreground",
        className
      )}
    >
      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
      Needs details
    </span>
  )
}
