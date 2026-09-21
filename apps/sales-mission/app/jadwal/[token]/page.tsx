import type { Metadata } from "next"
import { resolveBoardToken } from "@/lib/board/board-access"
import { listBoardPeople, listMissionsForCompany } from "@/lib/board/board-queries"
import { parsePublicView, publicCalendarHref, publicCalendarMissions } from "@/lib/board/public-calendar"
import { calendarFacetValues, type CalendarGroup } from "@/lib/missions/calendar-filter"
import { hasServiceClientConfig } from "@/utils/supabase/service"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"
import {
  buildMonthGrid,
  formatMonthLabel,
  missionDayKey,
  missionsOnDay,
  monthWindow,
  resolveMonth,
  shiftMonth,
} from "@/lib/missions/mission-calendar"
import { MonthGrid } from "@/components/calendar/month-grid"
import { DayPane } from "@/components/calendar/day-pane"
import { DayGroupMenu } from "@/components/calendar/day-group-menu"
import { JadwalFilter } from "./jadwal-filter"
import { PublicRefusal, PublicShell } from "./public-shell"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Jadwal Sales Activity",
  // The URL is the credential. Keeping it out of search indexes is the cheapest
  // part of not leaking it.
  robots: { index: false, follow: false },
}

/**
 * The schedule, for someone without an account.
 *
 * Management asked to look at what the team is doing without being given
 * accounts to do it, so this is the internal calendar with everything a viewer
 * implies taken out: no session, no "Saya", no remembered filter, no links into
 * records, no buttons. The token in the path decides the tenant and whether
 * client names are shown; the query decides the month, the day and whose visits
 * are drawn, exactly as on the inside.
 */
export default async function PublicSchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ month?: string; day?: string; sales?: string | string[]; location?: string | string[]; type?: string | string[]; group?: string | string[] }>
}) {
  const { token } = await params
  const query = await searchParams

  if (!hasServiceClientConfig()) {
    return (
      <PublicRefusal
        title="Jadwal belum dapat dibuka"
        body="Deployment ini belum punya SUPABASE_SERVICE_ROLE_KEY. Minta admin menambahkannya lalu deploy ulang."
      />
    )
  }

  const resolved = await resolveBoardToken(token, "calendar")
  if (!resolved) {
    return (
      <PublicRefusal
        title="Tautan jadwal tidak berlaku"
        body="Tautan ini tidak berlaku, sudah dicabut, atau kedaluwarsa. Minta admin membuat tautan baru dari halaman Kalender."
      />
    )
  }

  const now = new Date()
  const month = resolveMonth(query.month, now)
  const view = parsePublicView(query)
  const { sales } = view
  const { since, until } = monthWindow(month)

  const [rawMissions, people] = await Promise.all([
    listMissionsForCompany(resolved.companyId, { since, until }),
    listBoardPeople(),
  ])
  const missions = publicCalendarMissions(rawMissions, { ...view, masked: !resolved.showClientNames })
  const facets = calendarFacetValues(rawMissions, view)
  const grid = buildMonthGrid(month, missions, now)
  const monthTotal = grid.days.reduce((sum, day) => sum + day.missionCount, 0)

  const today = missionDayKey(now)
  const requestedDay = query.day && query.day.startsWith(month) ? query.day : null
  const selectedDay = requestedDay ?? (today.startsWith(month) ? today : `${month}-01`)
  const dayMissions = missionsOnDay(missions, selectedDay)

  const dayLabel = new Intl.DateTimeFormat("id-ID", {
    timeZone: MISSION_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${selectedDay}T00:00:00+07:00`))

  const href = (next: { month: string; day?: string | null; group?: CalendarGroup }) =>
    publicCalendarHref(token, { month: next.month, day: next.day, ...view, ...(next.group ? { group: next.group } : {}) })

  return (
    <PublicShell label={resolved.label}>
      <div className="flex flex-col gap-4 lg:h-full lg:min-h-0">
        <JadwalFilter
          token={token}
          month={month}
          day={selectedDay}
          view={view}
          people={people}
          locations={facets.locations}
          types={facets.types}
        />
        <section className="grid grid-cols-1 gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
          <MonthGrid
            month={month}
            grid={grid}
            selectedDay={selectedDay}
            today={today}
            hrefFor={(day) => href({ month, day })}
            navHref={{
              prev: href({ month: shiftMonth(month, -1) }),
              next: href({ month: shiftMonth(month, 1) }),
              today: href({ month: today.slice(0, 7), day: today }),
            }}
            footer={
              monthTotal === 0
                ? `Tidak ada aktivitas pada ${formatMonthLabel(month)}${sales.length || view.location.length || view.type.length ? " untuk saringan ini" : ""}`
                : `${monthTotal} aktivitas bulan ini · ${dayMissions.length} pada hari terpilih`
            }
          />

          <DayPane
            dayLabel={dayLabel}
            title={selectedDay === today ? "Hari ini" : "Jadwal"}
            missions={dayMissions}
            now={now}
            people={people}
            group={view.group}
            tools={<DayGroupMenu value={view.group} hrefFor={(group) => href({ month, day: selectedDay, group })} />}
          />
        </section>
      </div>
    </PublicShell>
  )
}
