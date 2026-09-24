"use client"

/**
 * DateRangeFilter — unified period selector for the dashboard.
 *
 * Replaces the old split UX (a "Custom Range" dropdown item + two native
 * <input type="date"> fields). A single trigger button shows the active
 * period; clicking it opens a popover with quick presets on the left and a
 * 2-month range calendar on the right (the Linear / Stripe / GA pattern).
 *
 * It speaks the dashboard's existing model — `periodStr` +
 * `customStart`/`customEnd` (ISO `yyyy-MM-dd`) — so the aggregation engine and
 * YoY logic are untouched:
 *   - Named presets (This Month/Quarter/Year, All Time) set `periodStr` and
 *     keep the prior-year-pipeline YoY behaviour.
 *   - Date presets + calendar ranges set `periodStr="custom"` + ISO dates.
 *
 * Below `md` the popover (presets beside two months, ~680px) is wider than a
 * phone, so the same choices open in a bottom sheet instead: the presets as
 * choice chips, then one month with 40px days (M3: a menu or a popover
 * becomes a modal bottom sheet in a compact window; the Google Analytics app
 * picks a range the same way). That panel is `DateRangeChoices`, which the
 * dashboard's phone Filter sheet shows as its Date range section, so the
 * phone picks a range one way wherever it does.
 *
 * The quick ranges and the labels are in `lib/date-range-presets.ts`.
 */

import * as React from "react"
import { format, parseISO, isValid, subMonths } from "date-fns"
import { CalendarDays, Check, ChevronDown } from "@/components/icons"
import type { DateRange } from "react-day-picker"
import { Slot } from "radix-ui"

import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { useBelowMd } from "@/hooks/use-compact"
import { cn } from "@/lib/utils"
import {
    DATE_RANGE_PRESETS,
    DEFAULT_DASHBOARD_PERIOD,
    activeDateRangePreset,
    dateRangeLabel,
    type DateRangePreset,
} from "@/lib/date-range-presets"

interface DateRangeFilterProps {
    /** Current dashboard period string. */
    period: string
    /** ISO yyyy-MM-dd (empty unless period is "custom"). */
    customStart: string
    customEnd: string
    /** Commit a new selection. Sets period + custom dates in one call. */
    onSelect: (period: string, customStart: string, customEnd: string) => void
    /** "now" injection point for tests; defaults to new Date(). */
    now?: Date
    /** Visually mute the trigger when another temporary exploration filter is taking precedence. */
    muted?: boolean
    /** Optional tooltip/title explaining why the date range is muted. */
    mutedReason?: string
}

const iso = (d: Date) => format(d, "yyyy-MM-dd")

/**
 * The calendar's range as it is being picked. Explicit two-click range
 * selection: react-day-picker's default range behaviour treats a click as
 * "complete the range" whenever a `from` already exists, so reopening with
 * a prior range made the very first click commit against the stale anchor
 * and close the popover. We take over: click 1 always starts a fresh range,
 * click 2 sets the end and commits. `resetKey` (the popover's open state)
 * starts over from the committed range.
 */
function useRangeDraft(
    period: string,
    customStart: string,
    customEnd: string,
    onCommit: (start: string, end: string) => void,
    resetKey?: unknown,
) {
    const selectedRange = React.useMemo<DateRange | undefined>(() => {
        if (period !== "custom") return undefined
        const from = customStart ? parseISO(customStart) : undefined
        const to = customEnd ? parseISO(customEnd) : undefined
        if (!from || !isValid(from)) return undefined
        return { from, to: to && isValid(to) ? to : undefined }
    }, [period, customStart, customEnd])

    // In-progress calendar range so a partial (first-click) selection doesn't
    // commit until both ends are chosen.
    const [draft, setDraft] = React.useState<DateRange | undefined>(selectedRange)
    React.useEffect(() => { setDraft(selectedRange) }, [selectedRange, resetKey])

    const onDaySelect = (_range: DateRange | undefined, selectedDay: Date) => {
        if (!draft?.from || (draft.from && draft.to)) {
            // No range in progress, or a complete one exists → start over.
            setDraft({ from: selectedDay, to: undefined })
            return
        }
        // A start is set and we're picking the end.
        const from = draft.from
        const [start, end] = selectedDay < from ? [selectedDay, from] : [from, selectedDay]
        setDraft({ from: start, to: end })
        onCommit(iso(start), iso(end))
    }

    return { selectedRange, draft, onDaySelect }
}

/**
 * The phone's way to pick a range: the quick ranges as M3 choice chips
 * (8dp corners, the chosen one tonal with a check), then one month with
 * 40px days where a start day and an end day make a custom range. Each
 * pick commits at once through `onSelect`; the caller decides whether that
 * closes anything (the date sheet closes, the dashboard's Filter sheet
 * stays open).
 */
