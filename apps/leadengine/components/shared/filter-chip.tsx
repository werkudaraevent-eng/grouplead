import { X } from "@/components/icons"

/**
 * An applied filter shown as an input chip on a phone, where the filter
 * chips themselves sit behind the "Filter" sheet: the value, and an ✕ that
 * removes it. 8dp corners like every other chip (M3 input chip; never a
 * pill), with the ✕'s hit area grown to 44px. Sales Activity's
 * `FilterChip`, in English.
 */
export function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
    return (
        <span className="inline-flex h-8 max-w-[16rem] shrink-0 items-center gap-1 whitespace-nowrap rounded-md border bg-card pl-3 pr-1 text-xs font-medium text-foreground">
            <span className="truncate">{label}</span>
            <button
                type="button"
                onClick={onRemove}
                aria-label={`Remove filter ${label}`}
                className="relative grid h-7 w-7 shrink-0 place-items-center rounded-sm text-muted-foreground after:absolute after:-inset-2 after:content-[''] hover:bg-muted hover:text-foreground"
            >
                <X className="h-3 w-3" />
            </button>
        </span>
    )
}
