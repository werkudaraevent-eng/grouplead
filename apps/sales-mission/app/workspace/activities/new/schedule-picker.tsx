"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight } from "@/components/icons"
import type { ConflictSettings } from "@/lib/missions/mission-join"
import { buildMonthGrid, formatMonthLabel, shiftMonth } from "@/lib/missions/mission-calendar"
import {
  busyBlocksOn,
  busyDays,
  judgeSlot,
  type PersonSchedule,
} from "@/lib/missions/schedule-availability"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

/**
 * Pick a date and time while seeing the team's calendar.
 *
 * The shape is the one every scheduling product has settled on: a month on
 * the left to choose a day, that day as a timeline on the right to choose a
 * time. Two questions, asked in order, never both at once.
 *
 * What is borrowed is the logic, not the look. From Calendly, day-then-time.
 * From Google Calendar's "find a time", busy blocks are drawn and named
 * rather than hidden: a scheduler who cannot see why 10:00 is unavailable
 * cannot work around it. From both, a clash is a warning, not a wall. The
 * appointment team books two visits in one building on purpose; refusing the
 * click would stop that to protect a rule the server already enforces.
 *
 * Before a primary is chosen there is nothing to draw, and the picker says
 * so instead of showing an empty calendar that looks like a free one.
 */

const WEEKDAYS = ["S", "S", "R", "K", "J", "S", "M"]
/** Working hours drawn on the timeline. Visits outside are still drawn, clipped. */
const DAY_START = 7 * 60
const DAY_END = 19 * 60
const PX_PER_HOUR = 44

const BLOCK_TONES = [
  "bg-primary/15 border-primary/40 text-primary",
  "bg-[var(--success)] border-[var(--success-foreground)]/40 text-[var(--success-foreground)]",
  "bg-secondary border-secondary-foreground/30 text-secondary-foreground",
]

export interface ScheduleValue {
  date: string
  startTime: string
  endTime: string
}

