import Link from "next/link"
import { CalendarDays } from "@/components/icons"
import { formatMissionSchedule, type MissionListItem } from "@/lib/missions/mission-schema"

/**
 * One day's visits, beside the month grid.
 *
 * The same four facts on both calendars — time, client, where, who — because
 * that is what someone asks a calendar. What differs is whether a row goes
 * anywhere: signed in it opens the activity and carries the viewer's join
 * state; on the public calendar there is nothing to open and no viewer, so the
 * row is a plain entry. Passing the link in rather than branching inside keeps
 * the two pages honestly identical everywhere else.
 */
export function DayPane<T extends MissionListItem>({
  dayLabel,
  title,
  missions,
  now,
  action,
  itemHref,
  itemExtra,
  emptyText = "Tidak ada aktivitas pada hari ini",
}: {
  dayLabel: string
  title: string
  missions: T[]
  now: Date
  action?: React.ReactNode
  itemHref?: (mission: T) => string
  itemExtra?: (mission: T) => React.ReactNode
  emptyText?: string
}) {
  return (
    <aside className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card lg:min-h-0">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{dayLabel}</p>
          <h2 className="mt-1 text-base font-semibold text-foreground">{title}</h2>
        </div>
        {action}
      </div>

      {missions.length > 0 ? (
        <div className="min-h-0 flex-1 divide-y overflow-y-auto overscroll-contain">
          {missions.map((mission) => {
            const body = (
              <>
                <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground">
                  {formatMissionSchedule(mission.scheduledStart, now).split(", ").pop()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">{mission.clientCompanyName}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[mission.location, mission.primarySalesName].filter(Boolean).join(" · ") || mission.missionType}
                  </span>
                  {itemExtra?.(mission)}
                </span>
              </>
            )
            return itemHref ? (
              <Link key={mission.id} href={itemHref(mission)} className="flex gap-3 px-5 py-4 transition-colors hover:bg-muted/50">
                {body}
              </Link>
            ) : (
              <div key={mission.id} className="flex gap-3 px-5 py-4">
                {body}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex items-center gap-2 px-5 py-6 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4" />
          {emptyText}
        </div>
      )}
    </aside>
  )
}
