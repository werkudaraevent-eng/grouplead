"use client"

import { useState, useMemo, useCallback } from "react"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CalendarDays } from "lucide-react"

export interface PeriodSelection {
  periodStart: string | null
  periodEnd: string | null
  periodType: string
}

interface PeriodSelectorProps {
  value?: PeriodSelection
  onChange: (selection: PeriodSelection) => void
}

/** Monday-based ISO week start */
function getISOWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function getISOWeekEnd(date: Date): Date {
  const start = getISOWeekStart(date)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  return end
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function computePresetDates(preset: string): { start: string; end: string } {
  const now = new Date()
  switch (preset) {
    case "this_week": {
      return { start: fmt(getISOWeekStart(now)), end: fmt(getISOWeekEnd(now)) }
    }
    case "this_month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return { start: fmt(start), end: fmt(end) }
    }
    case "this_quarter": {
      const q = Math.floor(now.getMonth() / 3)
      const start = new Date(now.getFullYear(), q * 3, 1)
      const end = new Date(now.getFullYear(), q * 3 + 3, 0)
      return { start: fmt(start), end: fmt(end) }
    }
    case "this_year": {
      return {
        start: `${now.getFullYear()}-01-01`,
        end: `${now.getFullYear()}-12-31`,
      }
    }
    default:
      return { start: "", end: "" }
  }
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  const periodType = value?.periodType ?? "all"
  const [customStart, setCustomStart] = useState(value?.periodStart ?? "")
  const [customEnd, setCustomEnd] = useState(value?.periodEnd ?? "")
  const [customOpen, setCustomOpen] = useState(false)

  const handlePresetChange = useCallback(
    (preset: string) => {
      if (preset === "all") {
        onChange({ periodStart: null, periodEnd: null, periodType: "all" })
        return
      }
      if (preset === "custom") {
        setCustomOpen(true)
        return
      }
      const { start, end } = computePresetDates(preset)
      onChange({ periodStart: start, periodEnd: end, periodType: preset })
    },
    [onChange]
  )

  const handleCustomApply = useCallback(() => {
    if (customStart && customEnd) {
      onChange({ periodStart: customStart, periodEnd: customEnd, periodType: "custom" })
      setCustomOpen(false)
    }
  }, [customStart, customEnd, onChange])

  const displayLabel = useMemo(() => {
    const labels: Record<string, string> = {
      all: "Full Year",
      this_week: "This Week",
      this_month: "This Month",
      this_quarter: "This Quarter",
      this_year: "This Year",
      custom: "Custom Range",
    }
    return labels[periodType] ?? "Full Year"
  }, [periodType])

  return (
    <div className="flex items-center gap-2">
      <Select value={periodType} onValueChange={handlePresetChange}>
        <SelectTrigger className="w-[160px] h-8 text-xs">
          <CalendarDays className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
          <SelectValue placeholder={displayLabel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Full Year</SelectItem>
          <SelectItem value="this_week">This Week</SelectItem>
          <SelectItem value="this_month">This Month</SelectItem>
          <SelectItem value="this_quarter">This Quarter</SelectItem>
          <SelectItem value="this_year">This Year</SelectItem>
          <SelectItem value="custom">Custom Range</SelectItem>
        </SelectContent>
      </Select>

      {periodType === "custom" && (
        <Popover open={customOpen} onOpenChange={setCustomOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {customStart && customEnd
                ? `${customStart} – ${customEnd}`
                : "Set Range"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72">
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Start Date</Label>
                <Input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">End Date</Label>
                <Input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={handleCustomApply}
                disabled={!customStart || !customEnd}
              >
                Apply
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
