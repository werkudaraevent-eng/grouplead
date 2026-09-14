import Link from "next/link"
import { redirect } from "next/navigation"
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { requireModule } from "@/lib/missions/nav-access"
import { getMissionSettings, listMissions } from "@/lib/missions/mission-queries"
import { annotateJoinStatus } from "@/lib/missions/mission-join"
import { formatMissionSchedule, MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"
import {
  buildMonthGrid,
  formatMonthLabel,
  missionDayKey,
  missionsOnDay,
  resolveMonth,
  shiftMonth,
} from "@/lib/missions/mission-calendar"
import { JoinStatusLine, WorkspacePage } from "@/app/workspace/workspace-page"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

const WEEKDAYS = ["S", "S", "R", "K", "J", "S", "M"]

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; day?: string }>
}) {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")
  await requireModule(access, "sales_mission_mission")

  const params = await searchParams
  const now = new Date()
  const month = resolveMonth(params.month, now)
  // The month on screen plus a week each side, so the day panel is right at
  // the edges; nothing outside it is drawn here.
  const monthStart = new Date(`${month}-01T00:00:00+07:00`)
  const since = new Date(monthStart.getTime() - 7 * 86_400_000)
  const until = new Date(new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1)).getTime() + 8 * 86_400_000)
  const [rawMissions, settings, canCreate] = await Promise.all([
    listMissions(access, { since, until }),
    getMissionSettings(access),
    canPerform(access, "sales_mission_mission", "create"),
  ])
  // The day panel doubles as the join surface, so each entry carries where the
  // viewer stands relative to it.
  const missions = annotateJoinStatus(rawMissions, settings)
  const grid = buildMonthGrid(month, missions, now)
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
      eyebrow="Sales Mission / Kalender"
      title="Kalender"
      description="Lihat jadwal tim dan waktu perjalanan sebelum menugaskan kunjungan baru."
    >
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <article className="min-w-0 rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Tampilan bulan</p>
              <h2 className="mt-1 text-base font-semibold text-foreground">{formatMonthLabel(month)}</h2>
            </div>
            <div className="flex items-center gap-1.5">
              <Link
                href={`/workspace/calendar?month=${shiftMonth(month, -1)}`}
                aria-label="Bulan sebelumnya"
                className="grid h-8 w-8 place-items-center rounded-md border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
              </Link>
              <Link
                href={`/workspace/calendar?month=${shiftMonth(month, 1)}`}
                aria-label="Bulan berikutnya"
                className="grid h-8 w-8 place-items-center rounded-md border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="p-5">
            {/*
              Material has no "calendar with events" component; its date picker
              marks only today and the selection. Its badge does apply: a small
              badge (a dot) says something exists, a large badge with a number
              says how many. The month grid that Google Calendar itself draws
              goes one step further and names the events. So: on a phone each
              day gets the numbered badge; from `md` up the cell is tall enough
              to list the first two visits as chips and count the rest.
            */}
            <div className="grid grid-cols-7 gap-1 md:gap-1.5">
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
                    href={`/workspace/calendar?month=${month}&day=${day.date}`}
                    aria-label={`${day.dayOfMonth}, ${day.missionCount} mission`}
                    aria-current={selected ? "date" : undefined}
                    className={cn(
                      "relative flex h-11 min-w-0 flex-col items-center justify-center rounded-lg border border-transparent text-xs transition-colors md:h-auto md:min-h-[4.5rem] md:items-stretch md:justify-start md:p-1.5",
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
                          "absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold leading-none md:hidden",
                          selected ? "bg-primary-foreground text-primary" : "bg-accent text-accent-foreground"
                        )}
                      >
                        {day.missionCount}
                      </span>
                    )}
                    {shown.length > 0 && (
                      <span className="mt-1 hidden min-w-0 flex-col gap-0.5 md:flex">
                        {shown.map((mission) => (
                          <span
                            key={mission.id}
                            className={cn(
                              "block truncate rounded px-1 py-0.5 text-[11px] font-medium leading-tight",
                              selected ? "bg-primary-foreground/15 text-primary-foreground" : "bg-primary/10 text-primary"
                            )}
                            title={`${timeOf(mission.scheduledStart)} ${mission.clientCompanyName}`}
                          >
                            <span className="font-mono">{timeOf(mission.scheduledStart)}</span> {mission.clientCompanyName}
                          </span>
                        ))}
                        {more > 0 && (
                          <span className={cn("px-1 text-[11px] font-medium", selected ? "text-primary-foreground/80" : "text-muted-foreground")}>
                            +{more} lagi
                          </span>
                        )}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>

            {/* A silent grid reads as broken. Name the unit whose calendar this
                is, and, for someone who belongs to more than one, where the
                other units' visits are. */}
            {monthTotal === 0 && (
              <p className="mt-4 rounded-lg border border-dashed bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                Tidak ada mission di unit {access.companyName} pada {formatMonthLabel(month)}.
                {access.companies.length > 1 && " Mission unit lain ada di kalender unit itu; ganti unit lewat nama unit di sidebar."}
              </p>
            )}

            <div className="mt-5 flex items-center gap-2 border-t pt-4 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              {monthTotal} mission bulan ini · {dayMissions.length} pada hari terpilih
              <Link href="/workspace/missions" className="ml-auto font-semibold text-primary hover:underline">
                Lihat semua mission
              </Link>
            </div>
          </div>
        </article>

        <aside className="min-w-0 rounded-xl border bg-card">
          <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{dayLabel}</p>
              <h2 className="mt-1 text-base font-semibold text-foreground">{selectedDay === today ? "Hari ini" : "Jadwal"}</h2>
            </div>
            {/* Click a day, schedule on it: the calendar is where the gap is
                visible, so it is where the visit that fills it should start. */}
            {canCreate && (
              <Button asChild size="sm">
                <Link href={`/workspace/missions/new?date=${selectedDay}`}>
                  <Plus className="h-4 w-4" /> Mission
                </Link>
              </Button>
            )}
          </div>

          {dayMissions.length > 0 ? (
            <div className="divide-y">
              {dayMissions.map((mission) => (
                <Link key={mission.id} href={`/workspace/missions/${mission.id}`} className="flex gap-3 px-5 py-4 transition-colors hover:bg-muted/50">
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
              Tidak ada mission pada hari ini
            </div>
          )}
        </aside>
      </section>
    </WorkspacePage>
  )
}
