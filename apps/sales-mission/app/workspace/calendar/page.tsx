import Link from "next/link"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "@/components/icons"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { requireModule } from "@/lib/missions/nav-access"
import { getMissionSettings, listMissions, listTenantSales } from "@/lib/missions/mission-queries"
import { calendarHref, parseCalendarSales, resolveSales } from "@/lib/missions/calendar-filter"
import { sanitizeViewString, VIEW_COOKIES } from "@/lib/view-cookies"
import { RememberView } from "@/components/remember-view"
import { CalendarFilter } from "./calendar-filter"
import { annotateJoinStatus } from "@/lib/missions/mission-join"
import { formatMissionSchedule, MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"
import {
  buildMonthGrid,
  formatMonthLabel,
  missionDayKey,
  missionsOnDay,
  monthWindow,
  resolveMonth,
  shiftMonth,
} from "@/lib/missions/mission-calendar"
import { JoinStatusLine, WorkspacePage } from "@/app/workspace/workspace-page"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { paths } from "@/lib/paths"

export const dynamic = "force-dynamic"

const WEEKDAYS = ["S", "S", "R", "K", "J", "S", "M"]

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; day?: string; sales?: string }>
}) {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")
  await requireModule(access, "sales_mission_mission")

  const params = await searchParams
  const now = new Date()
  const month = resolveMonth(params.month, now)

  // The remembered filter. A request that says nothing about `sales` (a
  // bare open, or a month link from elsewhere) gets the person's last
  // choice; one that carries `sales=` (even empty, from "Semua") is honest
  // as it is.
  if (params.sales === undefined) {
    const raw = (await cookies()).get(VIEW_COOKIES.calendar)?.value
    if (raw) {
      let decoded = raw
      try {
        decoded = decodeURIComponent(raw)
      } catch {
        // Left as is; the parser drops what it cannot read.
      }
      const remembered = new URLSearchParams(sanitizeViewString("calendar", decoded)).get("sales")
      if (remembered) redirect(calendarHref({ month, day: params.day, sales: parseCalendarSales(remembered) }))
    }
  }
  const sales = parseCalendarSales(params.sales)
  const chosen = new Set(resolveSales(sales, access.userId))

  const { since, until } = monthWindow(month)
  const [rawMissions, settings, canCreate, people] = await Promise.all([
    listMissions(access, { since, until }),
    getMissionSettings(access),
    canPerform(access, "sales_mission_mission", "create"),
    listTenantSales(access),
  ])
  // A calendar shows what will happen. A cancelled or refused visit is not
  // on it (Google Calendar hides declined events; the phone feed marks them
  // CANCELLED so subscribers see the removal); the Aktivitas list, with its
  // Status filter, is where they are found. The day panel doubles as the
  // join surface, so each entry carries where the viewer stands relative
  // to it.
  const missions = annotateJoinStatus(
    rawMissions.filter(
      (mission) =>
        mission.status !== "CANCELLED" &&
        mission.status !== "REJECTED" &&
        (chosen.size === 0 || mission.assigneeIds.some((id) => chosen.has(id)))
    ),
    settings
  )
  const grid = buildMonthGrid(month, missions, now)
  // How many week rows the month needs, so the grid can share the height
  // from lg. Literal classes, one per possible count, so Tailwind emits
  // them; below lg the rows size to their content. From lg each cell is a
  // size container (`.cal-cell` in globals.css): its content never sizes
  // the row, and the cell shows as many visits as its height allows, then
  // "+N lagi" (Google Calendar's month rule). No floors, so nothing can
  // overflow the card, whatever the screen height.
  const weekRows = Math.ceil((grid.leadingBlanks + grid.days.length) / 7)
  const WEEK_ROWS: Record<number, string> = {
    4: "lg:grid-rows-[auto_repeat(4,minmax(0,1fr))]",
    5: "lg:grid-rows-[auto_repeat(5,minmax(0,1fr))]",
    6: "lg:grid-rows-[auto_repeat(6,minmax(0,1fr))]",
  }
  const monthTotal = grid.days.reduce((sum, day) => sum + day.missionCount, 0)
  const timeOf = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat("en-GB", { timeZone: MISSION_TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso)) : ""

  // A selected day outside the shown month would render an empty panel with no
  // explanation, so fall back to today or the first of the month.
  const today = missionDayKey(now)
  const requestedDay = params.day && params.day.startsWith(month) ? params.day : null
  const selectedDay = requestedDay ?? (today.startsWith(month) ? today : `${month}-01`)
  const dayMissions = missionsOnDay(missions, selectedDay)

  const dayLabel = new Intl.DateTimeFormat("id-ID", {
    timeZone: MISSION_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${selectedDay}T00:00:00+07:00`))

  return (
    <WorkspacePage
      eyebrow="Sales Activity / Kalender"
      title="Kalender"
      description="Lihat jadwal tim dan waktu perjalanan sebelum menugaskan kunjungan baru."
      action={
        <Button asChild variant="outline" size="sm">
          <Link href={paths.myCalendar}>
            <CalendarDays className="h-4 w-4" /> Sinkron ke ponsel
          </Link>
        </Button>
      }
    >
      <RememberView list="calendar" />
      <div className="flex flex-col gap-4 lg:h-full lg:min-h-0">
      <CalendarFilter
        month={month}
        day={selectedDay}
        sales={sales}
        people={people.map((person) => ({ id: person.id, name: person.name, avatarUrl: person.avatarUrl }))}
      />
      {/* One screen, no page scroll (Google Calendar's month view, Outlook's
          calendar): from lg the two panes fill the height under the chips,
          top edges level. The month grid shares its rows over that
          height; the day pane keeps its header and scrolls its own list. On
          a short screen the cells keep a floor height and the page scrolls
          rather than crushing the days. */}
      <section className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
        <article className="flex min-w-0 flex-col rounded-xl border bg-card lg:min-h-0">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Tampilan bulan</p>
              <h2 className="mt-1 text-base font-semibold text-foreground">{formatMonthLabel(month)}</h2>
            </div>
            <div className="flex items-center gap-1.5">
              {/* The jump every calendar app has: back to now, whatever month
                  the arrows reached. Hidden while today is already in view. */}
              {!(month === today.slice(0, 7) && selectedDay === today) && (
                <Link
                  href={calendarHref({ month: today.slice(0, 7), day: today, sales })}
                  className="mr-1 inline-flex h-11 items-center rounded-md border px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted md:h-8"
                >
                  Hari ini
                </Link>
              )}
              <Link
                href={calendarHref({ month: shiftMonth(month, -1), sales })}
                aria-label="Bulan sebelumnya"
                className="grid h-11 w-11 place-items-center rounded-md border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:h-8 md:w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Link>
              <Link
                href={calendarHref({ month: shiftMonth(month, 1), sales })}
                aria-label="Bulan berikutnya"
                className="grid h-11 w-11 place-items-center rounded-md border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:h-8 md:w-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col p-5">
            {/*
              Material has no "calendar with events" component; its date picker
              marks only today and the selection. Its badge does apply: a small
              badge (a dot) says something exists, a large badge with a number
              says how many. The month grid that Google Calendar itself draws
              goes one step further and names the events. So: on a phone each
              day gets the numbered badge; from `md` up the cell is tall enough
              to list the first two visits as chips and count the rest.
            */}
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
                    href={calendarHref({ month, day: day.date, sales })}
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

            {/* A silent grid reads as broken; the footer says so in words.
                Nothing else may sit between the grid and the footer: the
                grid shares the card's height, and a box here would take
                its share from the days. */}
            <div className="mt-5 flex shrink-0 items-center gap-2 border-t pt-4 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              {monthTotal === 0
                ? `Tidak ada aktivitas pada ${formatMonthLabel(month)}${sales.length ? " untuk saringan ini" : ""}`
                : `${monthTotal} aktivitas bulan ini · ${dayMissions.length} pada hari terpilih`}
              <Link href={paths.activities()} className="ml-auto font-semibold text-primary hover:underline">
                Lihat semua aktivitas
              </Link>
            </div>
          </div>
        </article>

        <aside className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card lg:min-h-0">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b px-5 py-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{dayLabel}</p>
              <h2 className="mt-1 text-base font-semibold text-foreground">{selectedDay === today ? "Hari ini" : "Jadwal"}</h2>
            </div>
            {/* Click a day, schedule on it: the calendar is where the gap is
                visible, so it is where the visit that fills it should start. */}
            {canCreate && (
              <Button asChild size="sm">
                <Link href={paths.newActivity({ date: selectedDay })}>
                  <Plus className="h-4 w-4" /> Aktivitas
                </Link>
              </Button>
            )}
          </div>

          {dayMissions.length > 0 ? (
            <div className="min-h-0 flex-1 divide-y overflow-y-auto overscroll-contain">
              {dayMissions.map((mission) => (
                <Link key={mission.id} href={paths.activity(mission.id)} className="flex gap-3 px-5 py-4 transition-colors hover:bg-muted/50">
                  <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground">
                    {formatMissionSchedule(mission.scheduledStart, now).split(", ").pop()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">{mission.clientCompanyName}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[mission.location, mission.primarySalesName].filter(Boolean).join(" · ") || mission.missionType}
                    </span>
                    <JoinStatusLine status={mission.joinStatus} />
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 px-5 py-6 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              Tidak ada aktivitas pada hari ini
            </div>
          )}
        </aside>
      </section>
      </div>
    </WorkspacePage>
  )
}
