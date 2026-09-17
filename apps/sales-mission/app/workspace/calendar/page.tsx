import Link from "next/link"
import { redirect } from "next/navigation"
import { cookies, headers } from "next/headers"
import { CalendarDays, Plus } from "@/components/icons"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { requireModule } from "@/lib/missions/nav-access"
import { getMissionSettings, listMissions, listTenantSales } from "@/lib/missions/mission-queries"
import { calendarHref, parseCalendarSales, resolveSales } from "@/lib/missions/calendar-filter"
import { sanitizeViewString, VIEW_COOKIES } from "@/lib/view-cookies"
import { RememberView } from "@/components/remember-view"
import { CalendarFilter } from "./calendar-filter"
import { PublicLinkDialog } from "./public-link-dialog"
import { annotateJoinStatus } from "@/lib/missions/mission-join"
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
import { JoinStatusLine, WorkspacePage } from "@/app/workspace/workspace-page"
import { Button } from "@/components/ui/button"
import { paths } from "@/lib/paths"

export const dynamic = "force-dynamic"

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
  const [rawMissions, settings, canCreate, isAdmin, people] = await Promise.all([
    listMissions(access, { since, until }),
    getMissionSettings(access),
    canPerform(access, "sales_mission_mission", "create"),
    canPerform(access, "sales_mission_settings", "update"),
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
  const monthTotal = grid.days.reduce((sum, day) => sum + day.missionCount, 0)

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

  // Built from the request so a copied link works in whatever environment the
  // admin is actually using, rather than a hardcoded production host.
  const headerList = await headers()
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3001"
  const proto = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")
  const baseUrl = `${proto}://${host}`

  return (
    <WorkspacePage
      eyebrow="Sales Activity / Kalender"
      title="Kalender"
      description="Lihat jadwal tim dan waktu perjalanan sebelum menugaskan kunjungan baru."
      action={
        <>
          {isAdmin && <PublicLinkDialog baseUrl={baseUrl} />}
          <Button asChild variant="outline" size="sm">
            <Link href={paths.myCalendar}>
              <CalendarDays className="h-4 w-4" /> Sinkron ke ponsel
            </Link>
          </Button>
        </>
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
          <MonthGrid
            month={month}
            grid={grid}
            selectedDay={selectedDay}
            today={today}
            hrefFor={(day) => calendarHref({ month, day, sales })}
            navHref={{
              prev: calendarHref({ month: shiftMonth(month, -1), sales }),
              next: calendarHref({ month: shiftMonth(month, 1), sales }),
              today: calendarHref({ month: today.slice(0, 7), day: today, sales }),
            }}
            footer={
              <>
                {monthTotal === 0
                  ? `Tidak ada aktivitas pada ${formatMonthLabel(month)}${sales.length ? " untuk saringan ini" : ""}`
                  : `${monthTotal} aktivitas bulan ini · ${dayMissions.length} pada hari terpilih`}
                <Link href={paths.activities()} className="ml-auto font-semibold text-primary hover:underline">
                  Lihat semua aktivitas
                </Link>
              </>
            }
          />

          <DayPane
            dayLabel={dayLabel}
            title={selectedDay === today ? "Hari ini" : "Jadwal"}
            missions={dayMissions}
            now={now}
            // Click a day, schedule on it: the calendar is where the gap is
            // visible, so it is where the visit that fills it should start.
            action={
              canCreate ? (
                <Button asChild size="sm">
                  <Link href={paths.newActivity({ date: selectedDay })}>
                    <Plus className="h-4 w-4" /> Aktivitas
                  </Link>
                </Button>
              ) : undefined
            }
            itemHref={(mission) => paths.activity(mission.id)}
            itemExtra={(mission) => <JoinStatusLine status={mission.joinStatus} />}
          />
        </section>
      </div>
    </WorkspacePage>
  )
}
