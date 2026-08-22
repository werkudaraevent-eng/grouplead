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
      <section className="workspace-calendar-layout">
        <div className="workspace-panel workspace-calendar-panel">
          <div className="workspace-panel-header">
            <div><p className="workspace-section-kicker">Month view</p><h2>{formatMonthLabel(month)}</h2></div>
            <div className="workspace-calendar-arrows">
              <Link href={`/workspace/calendar?month=${shiftMonth(month, -1)}`} aria-label="Bulan sebelumnya"><ChevronLeft size={15} /></Link>
              <Link href={`/workspace/calendar?month=${shiftMonth(month, 1)}`} aria-label="Bulan berikutnya"><ChevronRight size={15} /></Link>
            </div>
          </div>

          <div className="workspace-calendar-preview">
            <div className="workspace-calendar-grid">
              {WEEKDAYS.map((day, index) => (
                <span className="workspace-calendar-day workspace-calendar-weekday" key={`weekday-${index}`}>{day}</span>
              ))}
              {Array.from({ length: grid.leadingBlanks }, (_, index) => (
                <span className="workspace-calendar-day" key={`blank-${index}`} aria-hidden="true" />
              ))}
              {grid.days.map((day) => {
                const classes = [
                  "workspace-calendar-day",
                  day.isToday ? "workspace-calendar-today" : "",
                  day.missionCount > 0 ? "workspace-calendar-has-event" : "",
                  day.date === selectedDay ? "workspace-calendar-selected" : "",
                ].filter(Boolean).join(" ")

                return (
                  <Link
                    className={classes}
                    key={day.date}
                    href={`/workspace/calendar?month=${month}&day=${day.date}`}
                    aria-label={`${day.dayOfMonth}, ${day.missionCount} mission`}
                    aria-current={day.date === selectedDay ? "date" : undefined}
                  >
                    {day.dayOfMonth}
                  </Link>
                )
              })}
            </div>
            <div className="workspace-calendar-note">
              <CalendarDays size={15} /> {dayMissions.length} mission pada hari terpilih
              <Link href="/workspace/missions">View missions</Link>
            </div>
          </div>
        </div>

        <aside className="workspace-panel workspace-day-panel">
          <div className="workspace-panel-header">
            <div><p className="workspace-section-kicker">{dayLabel}</p><h2>{selectedDay === today ? "Hari ini" : "Jadwal"}</h2></div>
          </div>
          <div className="workspace-day-list">
            {dayMissions.map((mission) => (
              <Link href={`/workspace/missions/${mission.id}`} key={mission.id}>
                <strong>{formatMissionSchedule(mission.scheduledStart, now).split(", ").pop()}</strong>
                <span>
                  <b>{mission.clientCompanyName}</b>
                  <small>{[mission.location, mission.primarySalesName].filter(Boolean).join(" · ") || mission.missionType}</small>
                </span>
              </Link>
            ))}
            {dayMissions.length === 0 ? (
              <div className="workspace-day-empty"><CalendarDays size={16} /><span>Tidak ada mission pada hari ini</span></div>
            ) : null}
          </div>
        </aside>
      </section>
    </WorkspacePage>
  )
}
