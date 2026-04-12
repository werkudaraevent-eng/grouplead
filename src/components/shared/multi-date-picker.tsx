"use client"
import React, { useState, useMemo, useCallback } from "react"
import { CalendarIcon, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover"

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate() }
function getFirstDay(y: number, m: number) { return new Date(y, m, 1).getDay() }
function toKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` }
function parseKey(k: string) { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d) }

function formatSummary(keys: string[]) {
    if (!keys.length) return ""
    const sorted = [...keys].sort()
    const dates = sorted.map(parseKey)
    const ranges: [Date, Date][] = []
    let start = dates[0], prev = dates[0]
    for (let i = 1; i < dates.length; i++) {
        const diff = (dates[i].getTime() - prev.getTime()) / 86400000
        if (Math.round(diff) === 1) { prev = dates[i] }
        else { ranges.push([start, prev]); start = dates[i]; prev = dates[i] }
    }
    ranges.push([start, prev])

    return ranges.map(([s, e]) => {
        const sm = MONTHS[s.getMonth()].slice(0, 3)
        const em = MONTHS[e.getMonth()].slice(0, 3)
        const sy = s.getFullYear(), ey = e.getFullYear()
        if (s.getTime() === e.getTime()) return `${s.getDate()} ${sm} ${sy}`
        if (s.getMonth() === e.getMonth() && sy === ey) return `${s.getDate()}–${e.getDate()} ${sm} ${sy}`
        return `${s.getDate()} ${sm} – ${e.getDate()} ${em} ${ey}`
    }).join(", ")
}

interface MultiDatePickerProps {
    value?: string[]
    onChange?: (dates: string[]) => void
}

export function MultiDatePicker({ value = [], onChange }: MultiDatePickerProps) {
    const today = new Date()
    const [viewYear, setViewYear] = useState(today.getFullYear())
    const [viewMonth, setViewMonth] = useState(today.getMonth())
    const [calOpen, setCalOpen] = useState(false)
    const [shiftHeld, setShiftHeld] = useState(false)
    const [lastClicked, setLastClicked] = useState<string | null>(null)
    const [hoveredDate, setHoveredDate] = useState<string | null>(null)

    const selected = useMemo(() => new Set(value), [value])

    const previewRange = useMemo(() => {
        if (!shiftHeld || !lastClicked || !hoveredDate) return new Set<string>()
        const a = parseKey(lastClicked), b = parseKey(hoveredDate)
        const start = a < b ? a : b, end = a < b ? b : a
        const s = new Set<string>()
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) s.add(toKey(new Date(d)))
        return s
    }, [shiftHeld, lastClicked, hoveredDate])

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => { if (e.key === "Shift") setShiftHeld(true) }, [])
    const handleKeyUp = useCallback((e: React.KeyboardEvent) => { if (e.key === "Shift") setShiftHeld(false) }, [])

    const toggleDate = (key: string) => {
        const next = new Set(selected)
        if (shiftHeld && lastClicked) {
            const a = parseKey(lastClicked), b = parseKey(key)
            const start = a < b ? a : b, end = a < b ? b : a
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) next.add(toKey(new Date(d)))
        } else {
            if (next.has(key)) next.delete(key); else next.add(key)
        }
        onChange?.(Array.from(next))
        setLastClicked(key)
    }

    const removeDate = (key: string) => {
        const n = new Set(selected); n.delete(key); onChange?.(Array.from(n))
    }

    const clearAll = () => onChange?.([])

    const daysInMonth = getDaysInMonth(viewYear, viewMonth)
    const firstDay = getFirstDay(viewYear, viewMonth)
    const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); } else setViewMonth(viewMonth - 1); }
    const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); } else setViewMonth(viewMonth + 1); }

    const sortedSelected = [...selected].sort()
    const summary = formatSummary(sortedSelected)

    const cells = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)

    return (
        <div
            className="w-full font-sans focus:outline-none"
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            onBlur={() => setShiftHeld(false)}
        >
            <Popover open={calOpen} onOpenChange={(open) => {
                setCalOpen(open)
                if (!open) setShiftHeld(false)
            }}>
                <PopoverAnchor asChild>
                    <div
                        className={cn(
                            "min-h-9 flex flex-wrap items-center gap-1.5 px-3 py-1.5 border rounded-md cursor-pointer transition-all",
                            calOpen ? "border-primary shadow-[0_0_0_2px_rgba(var(--primary),0.1)] bg-white" : "border-input bg-background hover:bg-accent/50"
                        )}
                        onClick={(e) => {
                            // Don't toggle if clicking on a remove button (which calls stopPropagation)
                            if (e.defaultPrevented) return
                            setCalOpen(!calOpen)
                        }}
                    >
                <CalendarIcon className="w-4 h-4 text-slate-400 shrink-0" />

                {sortedSelected.length === 0 && <span className="text-sm text-muted-foreground ml-1">Pick dates</span>}

                {sortedSelected.slice(0, 8).map(k => {
                    const d = parseKey(k)
                    return (
                        <span key={k} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium px-2 py-0.5 rounded-md animate-in zoom-in-95 duration-200 border border-primary/20" onClick={e => e.stopPropagation()}>
                            {d.getDate()} {MONTHS[d.getMonth()].slice(0, 3)}
                            <button type="button" onClick={() => removeDate(k)} className="hover:bg-primary/20 text-primary rounded p-0.5 ml-0.5 transition-colors">
                                <X className="w-3 h-3" />
                            </button>
                        </span>
                    )
                })}
                {sortedSelected.length > 8 && <span className="text-xs font-semibold text-primary">+{sortedSelected.length - 8} more</span>}

                {sortedSelected.length > 0 && (
                    <button type="button" className="ml-auto text-xs font-semibold text-primary hover:bg-primary/10 px-2 py-1 rounded transition-colors" onClick={e => { e.stopPropagation(); clearAll(); e.preventDefault(); }}>
                        Clear all
                    </button>
                )}
                    </div>
                </PopoverAnchor>

                <PopoverContent 
                    className="w-[280px] p-3 animate-in fade-in-0 zoom-in-95 duration-200" 
                    align="start" 
                    sideOffset={8}
                    onOpenAutoFocus={(e) => e.preventDefault()}
                >
                    <div className="flex items-center justify-between mb-3">
                        <button type="button" onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all font-medium text-sm">&lsaquo;</button>
                        <span className="font-semibold text-sm text-slate-800 tracking-tight">{MONTHS[viewMonth]} {viewYear}</span>
                        <button type="button" onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all font-medium text-sm">&rsaquo;</button>
                    </div>
                        <div className="grid grid-cols-7 gap-1 text-center mb-2">
                            {DAYS.map(d => <div key={d} className="text-xs font-semibold text-muted-foreground py-1 uppercase">{d}</div>)}
                            {cells.map((day, i) => {
                                if (day === null) return <div key={`e${i}`} className="w-8 h-8 mx-auto" />
                                const key = toKey(new Date(viewYear, viewMonth, day))
                                const isSelected = selected.has(key)
                                const isPreview = previewRange.has(key) && !isSelected
                                const isToday = key === toKey(today)

                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        className={cn(
                                            "w-8 h-8 mx-auto flex items-center justify-center rounded-md text-sm font-medium transition-all",
                                            isSelected
                                                ? "bg-primary text-primary-foreground font-bold shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
                                                : isPreview
                                                    ? "bg-primary/10 text-primary"
                                                    : isToday
                                                        ? "ring-[1.5px] ring-inset ring-primary/50 text-primary hover:bg-primary/5"
                                                        : "text-slate-700 hover:bg-slate-100"
                                        )}
                                        onClick={() => toggleDate(key)}
                                        onMouseEnter={() => setHoveredDate(key)}
                                        onMouseLeave={() => setHoveredDate(null)}
                                    >
                                        {day}
                                    </button>
                                )
                            })}
                        </div>
                        {sortedSelected.length > 0 && (
                            <div className="mt-2 p-2 bg-slate-50 rounded-md text-xs text-slate-600 leading-tight">
                                <strong className="text-slate-800 font-semibold">{sortedSelected.length} date{sortedSelected.length > 1 ? "s" : ""}</strong> &mdash; {summary}
                            </div>
                        )}
                    <div className="text-xs text-slate-400 mt-2 text-center">
                        Click dates to toggle &bull; Hold <kbd className="font-sans px-1 bg-slate-100 border border-slate-200 rounded text-slate-600">Shift</kbd> + click to select a range
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    )
}
