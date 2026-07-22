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
 */

import * as React from "react"
import {
    format, parseISO, isValid,
    startOfMonth, endOfMonth, subMonths, subDays, startOfYear,
} from "date-fns"
import { CalendarDays, ChevronDown } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

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

type Preset = {
    key: string
    label: string
    resolve: (now: Date) => { period: string; start: string; end: string }
}

// Order matters — this is the visual order in the popover.
const PRESETS: Preset[] = [
    { key: "today", label: "Today", resolve: (n) => ({ period: "custom", start: iso(n), end: iso(n) }) },
    { key: "last7", label: "Last 7 days", resolve: (n) => ({ period: "custom", start: iso(subDays(n, 6)), end: iso(n) }) },
    { key: "last30", label: "Last 30 days", resolve: (n) => ({ period: "custom", start: iso(subDays(n, 29)), end: iso(n) }) },
    { key: "this_month", label: "This Month", resolve: () => ({ period: "this_month", start: "", end: "" }) },
    { key: "last_month", label: "Last Month", resolve: (n) => ({ period: "custom", start: iso(startOfMonth(subMonths(n, 1))), end: iso(endOfMonth(subMonths(n, 1))) }) },
    { key: "this_quarter", label: "This Quarter", resolve: () => ({ period: "this_quarter", start: "", end: "" }) },
    { key: "this_year", label: "This Year", resolve: () => ({ period: "this_year", start: "", end: "" }) },
    { key: "ytd", label: "Year to Date", resolve: (n) => ({ period: "custom", start: iso(startOfYear(n)), end: iso(n) }) },
    { key: "all_time", label: "All Time", resolve: () => ({ period: "all_time", start: "", end: "" }) },
]

const NAMED_LABELS: Record<string, string> = {
    this_month: "This Month",
    this_quarter: "This Quarter",
    this_year: "This Year",
    all_time: "All Time",
}

function formatActiveLabel(period: string, start: string, end: string): string {
    if (NAMED_LABELS[period]) return NAMED_LABELS[period]
    if (period === "custom" && start && end) {
        const sd = parseISO(start)
        const ed = parseISO(end)
        if (isValid(sd) && isValid(ed)) {
            if (sd.getTime() === ed.getTime()) return format(sd, "d MMM yyyy")
            const sameYear = sd.getFullYear() === ed.getFullYear()
            return `${format(sd, sameYear ? "d MMM" : "d MMM yyyy")} – ${format(ed, "d MMM yyyy")}`
        }
    }
    return "Date Range"
}

export function DateRangeFilter({
    period, customStart, customEnd, onSelect, now = new Date(), muted = false, mutedReason,
}: DateRangeFilterProps) {
    const [open, setOpen] = React.useState(false)

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
    React.useEffect(() => { setDraft(selectedRange) }, [selectedRange, open])

    const activePresetKey = React.useMemo(() => {
        for (const p of PRESETS) {
            const r = p.resolve(now)
            if (r.period === "custom") {
                if (period === "custom" && r.start === customStart && r.end === customEnd) return p.key
            } else if (r.period === period) {
                return p.key
            }
        }
        return null
    }, [period, customStart, customEnd, now])

    const label = formatActiveLabel(period, customStart, customEnd)
    const isDefault = period === "this_quarter"

    const applyPreset = (p: Preset) => {
        const r = p.resolve(now)
        onSelect(r.period, r.start, r.end)
        setOpen(false)
    }

    // Explicit two-click range selection. react-day-picker's default range
    // behaviour treats a click as "complete the range" whenever a `from`
    // already exists — so reopening with a prior range made the very first
    // click commit against the stale anchor and close the popover. We take
    // over: click 1 always starts a fresh range, click 2 sets the end + commits.
    const handleDaySelect = (_range: DateRange | undefined, selectedDay: Date) => {
        if (!draft?.from || (draft.from && draft.to)) {
            // No range in progress, or a complete one exists → start over.
            setDraft({ from: selectedDay, to: undefined })
            return
        }
        // A start is set and we're picking the end.
        const from = draft.from
        const [start, end] = selectedDay < from ? [selectedDay, from] : [from, selectedDay]
        setDraft({ from: start, to: end })
        onSelect("custom", iso(start), iso(end))
        setOpen(false)
    }

    return (
        <Popover open={open} onOpenChange={setOpen} modal>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label="Select date range"
                    title={muted ? mutedReason : undefined}
                    className={cn(
                        "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-[12px] font-medium transition-colors shadow-none",
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
            </PopoverTrigger>
            <PopoverContent align="start" sideOffset={8} className="w-auto p-0 overflow-hidden">
                <div className="flex">
                    {/* Presets */}
                    <div className="flex flex-col gap-0.5 p-2 border-r border-border w-[150px] shrink-0">
                        <p className="px-2 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Quick ranges
                        </p>
                        {PRESETS.map((p) => (
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
                            onSelect={handleDaySelect}
                            defaultMonth={selectedRange?.from ?? subMonths(now, 1)}
                            captionLayout="dropdown"
                        />
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}