export function SchedulePicker({
  value,
  onChange,
  people,
  settings,
  location,
  missionId,
  now,
  names = { date: "date", startTime: "startTime", endTime: "endTime" },
  endRequired = false,
}: {
  value: ScheduleValue
  onChange: (next: ScheduleValue) => void
  /** Calendars of everyone being assigned. Empty until a primary is chosen. */
  people: PersonSchedule[]
  settings: ConflictSettings
  /** The candidate's location, for the same-building buffer waiver. */
  location: string | null
  /** When rescheduling, so the mission's own slot is not a clash. */
  missionId?: string
  now: Date
  /** Hidden-input names, so the form submits the same fields it always did. */
  names?: { date: string; startTime: string; endTime: string }
  endRequired?: boolean
}) {
  const [month, setMonth] = useState(value.date.slice(0, 7))
  const grid = useMemo(() => buildMonthGrid(month, [], now), [month, now])

  // When editing, the mission's own slot is in the team's calendars. It is
  // not "busy" for the purpose of choosing its new time, and painting it
  // under the candidate put two labels on one rectangle. It is taken out of
  // the busy layer and, once the candidate has moved away from it, drawn
  // once as a ghost so the person can see from where to where.
  const others = useMemo(
    () =>
      missionId
        ? people.map((person) => ({ ...person, blocks: person.blocks.filter((block) => block.missionId !== missionId) }))
        : people,
    [people, missionId]
  )
  const original = useMemo(() => {
    if (!missionId) return null
    return busyBlocksOn(value.date, people).find((block) => block.missionId === missionId) ?? null
  }, [people, missionId, value.date])

  const busy = useMemo(() => busyDays(others), [others])
  const dayBlocks = useMemo(() => busyBlocksOn(value.date, others), [value.date, others])
  const verdict = useMemo(
    () => judgeSlot({ ...value, location, missionId }, people, settings),
    [value, location, missionId, people, settings]
  )
  const tone = useMemo(() => {
    const map = new Map<string, string>()
    people.forEach((person, index) => map.set(person.name, BLOCK_TONES[index % BLOCK_TONES.length]))
    return map
  }, [people])

  const startMinute = value.startTime ? toMinute(value.startTime) : null
  const endMinute = value.endTime ? toMinute(value.endTime) : startMinute !== null ? startMinute + 60 : null

  return (
    <div className="rounded-lg border bg-field">
      {/* The real form fields. The picker is the affordance. */}
      <input type="hidden" name={names.date} value={value.date} />
      <input type="hidden" name={names.startTime} value={value.startTime} />
      <input type="hidden" name={names.endTime} value={value.endTime} />

      <div className="grid sm:grid-cols-[17rem_1fr]">
        {/* ── Month ── */}
        <div className="border-b p-4 sm:border-b-0 sm:border-r">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMonth(shiftMonth(month, -1))}
              aria-label="Bulan sebelumnya"
              className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-foreground">{formatMonthLabel(month)}</span>
            <button
              type="button"
              onClick={() => setMonth(shiftMonth(month, 1))}
              aria-label="Bulan berikutnya"
              className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((day, index) => (
              <span key={index} className="grid h-7 place-items-center text-[11px] font-semibold text-muted-foreground">
                {day}
              </span>
            ))}
            {Array.from({ length: grid.leadingBlanks }, (_, index) => (
              <span key={`blank-${index}`} aria-hidden="true" className="h-9" />
            ))}
            {grid.days.map((day) => {
              const selected = day.date === value.date
              const hasVisit = busy.has(day.date)
              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => onChange({ ...value, date: day.date })}
                  aria-pressed={selected}
                  aria-label={`${day.dayOfMonth}${hasVisit ? ", ada kunjungan" : ""}`}
                  className={cn(
                    "relative grid h-9 place-items-center rounded-md text-sm transition-colors",
                    selected
                      ? "bg-primary font-semibold text-primary-foreground"
                      : day.isToday
                        ? "border border-primary font-semibold text-primary hover:bg-muted"
                        : "text-foreground hover:bg-muted"
                  )}
                >
                  {day.dayOfMonth}
                  {hasVisit && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute bottom-1 h-1 w-1 rounded-full",
                        selected ? "bg-primary-foreground" : "bg-[var(--warning-foreground)]"
                      )}
                    />
                  )}
                </button>
              )
            })}
          </div>

          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--warning-foreground)]" />
            Sudah ada kunjungan tim di hari itu
          </p>
        </div>

        {/* ── Day ── */}
        <div className="p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${names.startTime}-input`} className="text-foreground">
                Jam mulai<span className="ml-0.5 text-[var(--danger-foreground)]" aria-hidden="true">*</span>
              </Label>
              <Input
                id={`${names.startTime}-input`}
                type="time"
                required
                value={value.startTime}
                onChange={(event) => onChange({ ...value, startTime: event.target.value })}
                className="h-12 bg-card"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${names.endTime}-input`} className="text-foreground">
                Jam selesai
                {endRequired && <span className="ml-0.5 text-[var(--danger-foreground)]" aria-hidden="true">*</span>}
              </Label>
              <Input
                id={`${names.endTime}-input`}
                type="time"
                required={endRequired}
                value={value.endTime}
                onChange={(event) => onChange({ ...value, endTime: event.target.value })}
                className="h-12 bg-card"
              />
            </div>
          </div>

          {people.length === 0 ? (
            <p className="mt-4 flex items-start gap-2 rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" />
              Pilih sales utama dulu, lalu jadwalnya tampil di sini supaya jam yang dipilih tidak bentrok.
            </p>
          ) : (
            <>
              <p className="mt-4 text-xs font-semibold text-muted-foreground">
                {formatDayLabel(value.date)} · {dayBlocks.length === 0 ? "kosong" : `${dayBlocks.length} kunjungan`}
              </p>

              {/* Timeline: hours down the left, busy blocks positioned by minute,
                  the candidate drawn on top so the overlap is literally visible. */}
              <div
                className="relative mt-2 overflow-hidden rounded-md border bg-card"
                style={{ height: ((DAY_END - DAY_START) / 60) * PX_PER_HOUR }}
                aria-label="Jadwal hari terpilih"
              >
                {Array.from({ length: (DAY_END - DAY_START) / 60 + 1 }, (_, index) => {
                  const minute = DAY_START + index * 60
                  return (
                    <div
                      key={minute}
                      className="absolute left-0 right-0 flex items-start gap-2 border-t border-border/60 text-[10px] text-muted-foreground"
                      style={{ top: ((minute - DAY_START) / 60) * PX_PER_HOUR }}
                    >
                      <span className="w-10 shrink-0 pl-2 pt-0.5 tabular-nums">{toLabel(minute)}</span>
                    </div>
                  )
                })}

                {dayBlocks.map((block) => {
                  const top = ((Math.max(block.startMinute, DAY_START) - DAY_START) / 60) * PX_PER_HOUR
                  const height = ((Math.min(block.endMinute, DAY_END) - Math.max(block.startMinute, DAY_START)) / 60) * PX_PER_HOUR
                  if (height <= 0) return null
                  // The travel buffer is shaded around the block, so "the slot
                  // right after" reads as tight before it is clicked.
                  const buffer = (settings.conflictCheckEnabled ? settings.travelBufferMinutes : 0) / 60 * PX_PER_HOUR
                  return (
                    <div key={`${block.missionId}-${block.personName}`}>
                      {buffer > 0 && (
                        <div
                          aria-hidden="true"
                          className="absolute left-12 right-2 rounded-md bg-muted-foreground/10"
                          style={{ top: Math.max(0, top - buffer), height: height + buffer * 2 }}
                        />
                      )}
                      <div
                        className={cn(
                          "absolute left-12 right-2 overflow-hidden rounded-md border px-2 py-1 text-xs leading-tight",
                          tone.get(block.personName) ?? BLOCK_TONES[0]
                        )}
                        style={{ top, height: Math.max(height, 22) }}
                      >
                        <span className="block truncate font-semibold">{block.personName} · {block.label}</span>
                        {block.location && height >= 36 && <span className="block truncate">{block.location}</span>}
                      </div>
                    </div>
                  )
                })}

                {original && (original.startMinute !== startMinute || original.endMinute !== endMinute) && (
                  <div
                    aria-hidden="true"
                    className="absolute left-12 right-2 rounded-md border border-dashed border-muted-foreground/50 px-2 py-1 text-xs text-muted-foreground"
                    style={{
                      top: ((Math.max(original.startMinute, DAY_START) - DAY_START) / 60) * PX_PER_HOUR,
                      height: Math.max(((Math.min(original.endMinute, DAY_END) - Math.max(original.startMinute, DAY_START)) / 60) * PX_PER_HOUR, 22),
                    }}
                  >
                    Jadwal saat ini · {original.label}
                  </div>
                )}

                {startMinute !== null && endMinute !== null && endMinute > startMinute && (
                  <div
                    aria-hidden="true"
                    className={cn(
                      "absolute left-12 right-2 rounded-md border-2 border-dashed px-2 py-1 text-xs font-semibold",
                      verdict.clear
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-[var(--danger-foreground)] bg-[var(--danger)] text-[var(--danger-foreground)]"
                    )}
                    style={{
                      top: ((Math.max(startMinute, DAY_START) - DAY_START) / 60) * PX_PER_HOUR,
                      height: Math.max(((Math.min(endMinute, DAY_END) - Math.max(startMinute, DAY_START)) / 60) * PX_PER_HOUR, 22),
                    }}
                  >
                    Kunjungan ini
                  </div>
                )}
              </div>

              {!verdict.clear && (
                <p className="mt-3 flex items-start gap-2 rounded-md border border-[var(--danger-foreground)]/25 bg-[var(--danger)] px-3 py-2.5 text-sm text-[var(--danger-foreground)]" role="status">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Bentrok:{" "}
                    {verdict.clashes.map((clash) => `${clash.personName} sudah ada kunjungan ${clash.label}`).join("; ")}
                    {settings.conflictCheckEnabled && settings.travelBufferMinutes > 0
                      ? ` (termasuk jeda perjalanan ${settings.travelBufferMinutes} menit).`
                      : "."}
                  </span>
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function toMinute(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

function toLabel(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:00`
}

function formatDayLabel(date: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${date}T00:00:00+07:00`))
}
