import Link from "next/link"
import { CalendarDays, ChevronLeft, ChevronRight } from "@/components/icons"
import { formatMonthLabel, type CalendarDay } from "@/lib/missions/mission-calendar"
import { MISSION_TIME_ZONE, type MissionListItem } from "@/lib/missions/mission-schema"
import { cn } from "@/lib/utils"

/**
 * The month view, shared by the signed-in calendar and the public one.
 *
 * Material has no "calendar with events" component; its date picker marks only
 * today and the selection. Its badge does apply: a small badge says something
 * exists, a large badge with a number says how many. The month grid Google
 * Calendar draws goes one step further and names the events. So: on a phone
 * each day gets the numbered badge; from `md` the cell is tall enough to list
 * the first two visits as chips and count the rest, and from `lg` the cell is a
 * size container (`.cal-cell` in globals.css) that shows as many as its height
 * allows. No floors, so nothing can overflow the card, whatever the height.
 *
 * Everything a viewer implies — who they are, what they may do — is a prop, so
 * the public page renders the same grid with different links and no actions.
 */

const WEEKDAYS = ["S", "S", "R", "K", "J", "S", "M"]

// Literal classes, one per possible count, so Tailwind emits them.
const WEEK_ROWS: Record<number, string> = {
  4: "lg:grid-rows-[auto_repeat(4,minmax(0,1fr))]",
  5: "lg:grid-rows-[auto_repeat(5,minmax(0,1fr))]",
  6: "lg:grid-rows-[auto_repeat(6,minmax(0,1fr))]",
}

const timeOf = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("en-GB", { timeZone: MISSION_TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso))
    : ""

export function MonthGrid<T extends MissionListItem>({
  month,
  grid,
  selectedDay,
  today,
  hrefFor,
  navHref,
  footer,
}: {
  month: string
  grid: { leadingBlanks: number; days: CalendarDay<T>[] }
  selectedDay: string
  today: string
  hrefFor: (day: string) => string
  navHref: { prev: string; next: string; today: string }
  footer: React.ReactNode
}) {
  const weekRows = Math.ceil((grid.leadingBlanks + grid.days.length) / 7)

  return (
    <article className="flex min-w-0 flex-col rounded-xl border bg-card lg:min-h-0">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Tampilan bulan</p>
          <h2 className="mt-1 text-base font-semibold text-foreground">{formatMonthLabel(month)}</h2>
        </div>
        <div className="flex items-center gap-1.5">
          {/* The jump every calendar app has: back to now, whatever month the
              arrows reached. Hidden while today is already in view. */}
          {!(month === today.slice(0, 7) && selectedDay === today) && (
            <Link
              href={navHref.today}
              className="mr-1 inline-flex h-11 items-center rounded-md border px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted md:h-8"
            >
              Hari ini
            </Link>
          )}
          <Link
            href={navHref.prev}
            aria-label="Bulan sebelumnya"
            className="grid h-11 w-11 place-items-center rounded-md border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:h-8 md:w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <Link
            href={navHref.next}
            aria-label="Bulan berikutnya"
            className="grid h-11 w-11 place-items-center rounded-md border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:h-8 md:w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-5">
        <div className={cn("grid min-h-0 grid-cols-7 gap-1 md:gap-1.5 lg:flex-1", WEEK_ROWS[weekRows] ?? WEEK_ROWS[6])}>
          {WEEKDAYS.map((day, index) => (
            <span key={`weekday-${index}`} className="grid h-7 place-items-center text-[10px] font-bold uppercase text-muted-foreground">
              {day}
            </span>
          ))}
          {Array.from({ length: grid.leadingBlanks }, (_, index) => (
            <span key={`blank-${index}`} aria-hidden="true" className="h-11 md:h-auto" />
          ))}
          {grid.days.map((day) => {
            const selected = day.date === selectedDay
            const shown = day.missions.slice(0, 2)
            const more = day.missionCount - shown.length
            return (
              <Link
                key={day.date}
                href={hrefFor(day.date)}
                aria-label={`${day.dayOfMonth}, ${day.missionCount} aktivitas`}
                aria-current={selected ? "date" : undefined}
                className={cn(
                  "cal-cell relative flex h-11 min-w-0 flex-col items-center justify-center overflow-hidden rounded-lg border border-transparent text-xs transition-colors md:h-auto md:min-h-[4.5rem] md:items-stretch md:justify-start md:p-1.5 lg:min-h-0",
                  selected
                    ? "bg-primary font-bold text-primary-foreground"
                    : day.isToday
                      ? "border-primary font-bold text-primary hover:bg-muted"
                      : "text-foreground hover:bg-muted"
                )}
              >
                <span className="md:px-1">{day.dayOfMonth}</span>
                {day.missionCount > 0 && (
                  <span
                    className={cn(
                      "cal-badge absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold leading-none md:hidden",
                      selected ? "bg-primary-foreground text-primary" : "bg-accent text-accent-foreground"
                    )}
                  >
                    {day.missionCount}
                  </span>
                )}
                {shown.length > 0 && (
                  <span className="cal-chips mt-1 hidden min-w-0 flex-col gap-0.5 md:flex">
                    {shown.map((mission, index) => (
                      <span
                        key={mission.id}
                        className={cn(
                          "block truncate rounded px-1 text-[10px] font-medium leading-4",
                          index === 1 && "cal-chip-2",
                          selected ? "bg-primary-foreground/15 text-primary-foreground" : "bg-primary/10 text-primary"
                        )}
                        title={`${timeOf(mission.scheduledStart)} ${mission.clientCompanyName}`}
                      >
                        <span className="tabular-nums">{timeOf(mission.scheduledStart)}</span> {mission.clientCompanyName}
                      </span>
                    ))}
                    {/* Two counts, one shown: the tall cell hides the second
                        chip's worth, the short cell (container query) counts it. */}
                    {more > 0 && (
                      <span className={cn("cal-more-tall px-1 text-[10px] font-medium leading-4", selected ? "text-primary-foreground/80" : "text-muted-foreground")}>
                        +{more} lagi
                      </span>
                    )}
                    {shown.length > 1 && (
                      <span className={cn("cal-more-short hidden px-1 text-[10px] font-medium leading-4", selected ? "text-primary-foreground/80" : "text-muted-foreground")}>
                        +{more + 1} lagi
                      </span>
                    )}
                  </span>
                )}
              </Link>
            )
          })}
        </div>

        {/* A silent grid reads as broken; the footer says so in words. Nothing
            else may sit between the grid and the footer: the grid shares the
            card's height, and a box here would take its share from the days. */}
        <div className="mt-5 flex shrink-0 items-center gap-2 border-t pt-4 text-xs text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" />
          {footer}
        </div>
      </div>
    </article>
  )
}