export function DateRangeChoices({
    period,
    customStart,
    customEnd,
    onSelect,
    now = new Date(),
    className,
}: {
    period: string
    customStart: string
    customEnd: string
    onSelect: (period: string, customStart: string, customEnd: string) => void
    now?: Date
    className?: string
}) {
    const { selectedRange, draft, onDaySelect } = useRangeDraft(period, customStart, customEnd, (start, end) => onSelect("custom", start, end))
    const activePresetKey = activeDateRangePreset(period, customStart, customEnd, now)

    return (
        <div className={className}>
            <div role="radiogroup" aria-label="Quick ranges" className="flex flex-wrap gap-2">
                {DATE_RANGE_PRESETS.map((p) => {
                    const checked = activePresetKey === p.key
                    return (
                        <button
                            key={p.key}
                            type="button"
                            role="radio"
                            aria-checked={checked}
                            onClick={() => {
                                const r = p.resolve(now)
                                onSelect(r.period, r.start, r.end)
                            }}
                            className={cn(
                                "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors",
                                checked
                                    ? "border-transparent bg-[var(--tonal)] text-[var(--tonal-foreground)]"
                                    : "border-border text-foreground hover:bg-muted",
                            )}
                        >
                            {checked && <Check className="h-4 w-4" aria-hidden="true" />}
                            {p.label}
                        </button>
                    )
                })}
            </div>
            <p className="mt-4 text-xs font-medium text-muted-foreground">Or tap a start day, then an end day</p>
            <div className="flex justify-center">
                <Calendar
                    mode="range"
                    numberOfMonths={1}
                    selected={draft}
                    onSelect={onDaySelect}
                    defaultMonth={selectedRange?.from ?? now}
                    captionLayout="dropdown"
                    className="bg-transparent px-0 [--cell-size:--spacing(10)]"
                />
            </div>
        </div>
    )
}

export function DateRangeFilter({
    period, customStart, customEnd, onSelect, now = new Date(), muted = false, mutedReason,
}: DateRangeFilterProps) {
    const [open, setOpen] = React.useState(false)
    const phone = useBelowMd()

    const { selectedRange, draft, onDaySelect } = useRangeDraft(
        period,
        customStart,
        customEnd,
        (start, end) => {
            onSelect("custom", start, end)
            setOpen(false)
        },
        open,
    )
    const activePresetKey = activeDateRangePreset(period, customStart, customEnd, now)

    const label = dateRangeLabel(period, customStart, customEnd)
    const isDefault = period === DEFAULT_DASHBOARD_PERIOD

    const applyPreset = (p: DateRangePreset) => {
        const r = p.resolve(now)
        onSelect(r.period, r.start, r.end)
        setOpen(false)
    }

    // `shrink-0`: between `md` and `lg` it sits in the dashboard's filter
    // row, which scrolls sideways rather than squeezing its chips.
    const trigger = (
        <button
            type="button"
            aria-label="Select date range"
            title={muted ? mutedReason : undefined}
            className={cn(
                "inline-flex shrink-0 items-center gap-1.5 h-8 px-2.5 rounded-lg border text-[12px] font-medium transition-colors shadow-none",
                muted && "opacity-45 grayscale",
                !isDefault
                    ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/15"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50",
            )}
        >
            <CalendarDays className="h-3.5 w-3.5 shrink-0 opacity-70" />
            <span className="truncate max-w-[220px]">{label}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </button>
    )

    if (phone) {
        return (
            <>
                <Slot.Root onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}>{trigger}</Slot.Root>
                <BottomSheet open={open} onOpenChange={setOpen} title="Date range">
                    <DateRangeChoices
                        period={period}
                        customStart={customStart}
                        customEnd={customEnd}
                        onSelect={(p, s, e) => {
                            onSelect(p, s, e)
                            setOpen(false)
                        }}
                        now={now}
                        className="px-4"
                    />
                </BottomSheet>
            </>
        )
    }

    return (
        <Popover open={open} onOpenChange={setOpen} modal>
            <PopoverTrigger asChild>
                {trigger}
            </PopoverTrigger>
            <PopoverContent align="start" sideOffset={8} className="w-auto p-0 overflow-hidden">
                <div className="flex">
                    {/* Presets */}
                    <div className="flex flex-col gap-0.5 p-2 border-r border-border w-[150px] shrink-0">
                        <p className="px-2 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Quick ranges
                        </p>
                        {DATE_RANGE_PRESETS.map((p) => (
                            <button
                                key={p.key}
                                type="button"
                                onClick={() => applyPreset(p)}
                                className={cn(
                                    "text-left px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors",
                                    activePresetKey === p.key
                                        ? "bg-primary/10 text-primary"
                                        : "text-slate-600 hover:bg-slate-100",
                                )}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                    {/* Range calendar */}
                    <div className="p-2">
                        <Calendar
                            mode="range"
                            numberOfMonths={2}
                            selected={draft}
                            onSelect={onDaySelect}
                            defaultMonth={selectedRange?.from ?? subMonths(now, 1)}
                            captionLayout="dropdown"
                        />
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}
