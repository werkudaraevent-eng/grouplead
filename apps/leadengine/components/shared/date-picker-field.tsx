"use client"

/**
 * Date picker — Popover + react-day-picker (shadcn Calendar).
 *
 * Replaces the native `<input type="date">` pattern that was hacked
 * with a left-aligned overlay icon (causing a *double* calendar icon
 * because Chromium also paints its own at the right).
 *
 * Stores ISO date string `yyyy-MM-dd` so payloads stay unchanged.
 */

import * as React from "react"
import { format, isValid, parseISO } from "date-fns"
import { CalendarDays, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface DatePickerFieldProps {
    /** ISO yyyy-MM-dd or empty string. */
    value: string
    onChange: (value: string) => void
    placeholder?: string
    disabled?: boolean
    className?: string
    /** Allow the user to clear the date. */
    clearable?: boolean
    /** Min selectable date (ISO). */
    minDate?: string
    /** Max selectable date (ISO). */
    maxDate?: string
}

export function DatePickerField({
    value,
    onChange,
    placeholder = "Select date",
    disabled,
    className,
    clearable = true,
    minDate,
    maxDate,
}: DatePickerFieldProps) {
    const [open, setOpen] = React.useState(false)

    const parsedDate = React.useMemo(() => {
        if (!value) return undefined
        const d = parseISO(value)
        return isValid(d) ? d : undefined
    }, [value])

    const display = parsedDate ? format(parsedDate, "d MMM yyyy") : ""

    const min = minDate ? parseISO(minDate) : undefined
    const max = maxDate ? parseISO(maxDate) : undefined

    return (
        <Popover open={open} onOpenChange={setOpen} modal>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    disabled={disabled}
                    className={cn(
                        "w-full justify-start font-normal h-9 px-3 text-sm",
                        !display && "text-muted-foreground",
                        className,
                    )}
                >
                    <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 text-left truncate">
                        {display || placeholder}
                    </span>
                    {clearable && parsedDate && (
                        <span
                            role="button"
                            tabIndex={-1}
                            onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                onChange("")
                            }}
                            className="ml-2 inline-flex items-center justify-center rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            aria-label="Clear date"
                        >
                            <X className="h-3.5 w-3.5" />
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="single"
                    selected={parsedDate}
                    onSelect={(d) => {
                        if (!d) {
                            onChange("")
                        } else {
                            onChange(format(d, "yyyy-MM-dd"))
                        }
                        setOpen(false)
                    }}
                    captionLayout="dropdown"
                    disabled={(date) => {
                        if (min && date < min) return true
                        if (max && date > max) return true
                        return false
                    }}
                    autoFocus
                />
            </PopoverContent>
        </Popover>
    )
}
