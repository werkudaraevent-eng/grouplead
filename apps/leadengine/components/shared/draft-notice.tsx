"use client"

import { Info, Trash2, X } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * "Your unsaved input was restored." — the quiet line a form shows when it
 * opened on a draft this browser kept (DESIGN.md, "Surviving a deploy"). A
 * banner in M3's sense, as Sales Activity's `DraftNotice` is: it waits for
 * the person, at the top of the form it concerns, with two text buttons so
 * the form's own filled Save stays the loudest thing on it, the dismissive
 * one first. Close keeps the input; Discard puts the form back the way it
 * opens without a draft.
 */
export function DraftNotice({ onDismiss, onDiscard, className }: { onDismiss: () => void; onDiscard: () => void; className?: string }) {
  return (
    <div role="status" className={cn("flex flex-col gap-2 rounded-xl bg-[var(--tonal)] px-4 py-3 text-sm text-[var(--tonal-foreground)] sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="flex items-start gap-2.5">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>Your unsaved input was restored.</p>
      </div>
      <div className="flex shrink-0 items-center gap-2 max-sm:justify-end">
        <Button type="button" variant="ghost" size="sm" className="text-[var(--tonal-foreground)] hover:bg-[var(--tonal-foreground)]/10" onClick={onDismiss}>
          <X className="h-4 w-4" /> Close
        </Button>
        <Button type="button" variant="ghost" size="sm" className="font-semibold text-[var(--tonal-foreground)] hover:bg-[var(--tonal-foreground)]/10" onClick={onDiscard}>
          <Trash2 className="h-4 w-4" /> Discard
        </Button>
      </div>
    </div>
  )
}
