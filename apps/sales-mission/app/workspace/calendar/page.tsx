import Link from "next/link"
import { redirect } from "next/navigation"
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"
import { getSalesMissionAccess } from "@/lib/sales-mission-access"
import { listMissions } from "@/lib/missions/mission-queries"
import { formatMissionSchedule, MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"
import {
  buildMonthGrid,
  formatMonthLabel,
  missionDayKey,
  missionsOnDay,
  resolveMonth,
  shiftMonth,
} from "@/lib/missions/mission-calendar"
import { WorkspacePage } from "@/app/workspace/workspace-page"
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

  const params = await searchParams
  const now = new Date()
  const month = resolveMonth(params.month, now)
  const missions = await listMissions(access)
  const grid = buildMonthGrid(month, missions, now)

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
      eyebrow="Sales Mission / Calendar"
      title="Calendar"
      description="See your team schedule and keep travel time visible before assigning work."
    >
      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <article className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Month view</p>
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
            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAYS.map((day, index) => (
                <span key={`weekday-${index}`} className="grid h-7 place-items-center text-[10px] font-bold uppercase text-muted-foreground">
                  {day}
                </span>
              ))}
              {Array.from({ length: grid.leadingBlanks }, (_, index) => (
                <span key={`blank-${index}`} aria-hidden="true" className="h-11" />
              ))}
              {grid.days.map((day) => (
                <Link
                  key={day.date}
                  href={`/workspace/calendar?month=${month}&day=${day.date}`}
                  aria-label={`${day.dayOfMonth}, ${day.missionCount} mission`}
                  aria-current={day.date === selectedDay ? "date" : undefined}
                  className={cn(
                    "relative grid h-11 place-items-center rounded-lg border border-transparent text-xs transition-colors",
                    day.date === selectedDay
                      ? "bg-primary font-bold text-primary-foreground"
                      : day.isToday
                        ? "border-primary font-bold text-primary hover:bg-muted"
                        : "text-foreground hover:bg-muted"
                  )}
                >
                  {day.dayOfMonth}
                  {day.missionCount > 0 && (
                    <span
                      className={cn(
                        "absolute bottom-1.5 h-1 w-1 rounded-full",
                        day.date === selectedDay ? "bg-primary-foreground" : "bg-accent"
                      )}
                    />
                  )}
                </Link>
              ))}
            </div>

            <div className="mt-5 flex items-center gap-2 border-t pt-4 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              {dayMissions.length} mission pada hari terpilih
              <Link href="/workspace/missions" className="ml-auto font-semibold text-primary hover:underline">
                View missions
              </Link>
            </div>
          </div>
        </article>

        <aside className="rounded-xl border bg-card">
          <div className="border-b px-5 py-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{dayLabel}</p>
            <h2 className="mt-1 text-base font-semibold text-foreground">{selectedDay === today ? "Hari ini" : "Jadwal"}</h2>
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
