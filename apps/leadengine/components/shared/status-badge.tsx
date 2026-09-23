import { AlertTriangle } from "@/components/icons"
import { Tooltip } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/**
 * "Needs details": a record auto-created from an import that a person has
 * not yet completed. In a table row it is a small warning icon beside the
 * name with the explanation in a tooltip, never a labelled pill: the pill
 * took the name's width and cut "Abraham" to "Abr…", and a record's name
 * is the one thing a row must show whole. The icon keeps the warning ink so
 * the state is still found at a glance, and the Needs details filter lists
 * them all.
 */
export function NeedsDetailsMark({ className }: { className?: string }) {
    return (
        <Tooltip content="Needs details: auto-created from a lead import. Edit and save to complete it.">
            <span
                role="img"
                aria-label="Needs details"
                className={cn("inline-grid h-5 w-5 shrink-0 place-items-center rounded-sm text-warning-foreground", className)}
            >
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            </span>
        </Tooltip>
    )
}
